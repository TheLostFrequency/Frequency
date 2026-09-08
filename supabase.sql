-- Frequency database + private storage setup
create extension if not exists pgcrypto;

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
create policy "tracks own rows" on public.tracks for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "playlists own rows" on public.playlists;
create policy "playlists own rows" on public.playlists for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "playlist tracks own playlists" on public.playlist_tracks;
create policy "playlist tracks own playlists" on public.playlist_tracks for all
using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()));

insert into storage.buckets (id, name, public)
values ('audio','audio',false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('covers','covers',false)
on conflict (id) do nothing;

drop policy if exists "frequency audio access" on storage.objects;
create policy "frequency audio access" on storage.objects for all
using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "frequency covers access" on storage.objects;
create policy "frequency covers access" on storage.objects for all
using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);
