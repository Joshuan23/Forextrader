// Database module — only loaded on server at runtime, never during Next.js build
// This prevents Prisma/pg from being bundled into the client

// Stub exports for type checking
export type PrismaClient = any

export function getDb(): any | null {
  if (typeof window !== 'undefined') return null
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) return null

  try {
    const { PrismaClient } = require('@prisma/client')
    const { PrismaPg } = require('@prisma/adapter-pg')

    const globalForPrisma = globalThis as unknown as { flowedgePrisma?: any | null }
    if (globalForPrisma.flowedgePrisma !== undefined) return globalForPrisma.flowedgePrisma

    const url = process.env.DATABASE_URL
    if (!url) {
      globalForPrisma.flowedgePrisma = null
      return null
    }

    const adapter = new PrismaPg({ connectionString: url })
    globalForPrisma.flowedgePrisma = new PrismaClient({ adapter })
    return globalForPrisma.flowedgePrisma
  } catch {
    return null
  }
}

export function dbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL)
}
