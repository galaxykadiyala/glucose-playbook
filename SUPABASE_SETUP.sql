-- ============================================================
-- Glucose Decode — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- cgm_stints: one row per CGM sensor wear period
create table if not exists public.cgm_stints (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  sensor_type text not null default 'Ultrahuman',
  created_at  timestamptz not null default now()
);

-- cgm_readings: raw glucose values and event labels from CSV
create table if not exists public.cgm_readings (
  id            uuid primary key default gen_random_uuid(),
  stint_id      uuid not null references public.cgm_stints(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  timestamp     timestamptz not null,
  glucose_value integer,        -- null for event-label rows
  event_label   text,           -- null for numeric rows
  created_at    timestamptz not null default now()
);

-- meal_logs: optional manual meal entries
create table if not exists public.meal_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  timestamp   timestamptz not null,
  food_items  text not null,
  notes       text,
  source      text not null default 'manual',
  created_at  timestamptz not null default now()
);

-- manual_glucose: finger-prick or manual glucose entries
create table if not exists public.manual_glucose (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  timestamp     timestamptz not null,
  glucose_value integer not null,
  context       text,
  source        text not null default 'manual',
  created_at    timestamptz not null default now()
);

-- user_whatsapp_links: WhatsApp bot linking table
create table if not exists public.user_whatsapp_links (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  link_code       text not null unique,
  whatsapp_number text unique,              -- e.g. whatsapp:+12125551234, null until linked
  linked_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.user_whatsapp_links enable row level security;
alter table public.cgm_stints    enable row level security;
alter table public.cgm_readings  enable row level security;
alter table public.meal_logs     enable row level security;
alter table public.manual_glucose enable row level security;

-- user_whatsapp_links: users can read/manage their own row (backend uses service role key)
create policy "Users can select own whatsapp link"
  on public.user_whatsapp_links for select
  using (auth.uid() = user_id);

create policy "Users can insert own whatsapp link"
  on public.user_whatsapp_links for insert
  with check (auth.uid() = user_id);

-- cgm_stints policies
create policy "Users can select own stints"
  on public.cgm_stints for select
  using (auth.uid() = user_id);

create policy "Users can insert own stints"
  on public.cgm_stints for insert
  with check (auth.uid() = user_id);

create policy "Users can update own stints"
  on public.cgm_stints for update
  using (auth.uid() = user_id);

create policy "Users can delete own stints"
  on public.cgm_stints for delete
  using (auth.uid() = user_id);

-- cgm_readings policies
create policy "Users can select own readings"
  on public.cgm_readings for select
  using (auth.uid() = user_id);

create policy "Users can insert own readings"
  on public.cgm_readings for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own readings"
  on public.cgm_readings for delete
  using (auth.uid() = user_id);

-- meal_logs policies
create policy "Users can select own meal logs"
  on public.meal_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own meal logs"
  on public.meal_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own meal logs"
  on public.meal_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete own meal logs"
  on public.meal_logs for delete
  using (auth.uid() = user_id);

-- manual_glucose policies
create policy "Users can select own manual glucose"
  on public.manual_glucose for select
  using (auth.uid() = user_id);

create policy "Users can insert own manual glucose"
  on public.manual_glucose for insert
  with check (auth.uid() = user_id);

create policy "Users can update own manual glucose"
  on public.manual_glucose for update
  using (auth.uid() = user_id);

create policy "Users can delete own manual glucose"
  on public.manual_glucose for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================

create index if not exists cgm_stints_user_id_idx       on public.cgm_stints(user_id);
create index if not exists cgm_readings_stint_id_idx    on public.cgm_readings(stint_id);
create index if not exists cgm_readings_user_id_idx     on public.cgm_readings(user_id);
create index if not exists cgm_readings_timestamp_idx   on public.cgm_readings(timestamp);
create index if not exists meal_logs_user_id_idx           on public.meal_logs(user_id);
create index if not exists manual_glucose_user_id_idx      on public.manual_glucose(user_id);
create index if not exists whatsapp_links_user_id_idx      on public.user_whatsapp_links(user_id);
create index if not exists whatsapp_links_link_code_idx    on public.user_whatsapp_links(link_code);
create index if not exists whatsapp_links_phone_idx        on public.user_whatsapp_links(whatsapp_number);
