-- RunTwi initial schema. Runs on Supabase Postgres (and as docker-entrypoint init).
-- Row-Level Security is enabled so each runner only sees their own data.

create extension if not exists "uuid-ossp";

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists profiles (
    id uuid primary key default uuid_generate_v4(),  -- = auth.users.id on Supabase
    display_name text not null default 'Runner',
    dialect text not null default 'twi' check (dialect in ('twi','ga','ewe')),
    weekly_target_km double precision not null default 20,
    created_at timestamptz not null default now()
);

-- ── plans ───────────────────────────────────────────────────────────────────
create table if not exists plans (
    id uuid primary key default uuid_generate_v4(),
    profile_id uuid not null references profiles(id) on delete cascade,
    name text not null,
    goal text not null default '5k' check (goal in ('5k','10k','half','base')),
    sessions jsonb not null default '[]',
    active boolean not null default true,
    created_at timestamptz not null default now()
);
create index if not exists plans_profile_idx on plans(profile_id);

-- ── runs ────────────────────────────────────────────────────────────────────
create table if not exists runs (
    id uuid primary key default uuid_generate_v4(),
    profile_id uuid not null references profiles(id) on delete cascade,
    plan_id uuid references plans(id) on delete set null,
    mode text not null default 'free' check (mode in ('free','interval','tempo','long')),
    dialect text not null default 'twi' check (dialect in ('twi','ga','ewe')),
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    distance_m double precision not null default 0,
    duration_s double precision not null default 0,
    avg_pace_s_per_km double precision not null default 0,
    avg_cadence_spm double precision not null default 0,
    target_pace_s_per_km double precision,
    route jsonb not null default '[]',
    splits jsonb not null default '[]',
    cues jsonb not null default '[]',
    client_id text unique,        -- idempotency key for offline sync
    synced boolean not null default true,
    created_at timestamptz not null default now()
);
create index if not exists runs_profile_idx on runs(profile_id, started_at desc);

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table plans    enable row level security;
alter table runs     enable row level security;

-- Supabase exposes the authenticated user id via auth.uid().
do $$ begin
    create policy "own profile" on profiles
        for all using (id = auth.uid()) with check (id = auth.uid());
exception when others then null; end $$;

do $$ begin
    create policy "own plans" on plans
        for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
exception when others then null; end $$;

do $$ begin
    create policy "own runs" on runs
        for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
exception when others then null; end $$;
