import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Self-contained server bundle, run on AWS Lambda behind API Gateway.
  output: 'standalone',
  devIndicators: false,
  /**
   * Testing inside Nimiq Pay loads the dev server from this machine's LAN
   * address. Next blocks cross-origin dev resources by default, which would
   * stop the app from hydrating. Dev-only; no effect on production builds.
   */
  allowedDevOrigins: ['192.168.0.*', '192.168.1.*', '10.0.0.*', 'localhost', 'zamu.prashantthakur.dev'],
}

export default nextConfig
