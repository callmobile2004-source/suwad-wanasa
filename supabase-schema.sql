-- سَـوَاد وناسة: الحسابات والأصدقاء والرسائل
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
 display_name text not null check (char_length(display_name) between 2 and 24),
 friend_code text not null unique,
 created_at timestamptz not null default now()
);
create table if not exists public.friend_requests (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 receiver_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(),
 unique(sender_id,receiver_id), check(sender_id<>receiver_id)
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 receiver_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 1000),
 created_at timestamptz not null default now(), check(sender_id<>receiver_id)
);
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare u text; d text; c text;
begin
 u:=lower(coalesce(new.raw_user_meta_data->>'username','player_'||substr(new.id::text,1,8)));
 d:=coalesce(nullif(new.raw_user_meta_data->>'display_name',''),u);
 c:='WN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.profiles(id,username,display_name,friend_code) values(new.id,u,left(d,24),c);
 return new;
end; $$;
drop trigger if exists on_auth_user_created_suwad on auth.users;
create trigger on_auth_user_created_suwad after insert on auth.users for each row execute procedure public.handle_new_user();
create or replace function public.are_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.friend_requests r where r.status='accepted' and ((r.sender_id=a and r.receiver_id=b) or (r.sender_id=b and r.receiver_id=a))); $$;
alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;
drop policy if exists "profiles signed-in lookup" on public.profiles;
create policy "profiles signed-in lookup" on public.profiles for select to authenticated using(true);
drop policy if exists "profile owner updates own" on public.profiles;
create policy "profile owner updates own" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);
drop policy if exists "request sender creates" on public.friend_requests;
create policy "request sender creates" on public.friend_requests for insert to authenticated with check(auth.uid()=sender_id and sender_id<>receiver_id);
drop policy if exists "request participants read" on public.friend_requests;
create policy "request participants read" on public.friend_requests for select to authenticated using(auth.uid()=sender_id or auth.uid()=receiver_id);
drop policy if exists "receiver responds" on public.friend_requests;
create policy "receiver responds" on public.friend_requests for update to authenticated using(auth.uid()=receiver_id and status='pending') with check(auth.uid()=receiver_id and status in ('accepted','declined'));
drop policy if exists "friends read messages" on public.messages;
create policy "friends read messages" on public.messages for select to authenticated using((auth.uid()=sender_id or auth.uid()=receiver_id) and public.are_friends(sender_id,receiver_id));
drop policy if exists "friends send messages" on public.messages;
create policy "friends send messages" on public.messages for insert to authenticated with check(auth.uid()=sender_id and public.are_friends(sender_id,receiver_id));
grant usage on schema public to authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.friend_requests to authenticated;
grant select,insert on public.messages to authenticated;
