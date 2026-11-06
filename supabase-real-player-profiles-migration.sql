-- Real player profiles: avatars, public handles, earned free titles and secure equipment.
begin;

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists equipped_title_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_avatar_url_length_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_avatar_url_length_check
      check (avatar_url is null or char_length(avatar_url)<=2048);
  end if;
end $$;

create table if not exists public.profile_titles (
  id text primary key,
  title text not null check (char_length(title) between 2 and 32),
  description text not null check (char_length(description) between 5 and 180),
  icon text not null default '🏅',
  requirement_games integer not null default 0 check (requirement_games>=0),
  requirement_xp integer not null default 0 check (requirement_xp>=0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.player_titles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  title_id text not null references public.profile_titles(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  primary key (user_id,title_id)
);
create index if not exists player_titles_title_id_idx on public.player_titles(title_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_equipped_title_fkey' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_equipped_title_fkey
      foreign key (equipped_title_id) references public.profile_titles(id) on delete set null;
  end if;
end $$;

insert into public.profile_titles(id,title,description,icon,requirement_games,requirement_xp)
values
 ('first_lap','بداية اللمة','أكمل أول لعبة جماعية.','🌱',1,0),
 ('friendly_face','وجه الوناسة','أكمل خمس ألعاب مع الربع.','😊',5,0),
 ('party_star','نجم اللمة','أكمل عشر ألعاب.','⭐',10,0),
 ('party_legend','أسطورة الوناسة','أكمل خمساً وعشرين لعبة.','👑',25,0),
 ('party_leader','قائد اللمة','أكمل خمسين لعبة جماعية.','🏆',50,0),
 ('xp_collector','جامع النقاط','اجمع 250 نقطة خبرة.','💎',0,250),
 ('xp_master','خبير الوناسة','اجمع 500 نقطة خبرة.','🔥',0,500)
on conflict (id) do update set
 title=excluded.title,description=excluded.description,icon=excluded.icon,
 requirement_games=excluded.requirement_games,requirement_xp=excluded.requirement_xp,is_active=true;

alter table public.profile_titles enable row level security;
alter table public.player_titles enable row level security;

drop policy if exists "profile titles are readable" on public.profile_titles;
create policy "profile titles are readable" on public.profile_titles
  for select to authenticated using (is_active=true);

drop policy if exists "earned profile titles are readable" on public.player_titles;
create policy "earned profile titles are readable" on public.player_titles
  for select to authenticated using (true);

revoke all on public.profile_titles from anon, authenticated;
grant select on public.profile_titles to authenticated;
revoke all on public.player_titles from anon, authenticated;
grant select on public.player_titles to authenticated;

create or replace function public.sync_profile_titles_from_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.player_titles(user_id,title_id)
  select new.user_id,t.id
  from public.profile_titles t
  where t.is_active
    and new.games_completed>=t.requirement_games
    and new.xp>=t.requirement_xp
  on conflict (user_id,title_id) do nothing;
  return new;
end;
$$;

drop trigger if exists sync_profile_titles_after_progress on public.player_progress;
create trigger sync_profile_titles_after_progress
  after insert or update of games_completed,xp on public.player_progress
  for each row execute function public.sync_profile_titles_from_progress();

-- Backfill only titles already earned by existing progress; no XP or games are granted.
insert into public.player_titles(user_id,title_id)
select pp.user_id,t.id
from public.player_progress pp
cross join public.profile_titles t
where t.is_active
  and pp.games_completed>=t.requirement_games
  and pp.xp>=t.requirement_xp
on conflict (user_id,title_id) do nothing;

create or replace function public.validate_equipped_profile_title()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.equipped_title_id is not null and not exists (
    select 1 from public.player_titles pt
    where pt.user_id=new.id and pt.title_id=new.equipped_title_id
  ) then
    raise exception 'لا يمكن اختيار لقب لم يتم فتحه بعد.' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_equipped_profile_title on public.profiles;
create trigger validate_equipped_profile_title
  before insert or update of equipped_title_id on public.profiles
  for each row execute function public.validate_equipped_profile_title();

revoke all on function public.sync_profile_titles_from_progress() from public,anon,authenticated;
revoke all on function public.validate_equipped_profile_title() from public,anon,authenticated;

-- Preserve existing profile data and only widen the owner's editable columns.
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,username,avatar_url,equipped_title_id) on public.profiles to authenticated;

-- Public avatar reads; writes are restricted to the authenticated user's own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
 public=true,file_size_limit=3145728,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists "avatar owner uploads" on storage.objects;
create policy "avatar owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "avatar owner updates" on storage.objects;
create policy "avatar owner updates" on storage.objects
  for update to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

drop policy if exists "avatar owner deletes" on storage.objects;
create policy "avatar owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
