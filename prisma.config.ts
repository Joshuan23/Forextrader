import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 config: connection URL lives here (for CLI/migrate) and in the
// PrismaClient adapter (for runtime). See lib/db.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // Optional at generate time; required for `prisma migrate` / `db push`.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/flowedge',
  },
})
