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
grant select,insert on public.friend_requests to authenticated;
grant update(status) on public.friend_requests to authenticated;
grant select,insert on public.messages to authenticated;


-- غرف اللعب الجماعي أونلاين ومزامنة الحالة بين الأجهزة
create table if not exists public.game_rooms (
 id uuid primary key default gen_random_uuid(),
 room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
 room_name text not null check (char_length(room_name) between 1 and 32),
 game_key text not null check (game_key in ('who','number','liar','most','yesno','snakes','domino','tavla','colors','quiz')),
 host_id uuid not null references auth.users(id) on delete cascade,
 max_players integer not null default 6 check (max_players between 2 and 16),
 status text not null default 'waiting' check (status in ('waiting','playing','finished')),
 game_state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists game_rooms_status_created_idx on public.game_rooms(status,created_at desc);

create table if not exists public.game_room_players (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.game_rooms(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null check (char_length(display_name) between 2 and 24),
 seat integer not null default 0 check (seat between 0 and 15),
 joined_at timestamptz not null default now(),
 unique(room_id,user_id),
 unique(room_id,seat)
);
create index if not exists game_room_players_room_idx on public.game_room_players(room_id,seat);

alter table public.game_rooms enable row level security;
alter table public.game_room_players enable row level security;
drop policy if exists "authenticated can read game rooms" on public.game_rooms;
create policy "authenticated can read game rooms" on public.game_rooms for select to authenticated using(true);
drop policy if exists "host creates game room" on public.game_rooms;
create policy "host creates game room" on public.game_rooms for insert to authenticated with check(auth.uid()=host_id);
drop policy if exists "room members update game room" on public.game_rooms;
create policy "room members update game room" on public.game_rooms for update to authenticated
 using(host_id=auth.uid() or exists(select 1 from public.game_room_players p where p.room_id=game_rooms.id and p.user_id=auth.uid()))
 with check(host_id=auth.uid() or exists(select 1 from public.game_room_players p where p.room_id=game_rooms.id and p.user_id=auth.uid()));
drop policy if exists "authenticated can read room players" on public.game_room_players;
create policy "authenticated can read room players" on public.game_room_players for select to authenticated using(true);
drop policy if exists "players join waiting rooms as self" on public.game_room_players;
create policy "players join waiting rooms as self" on public.game_room_players for insert to authenticated
 with check(user_id=auth.uid() and exists(select 1 from public.game_rooms r where r.id=room_id and r.status='waiting'));
drop policy if exists "players update own room seat" on public.game_room_players;
create policy "players update own room seat" on public.game_room_players for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "players leave own room" on public.game_room_players;
create policy "players leave own room" on public.game_room_players for delete to authenticated using(user_id=auth.uid());
grant select,insert,update on public.game_rooms to authenticated;
grant select,insert,update,delete on public.game_room_players to authenticated;

-- أضف الجداول إلى بث Realtime مرة واحدة حتى تتحدث الغرف عند كل تغيير.
do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_rooms') then
  alter publication supabase_realtime add table public.game_rooms;
 end if;
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_room_players') then
  alter publication supabase_realtime add table public.game_room_players;
 end if;
end $$;
