import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Optional database access. FlowEdge runs fully without a database
// (in-memory mock stores, see lib/store) so local development needs no
// Postgres. When DATABASE_URL is set, stores persist through Prisma.

const globalForPrisma = globalThis as unknown as { flowedgePrisma?: PrismaClient | null }

export function getDb(): PrismaClient | null {
  if (globalForPrisma.flowedgePrisma !== undefined) return globalForPrisma.flowedgePrisma

  const url = process.env.DATABASE_URL
  if (!url) {
    globalForPrisma.flowedgePrisma = null
    return null
  }

  const adapter = new PrismaPg({ connectionString: url })
  globalForPrisma.flowedgePrisma = new PrismaClient({ adapter })
  return globalForPrisma.flowedgePrisma
}

export function dbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
