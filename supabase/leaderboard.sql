-- Step Quest leaderboards (Supabase / Postgres). Run this once in the Supabase SQL editor.
-- Then: Authentication → Sign In / Providers → turn ON "Allow anonymous sign-ins",
-- and put the project URL and anon key into js/00-config.js.
--
-- One row per player. Each player can only write their own row (row-level security keyed to their anonymous auth
-- user id); everyone can read rows that aren't hidden. Limits below reject obviously impossible numbers.

create table if not exists public.players (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 18),
  avatar       text check (char_length(avatar) <= 24),
  skin         text check (char_length(skin) <= 24),
  level        int  not null default 1 check (level between 1 and 80),
  streak       int  not null default 0 check (streak between 0 and 5000),
  streak_day   date,                          -- the last day the streak counted (a streak older than yesterday is broken)
  best_streak  int  not null default 0 check (best_streak between 0 and 5000),
  day_key      date,                          -- the player's local day
  steps_day    int  not null default 0 check (steps_day between 0 and 150000),
  week_key     date,                          -- Monday of the player's local week
  steps_week   int  not null default 0 check (steps_week between 0 and 1000000),
  month_key    date,                          -- the 1st of the player's local month
  steps_month  int  not null default 0 check (steps_month between 0 and 4000000),
  total_steps  bigint not null default 0 check (total_steps >= 0),
  ach_id       text check (char_length(ach_id) <= 24),
  ach_title    text check (char_length(ach_title) <= 40),
  ach_at       timestamptz,
  hidden       boolean not null default false,  -- moderation: set true to remove a player from every board
  updated_at   timestamptz not null default now()
);

alter table public.players enable row level security;

drop policy if exists "read visible players" on public.players;
create policy "read visible players" on public.players
  for select to anon, authenticated using (hidden = false or auth.uid() = id);

drop policy if exists "insert own row" on public.players;
create policy "insert own row" on public.players
  for insert to authenticated with check (auth.uid() = id and hidden = false);

drop policy if exists "update own row" on public.players;
create policy "update own row" on public.players
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "delete own row" on public.players;
create policy "delete own row" on public.players
  for delete to authenticated using (auth.uid() = id);

-- players can't un-hide themselves: only the service role (dashboard) changes `hidden`
create or replace function public.players_keep_hidden() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and auth.role() <> 'service_role' then new.hidden := old.hidden; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists players_keep_hidden on public.players;
create trigger players_keep_hidden before insert or update on public.players
  for each row execute function public.players_keep_hidden();

create index if not exists players_day   on public.players (day_key, steps_day desc);
create index if not exists players_week  on public.players (week_key, steps_week desc);
create index if not exists players_month on public.players (month_key, steps_month desc);
create index if not exists players_streak on public.players (streak_day, streak desc);
