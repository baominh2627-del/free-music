-- Pink Tune public catalog, administrator, and approved-uploader roles.
-- Create a public Storage bucket named "pink-tune-music" in the dashboard first.

create table if not exists public.pink_tune_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.pink_tune_uploaders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.pink_tune_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  storage_path text not null unique,
  cover_path text,
  uploader_id uuid references auth.users(id) on delete set null,
  duration_seconds integer,
  file_size bigint not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

-- Keep reruns safe when upgrading a database created from an earlier schema.
alter table public.pink_tune_tracks
  add column if not exists cover_path text,
  add column if not exists uploader_id uuid references auth.users(id) on delete set null;

alter table public.pink_tune_admins enable row level security;
alter table public.pink_tune_uploaders enable row level security;
alter table public.pink_tune_tracks enable row level security;
revoke all on public.pink_tune_uploaders from anon, authenticated;

create or replace function public.is_pink_tune_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pink_tune_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_pink_tune_admin() from public, anon;
grant execute on function public.is_pink_tune_admin() to authenticated;

create or replace function public.can_upload_pink_tune()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_pink_tune_admin() or exists (
    select 1 from public.pink_tune_uploaders
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.can_upload_pink_tune() from public, anon;
grant execute on function public.can_upload_pink_tune() to authenticated;

grant select on public.pink_tune_tracks to anon, authenticated;
grant insert, update, delete on public.pink_tune_tracks to authenticated;

drop policy if exists "Anyone can read published Pink Tune tracks" on public.pink_tune_tracks;
create policy "Anyone can read published Pink Tune tracks"
  on public.pink_tune_tracks for select to anon, authenticated
  using (is_published = true);

drop policy if exists "Pink Tune admins can add tracks" on public.pink_tune_tracks;
drop policy if exists "Pink Tune approved uploaders can add tracks" on public.pink_tune_tracks;
create policy "Pink Tune approved uploaders can add tracks"
  on public.pink_tune_tracks for insert to authenticated
  with check (
    public.can_upload_pink_tune()
    and uploader_id = (select auth.uid())
  );

drop policy if exists "Pink Tune admins can edit tracks" on public.pink_tune_tracks;
create policy "Pink Tune admins can edit tracks"
  on public.pink_tune_tracks for update to authenticated
  using (public.is_pink_tune_admin())
  with check (public.is_pink_tune_admin());

drop policy if exists "Pink Tune admins can delete tracks" on public.pink_tune_tracks;
create policy "Pink Tune admins can delete tracks"
  on public.pink_tune_tracks for delete to authenticated
  using (public.is_pink_tune_admin());

drop policy if exists "Pink Tune admins can upload audio" on storage.objects;
drop policy if exists "Pink Tune approved uploaders can upload audio" on storage.objects;
create policy "Pink Tune approved uploaders can upload audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pink-tune-music'
    and public.can_upload_pink_tune()
  );

drop policy if exists "Pink Tune admins can delete audio" on storage.objects;
create policy "Pink Tune admins can delete audio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pink-tune-music'
    and public.is_pink_tune_admin()
  );

-- Public profile photos and community song cover artwork.
alter table public.pink_tune_tracks
  add column if not exists cover_path text,
  add column if not exists uploader_id uuid references auth.users(id) on delete set null;

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
