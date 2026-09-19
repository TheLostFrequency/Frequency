-- Frequency database + private storage setup
create extension if not exists pgcrypto;

-- ============================================================
-- 1. PRIVATE MUSIC LIBRARY
-- ============================================================

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null,
  album text,
  genre text,
  year integer,
  duration numeric,
  audio_path text not null,
  cover_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer not null default 0,
  primary key (playlist_id, track_id)
);

alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

drop policy if exists "tracks own rows" on public.tracks;
create policy "tracks own rows" on public.tracks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "playlists own rows" on public.playlists;
create policy "playlists own rows" on public.playlists
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "playlist tracks own playlists" on public.playlist_tracks;
create policy "playlist tracks own playlists" on public.playlist_tracks
for all
using (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.playlists p
    where p.id = playlist_id
      and p.user_id = auth.uid()
  )
);

-- ============================================================
-- 2. PRIVATE STORAGE
-- ============================================================

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', false)
on conflict (id) do nothing;

drop policy if exists "frequency audio access" on storage.objects;
create policy "frequency audio access" on storage.objects
for all
using (
  bucket_id = 'audio'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'audio'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "frequency covers access" on storage.objects;
create policy "frequency covers access" on storage.objects
for all
using (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 3. FREQUENCY USERNAMES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$')
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are searchable" on public.profiles;
create policy "profiles are searchable" on public.profiles
for select to authenticated
using (true);

drop policy if exists "profiles own row" on public.profiles;
create policy "profiles own row" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles own updates" on public.profiles;
create policy "profiles own updates" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ============================================================
-- 4. PRIVATE PERSON-TO-PERSON TRANSMISSIONS
-- ============================================================

-- Create the table for a new database.
create table if not exists public.transmissions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  track_id uuid references public.tracks(id) on delete set null,
  title text not null,
  artist text not null,
  album text,
  audio_path text not null,
  cover_path text,
  message text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Migration for an existing transmissions table created by an
-- earlier version of Frequency. CREATE TABLE IF NOT EXISTS does
-- not add columns to an existing table, so explicitly add the
-- Transmission track reference when it is missing.
alter table public.transmissions
  add column if not exists track_id uuid;

-- Add the foreign key only when the existing database does not
-- already have one for transmissions.track_id.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.transmissions'::regclass
      and conname = 'transmissions_track_id_fkey'
  ) then
    alter table public.transmissions
      add constraint transmissions_track_id_fkey
      foreign key (track_id)
      references public.tracks(id)
      on delete set null;
  end if;
end $$;

alter table public.transmissions enable row level security;

drop policy if exists "transmissions sender insert" on public.transmissions;
create policy "transmissions sender insert" on public.transmissions
for insert to authenticated
with check (
  auth.uid() = sender_id
  and sender_id <> recipient_id
  and exists (
    select 1
    from public.tracks tr
    where tr.id = public.transmissions.track_id
      and tr.user_id = auth.uid()
      and tr.audio_path = public.transmissions.audio_path
      and tr.cover_path is not distinct from public.transmissions.cover_path
  )
);

drop policy if exists "transmissions participants read" on public.transmissions;
create policy "transmissions participants read" on public.transmissions
for select to authenticated
using (
  auth.uid() = sender_id
  or auth.uid() = recipient_id
);

drop policy if exists "transmissions recipient read state" on public.transmissions;
create policy "transmissions recipient read state" on public.transmissions
for update to authenticated
using (auth.uid() = recipient_id)
with check (auth.uid() = recipient_id);

-- ============================================================
-- 5. TRANSMITTED FILE ACCESS
-- ============================================================

drop policy if exists "frequency transmitted audio access" on storage.objects;
create policy "frequency transmitted audio access" on storage.objects
for select to authenticated
using (
  bucket_id = 'audio'
  and exists (
    select 1
    from public.transmissions t
    where t.recipient_id = auth.uid()
      and t.audio_path = storage.objects.name
  )
);

drop policy if exists "frequency transmitted covers access" on storage.objects;
create policy "frequency transmitted covers access" on storage.objects
for select to authenticated
using (
  bucket_id = 'covers'
  and exists (
    select 1
    from public.transmissions t
    where t.recipient_id = auth.uid()
      and t.cover_path = storage.objects.name
  )
);

-- ============================================================
-- 6. INDEXES
-- ============================================================

create index if not exists transmissions_recipient_created_idx
  on public.transmissions (recipient_id, created_at desc);

create index if not exists transmissions_sender_created_idx
  on public.transmissions (sender_id, created_at desc);

create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ============================================================
-- IMPORTANT
-- ============================================================
-- Transmission is PRIVATE person-to-person sharing only.
-- There is no public song feed and no public song upload table.
-- Songs remain private to their owner.
