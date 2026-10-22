-- Adds approved uploader accounts without giving them admin-only edit/delete access.
create table if not exists public.pink_tune_uploaders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pink_tune_uploaders enable row level security;
revoke all on public.pink_tune_uploaders from anon, authenticated;

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

drop policy if exists "Pink Tune admins can add tracks" on public.pink_tune_tracks;
drop policy if exists "Pink Tune approved uploaders can add tracks" on public.pink_tune_tracks;
create policy "Pink Tune approved uploaders can add tracks"
  on public.pink_tune_tracks for insert to authenticated
  with check (public.can_upload_pink_tune());

drop policy if exists "Pink Tune admins can upload audio" on storage.objects;
drop policy if exists "Pink Tune approved uploaders can upload audio" on storage.objects;
create policy "Pink Tune approved uploaders can upload audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pink-tune-music'
    and public.can_upload_pink_tune()
  );
