import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL ?? ''
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url, ssl: local ? false : 'require' },
})
