-- First Trip Assistant V4. Apply with the Supabase CLI or SQL editor to a development project.
create table if not exists public.outfitter_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null unique,
  criteria_version bigint not null default 1,
  coverage_version bigint not null default 1,
  activity_id text,
  answers jsonb not null default '{}'::jsonb,
  coverage_ledger jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table if not exists public.outfitter_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.outfitter_sessions(id) on delete cascade,
  status text not null check (status in ('question_pending','researching','proposed','failed','cancelled')),
  events jsonb not null default '[]'::jsonb,
  proposal jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table if not exists public.availability_observations (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  variant_id text,
  zip text,
  store_id text,
  method text check (method in ('shipping','pickup')),
  state text not null check (state in ('available','unavailable','unknown')),
  source_url text,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

alter table public.outfitter_sessions enable row level security;
alter table public.outfitter_runs enable row level security;
alter table public.availability_observations enable row level security;
-- No browser policies: the server-only secret key performs session-bound access.
