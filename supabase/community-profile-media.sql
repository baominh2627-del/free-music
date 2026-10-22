-- Pink Tune shared profile photos and song artwork.
-- Run once in Supabase SQL Editor for the existing project.

begin;

alter table public.pink_tune_tracks
  add column if not exists cover_path text,
  add column if not exists uploader_id uuid references auth.users(id) on delete set null;

grant select on public.pink_tune_tracks to anon, authenticated;
grant insert on public.pink_tune_tracks to authenticated;

drop policy if exists "Pink Tune admins can add tracks" on public.pink_tune_tracks;
drop policy if exists "Pink Tune approved uploaders can add tracks" on public.pink_tune_tracks;
create policy "Pink Tune approved uploaders can add tracks"
  on public.pink_tune_tracks for insert to authenticated
  with check (
    public.can_upload_pink_tune()
    and uploader_id = (select auth.uid())
  );

create table if not exists public.pink_tune_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pink_tune_profiles enable row level security;
grant select on public.pink_tune_profiles to anon, authenticated;
grant insert, update on public.pink_tune_profiles to authenticated;

drop policy if exists "Anyone can read Pink Tune profiles" on public.pink_tune_profiles;
create policy "Anyone can read Pink Tune profiles"
  on public.pink_tune_profiles for select to anon, authenticated
  using (true);

drop policy if exists "Users can create their Pink Tune profile" on public.pink_tune_profiles;
create policy "Users can create their Pink Tune profile"
  on public.pink_tune_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update their Pink Tune profile" on public.pink_tune_profiles;
create policy "Users can update their Pink Tune profile"
  on public.pink_tune_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can upload their Pink Tune avatar" on storage.objects;
create policy "Users can upload their Pink Tune avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pink-tune-music'
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

commit;

