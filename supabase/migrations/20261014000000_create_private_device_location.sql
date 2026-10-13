create table if not exists public.device_location_current (
  id text primary key default 'personal-iphone',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.device_location_current enable row level security;
revoke all on public.device_location_current from anon, authenticated;
