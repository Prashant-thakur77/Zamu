/// <reference path="./.sst/platform/config.d.ts" />

/**
 * Zamu on AWS (ap-south-1):
 *  - Next.js on Lambda behind CloudFront (OpenNext), custom domain on Cloudflare DNS
 *  - RDS PostgreSQL (db.t4g.micro, single-AZ, 20 GB gp3, backups on), reachable
 *    over the internet with SSL forced, so the functions need no VPC or NAT
 *  - a 5-minute scheduled job that opens due rounds and re-checks payouts
 *  - a $10/month budget alert
 */
export default $config({
  app(input) {
    return {
      name: 'zamu',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: input?.stage === 'production',
      home: 'aws',
      providers: {
        aws: { region: 'ap-south-1' },
        random: '4.18.4',
        // Cloudflare holds the DNS for the production domain only.
        ...(input?.stage === 'production' ? { cloudflare: '6.15.0' } : {}),
      },
    }
  },
  async run() {
    const production = $app.stage === 'production'

    const authSecret = new sst.Secret('AuthSecret')
    const cronSecret = new sst.Secret('CronSecret')

    const dbPassword = new random.RandomPassword('DbPassword', { length: 40, special: false })

    const sg = new aws.ec2.SecurityGroup('DbSecurityGroup', {
      description: 'Zamu Postgres: TLS-only Postgres from the app functions',
      ingress: [{ protocol: 'tcp', fromPort: 5432, toPort: 5432, cidrBlocks: ['0.0.0.0/0'], ipv6CidrBlocks: ['::/0'] }],
      egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
    })

    const params = new aws.rds.ParameterGroup('DbParams', {
      name: `zamu-${$app.stage}-pg17`,
      family: 'postgres17',
      parameters: [
        { name: 'rds.force_ssl', value: '1' },
        { name: 'password_encryption', value: 'scram-sha-256' },
      ],
    })

    const db = new aws.rds.Instance('Db', {
      identifier: `zamu-${$app.stage}`,
      engine: 'postgres',
      engineVersion: '17',
      instanceClass: 'db.t4g.micro',
      allocatedStorage: 20,
      storageType: 'gp3',
      storageEncrypted: true,
      dbName: 'zamu',
      username: 'zamu',
      password: dbPassword.result,
      parameterGroupName: params.name,
      vpcSecurityGroupIds: [sg.id],
      publiclyAccessible: true,
      multiAz: false,
      backupRetentionPeriod: production ? 7 : 1,
      skipFinalSnapshot: !production,
      finalSnapshotIdentifier: production ? `zamu-${$app.stage}-final` : undefined,
      deletionProtection: production,
      applyImmediately: true,
      autoMinorVersionUpgrade: true,
    })

    const databaseUrl = $interpolate`postgres://zamu:${dbPassword.result}@${db.address}:${db.port}/zamu?sslmode=require`

    const domainName = production ? 'zamu.prashantthakur.dev' : undefined
    const siteUrl = domainName ? `https://${domainName}` : undefined

    const environment = {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: authSecret.value,
      CRON_SECRET: cronSecret.value,
      ZAMU_STAGE: $app.stage,
      ...(siteUrl ? { NEXT_PUBLIC_SITE_URL: siteUrl } : {}),
    }

    // Next.js standalone server on Lambda, behind API Gateway (HTTP API).
    // Build it first with infra/build-web.sh. The Lambda Web Adapter layer
    // starts run.sh and proxies each request to the server on port 8080.
    const webRole = new aws.iam.Role('WebRole', {
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: { Service: 'lambda.amazonaws.com' }, Action: 'sts:AssumeRole' }],
      }),
      managedPolicyArns: ['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'],
    })

    const webFn = new aws.lambda.Function('WebFn', {
      name: `zamu-${$app.stage}-web`,
      role: webRole.arn,
      runtime: 'nodejs22.x',
      architectures: ['arm64'],
      handler: 'run.sh',
      code: new $util.asset.FileArchive(`${$cli.paths.root}/.lambda/web`),
      memorySize: 1024,
      timeout: 25,
      layers: ['arn:aws:lambda:ap-south-1:753240598075:layer:LambdaAdapterLayerArm64:25'],
      environment: {
        variables: {
          ...environment,
          AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
          AWS_LWA_PORT: '8080',
          AWS_LWA_READINESS_CHECK_PATH: '/api/health',
          AWS_LWA_ENABLE_COMPRESSION: 'true',
        },
      },
    })

    const api = new sst.aws.ApiGatewayV2('Web', {
      domain: domainName ? { name: domainName, dns: sst.cloudflare.dns({ zone: 'a51a2789a9b2630a5a96e50f853f6ee9' }) } : undefined,
    })
    api.route('$default', webFn.arn)

    const web = { url: domainName ? $interpolate`https://${domainName}` : api.url }

    new sst.aws.Function('Migrate', {
      name: `zamu-${$app.stage}-migrate`,
      handler: 'infra/migrate.handler',
      environment,
      copyFiles: [{ from: 'db/migrations', to: 'migrations' }],
      timeout: '2 minutes',
      architecture: 'arm64',
    })

    new sst.aws.Cron('Tick', {
      schedule: 'rate(5 minutes)',
      function: {
        handler: 'infra/tick.handler',
        environment: { ...environment, PING_URL: web.url },
        timeout: '2 minutes',
        memory: '512 MB',
        architecture: 'arm64',
      },
    })

    new aws.budgets.Budget('MonthlyBudget', {
      name: `zamu-${$app.stage}-monthly`,
      budgetType: 'COST',
      limitAmount: '10',
      limitUnit: 'USD',
      timeUnit: 'MONTHLY',
      notifications: [
        { comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE', notificationType: 'ACTUAL', subscriberEmailAddresses: [process.env.BUDGET_EMAIL ?? ''] },
        { comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE', notificationType: 'FORECASTED', subscriberEmailAddresses: [process.env.BUDGET_EMAIL ?? ''] },
      ],
    })

    return {
      url: web.url,
      apiUrl: api.url,
      dbHost: db.address,
      databaseUrl: $util.secret(databaseUrl),
    }
  },
})
