-- FlowEdge mobile — Supabase schema
-- Run in the Supabase SQL editor. Auth users come from auth.users.

-- ── Profiles ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  trading_focus text default 'intraday',
  preferred_pairs text[] default '{EUR/USD,GBP/USD,USD/JPY}',
  preferred_sessions text[] default '{london,newyork,london_ny_overlap}',
  onboarded boolean default false,
  created_at timestamptz default now()
);

-- ── Subscriptions (raw store state, one row per RC subscription) ─────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  rc_app_user_id text not null,
  product_id text not null,
  platform text not null check (platform in ('ios','android','web')),
  status text not null check (status in ('active','trialing','grace','cancelled','expired')),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  will_renew boolean default true,
  raw_event jsonb,
  updated_at timestamptz default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create unique index if not exists subscriptions_rc_idx on public.subscriptions (rc_app_user_id, product_id);

-- ── Entitlements (resolved plan per user — what the app gates on) ────
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro','elite')),
  status text not null default 'none' check (status in ('none','active','trialing','grace','cancelled','expired')),
  product_id text,
  platform text,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

-- ── Signals mirror (server-gated content for elite/pro API reads) ────
create table if not exists public.signals (
  id text primary key,
  pair text not null,
  direction text not null,
  grade text not null,
  confidence int not null,
  status text not null,
  payload jsonb not null, -- full MobileSignal
  published_at timestamptz default now()
);

create table if not exists public.signal_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  signal_id text references public.signals (id) on delete cascade,
  plan text not null,
  viewed_at timestamptz default now()
);

-- ── Journal ──────────────────────────────────────────────────────────
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pair text not null,
  direction text not null,
  setup_type text not null,
  session_tag text not null,
  grade text not null,
  taken boolean default true,
  result_r double precision,
  result_pips double precision,
  mistakes text[] default '{}',
  notes text default '',
  screenshot_url text,
  created_at timestamptz default now()
);
create index if not exists journal_user_idx on public.journal_entries (user_id, created_at desc);

-- ── Analytics snapshots (precomputed per-user rollups) ───────────────
create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  window_days int not null,
  stats jsonb not null,
  computed_at timestamptz default now()
);

-- ── Notifications ────────────────────────────────────────────────────
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expo_push_token text,
  signal_alerts boolean default false,
  trial_reminders boolean default true,
  promotions boolean default true,
  daily_recap boolean default false,
  updated_at timestamptz default now()
);

-- ── Conversion telemetry ─────────────────────────────────────────────
create table if not exists public.paywall_impressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  props jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists public.upgrade_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event text not null,
  props jsonb default '{}',
  created_at timestamptz default now()
);

-- ── Row Level Security ───────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.signals enable row level security;
alter table public.signal_views enable row level security;
alter table public.journal_entries enable row level security;
alter table public.analytics_snapshots enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.paywall_impressions enable row level security;
alter table public.upgrade_events enable row level security;

-- Own-row access
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own subscriptions read" on public.subscriptions for select using (auth.uid() = user_id);
create policy "own entitlement read" on public.entitlements for select using (auth.uid() = user_id);
create policy "own journal" on public.journal_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own snapshots read" on public.analytics_snapshots for select using (auth.uid() = user_id);
create policy "own notif prefs" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own views" on public.signal_views for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "insert telemetry" on public.paywall_impressions for insert with check (auth.uid() = user_id or user_id is null);
create policy "insert upgrade events" on public.upgrade_events for insert with check (auth.uid() = user_id or user_id is null);

-- Signals: server-side gating. Approved-signal payloads are readable only
-- by entitled users; everyone can read blocked/preview rows metadata.
create policy "signals read gated" on public.signals for select using (
  status = 'blocked'
  or exists (
    select 1 from public.entitlements e
    where e.user_id = auth.uid()
      and e.plan in ('pro','elite')
      and e.status in ('active','trialing','grace','cancelled')
  )
);

-- Writes to subscriptions/entitlements/signals happen only via the service
-- role (webhook + publisher) — no user-facing write policies on purpose.
