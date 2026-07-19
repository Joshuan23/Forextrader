// Runtime mode control — the single authority on real vs demo data.
//
// Production defaults to REAL data. The in-memory demo stores and the
// deterministic mock providers are reachable ONLY when
// DEVELOPMENT_DEMO_MODE=true is set explicitly. Without a database in
// non-demo mode, data paths fail loudly with a SetupError instead of
// silently serving fake data.

export class SetupError extends Error {
  readonly status = 503
  readonly setup = true
  constructor(message: string) {
    super(message)
    this.name = 'SetupError'
  }
}

export function isDemoMode(): boolean {
  return process.env.DEVELOPMENT_DEMO_MODE === 'true'
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export function hasSupabaseAdmin(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** Throws unless a real database is configured or demo mode is explicitly on. */
export function requireRealData(feature: string): void {
  if (isDemoMode() || hasDatabase()) return
  throw new SetupError(
    `${feature} requires a real database. Set DATABASE_URL (Supabase/Neon Postgres) and run \`npx prisma db push\`. ` +
      'To browse with demo data instead, explicitly set DEVELOPMENT_DEMO_MODE=true.'
  )
}

/** Throws unless Supabase service-role credentials are configured (or demo). */
export function requireSupabaseAdmin(feature: string): void {
  if (hasSupabaseAdmin()) return
  throw new SetupError(
    `${feature} requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server. ` +
      'Create the project, run mobile/supabase/schema.sql in the SQL editor, and set both env vars.'
  )
}

/** Standard JSON error body for API routes. */
export function errorResponse(e: unknown): { body: { ok: false; error: string; setup?: boolean }; status: number } {
  if (e instanceof SetupError) return { body: { ok: false, error: e.message, setup: true }, status: 503 }
  const msg = e instanceof Error ? e.message : 'internal_error'
  return { body: { ok: false, error: msg }, status: 500 }
}
