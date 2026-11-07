-- Disposable PostgreSQL integration test. Runs only in GitHub Actions.
-- Reproduces the current Supabase social RLS model with synthetic accounts.
-- All database objects and test data are rolled back at the end.
\set ON_ERROR_STOP on
begin;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end
$$;

create schema auth;
create schema private;

create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default true
);

create or replace function auth.uid()
returns uuid language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  friend_code text not null unique,
  created_at timestamptz not null default now(),
  avatar_url text,
  equipped_title_id text,
  last_seen_at timestamptz
);

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique(sender_id,receiver_id),
  check(sender_id <> receiver_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check(sender_id <> receiver_id)
);

create table public.game_rooms (
  id uuid primary key,
  host_id uuid not null references public.profiles(id)
);

create table public.game_room_players (
  room_id uuid not null references public.game_rooms(id),
  user_id uuid not null references public.profiles(id),
  primary key(room_id,user_id)
);

create table public.game_room_missions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id),
  user_id uuid not null references public.profiles(id),
  round_no smallint not null default 1,
  mission_text text not null,
  bonus_points smallint not null default 0,
  status text not null default 'assigned',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  claimed_at timestamptz,
  verified_by uuid
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_username text;
  v_display text;
begin
  v_username := coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text,1,8));
  v_display := coalesce(new.raw_user_meta_data->>'display_name', v_username);
  insert into public.profiles(id,username,display_name,friend_code)
  values(new.id,v_username,left(v_display,24),'WN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
  return new;
end;
$$;

create trigger on_auth_user_created_suwad
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function private.are_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null
     and (auth.uid()=a or auth.uid()=b)
     and exists (
       select 1 from public.friend_requests r
       where r.status='accepted'
         and ((r.sender_id=a and r.receiver_id=b) or (r.sender_id=b and r.receiver_id=a))
     );
$$;

create or replace function private.is_game_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.messages enable row level security;
alter table public.game_room_missions enable row level security;

create policy "profiles signed-in lookup" on public.profiles
for select to authenticated using (true);
create policy "profile owner updates own" on public.profiles
for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);

create policy "request sender creates" on public.friend_requests
for insert to authenticated with check (auth.uid()=sender_id and sender_id<>receiver_id and status='pending');
create policy "request participants read" on public.friend_requests
for select to authenticated using (auth.uid()=sender_id or auth.uid()=receiver_id);
create policy "receiver responds" on public.friend_requests
for update to authenticated
using (auth.uid()=receiver_id and status='pending')
with check (auth.uid()=receiver_id and status in ('accepted','declined'));

create policy "friends read messages" on public.messages
for select to authenticated
using ((auth.uid()=sender_id or auth.uid()=receiver_id) and private.are_friends(sender_id,receiver_id));
create policy "friends send messages" on public.messages
for insert to authenticated
with check (auth.uid()=sender_id and private.are_friends(sender_id,receiver_id));
create policy "friends edit own private messages" on public.messages
for update to authenticated
using (auth.uid()=sender_id and private.are_friends(sender_id,receiver_id))
with check (auth.uid()=sender_id and private.are_friends(sender_id,receiver_id));
create policy "friends delete own private messages" on public.messages
for delete to authenticated
using (auth.uid()=sender_id and private.are_friends(sender_id,receiver_id));

create policy "players read only their own secret missions" on public.game_room_missions
for select to authenticated
using (user_id=auth.uid() and private.is_game_room_member(room_id));

grant usage on schema public,auth,private to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function private.are_friends(uuid,uuid), private.is_game_room_member(uuid) to authenticated;

-- Model the current broad profile grant first; the migration below must narrow it.
grant select on public.profiles to authenticated;
grant update(display_name,username,avatar_url,equipped_title_id) on public.profiles to authenticated;
grant select,insert on public.friend_requests to authenticated;
grant update(status) on public.friend_requests to authenticated;
grant select,insert,delete on public.messages to authenticated;
grant update(body) on public.messages to authenticated;
grant select on public.game_room_missions to authenticated;

insert into auth.users(id,raw_user_meta_data,is_anonymous) values
 ('00000000-0000-4000-8000-000000000001','{"username":"player_a","display_name":"لاعب أ"}',true),
 ('00000000-0000-4000-8000-000000000002','{"username":"player_b","display_name":"لاعب ب"}',true),
 ('00000000-0000-4000-8000-000000000003','{"username":"player_c","display_name":"لاعب ج"}',true);

insert into public.game_rooms(id,host_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-000000000001');
insert into public.game_room_players(room_id,user_id) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-000000000001'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-000000000002');
insert into public.game_room_missions(room_id,user_id,mission_text,bonus_points) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-aaaaaaaaaaaa','مهمة اللاعب أ',10),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-000000000002','مهمة اللاعب ب',10);

-- Apply the proposed least-privilege profile grant in the disposable database.
\ir ../supabase-profile-column-privacy-migration.sql

do $$
begin
  if has_table_privilege('authenticated','public.profiles','SELECT') then
    raise exception 'FAIL: broad table-level profile SELECT remains';
  end if;
  if not has_column_privilege('authenticated','public.profiles','friend_code','SELECT')
     or not has_column_privilege('authenticated','public.profiles','display_name','SELECT')
     or has_column_privilege('authenticated','public.profiles','last_seen_at','SELECT') then
    raise exception 'FAIL: profile column grants are incorrect';
  end if;
  if not has_column_privilege('authenticated','public.profiles','display_name','UPDATE') then
    raise exception 'FAIL: profile editing grant was broken';
  end if;
end
$$;

-- Account A: guest profile lookup, friend search, and request creation.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare n integer;
begin
  select count(*) into n from public.profiles
   where id='00000000-0000-4000-8000-000000000002'
     and username='player_b' and display_name='لاعب ب' and friend_code like 'WN-%';
  if n<>1 then raise exception 'FAIL: account A cannot find account B using public discovery fields'; end if;
  update public.profiles set display_name='لاعب أ مُحدّث' where id=auth.uid();
  if not found then raise exception 'FAIL: guest cannot update own profile'; end if;
  insert into public.friend_requests(sender_id,receiver_id,status)
  values(auth.uid(),'00000000-0000-4000-8000-000000000002','pending');
  begin
    execute 'select last_seen_at from public.profiles where id = auth.uid()';
    raise exception 'FAIL: private last_seen_at is readable directly';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

-- Account B: sees and accepts only the incoming request addressed to B.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare n integer;
begin
  select count(*) into n from public.friend_requests
   where sender_id='00000000-0000-4000-8000-000000000001' and receiver_id=auth.uid() and status='pending';
  if n<>1 then raise exception 'FAIL: receiver cannot read incoming friend request'; end if;
  update public.friend_requests set status='accepted'
   where sender_id='00000000-0000-4000-8000-000000000001' and receiver_id=auth.uid() and status='pending';
  if not found then raise exception 'FAIL: receiver cannot accept friend request'; end if;
  if not private.are_friends(auth.uid(),'00000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL: accepted friendship was not recognized';
  end if;
end
$$;
reset role;

-- Account A sends a DM. Account B reads it. Account C must not read, forge, edit, or delete it.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.messages(sender_id,receiver_id,body)
values(auth.uid(),'00000000-0000-4000-8000-000000000002','رسالة خاصة بين أ وب');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare n integer; v_id uuid;
begin
  select count(*) into n from public.messages
   where sender_id='00000000-0000-4000-8000-000000000001' and receiver_id=auth.uid();
  if n<>1 then raise exception 'FAIL: DM recipient cannot read message'; end if;
  update public.messages set body='محاولة تعديل غير مصرح بها'
   where sender_id='00000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'FAIL: recipient modified sender-owned message'; end if;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$
declare n integer;
begin
  select count(*) into n from public.messages;
  if n<>0 then raise exception 'FAIL: unrelated account can read private messages'; end if;
  begin
    insert into public.messages(sender_id,receiver_id,body)
    values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','رسالة مزورة');
    raise exception 'FAIL: unrelated account forged a private message';
  exception when insufficient_privilege then
    null;
  end;
  delete from public.messages where sender_id='00000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  if n<>0 then raise exception 'FAIL: unrelated account deleted another user message'; end if;
  select count(*) into n from public.friend_requests;
  if n<>0 then raise exception 'FAIL: unrelated account can read other users friend requests'; end if;
end
$$;
reset role;

-- Secret missions: A and B see only their own assignment; C sees none.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$
declare n integer;
begin
  select count(*) into n from public.game_room_missions;
  if n<>1 then raise exception 'FAIL: account A does not see exactly its own mission'; end if;
  begin
    update public.game_room_missions set mission_text='تغيير غير مصرح به';
    raise exception 'FAIL: authenticated user modified secret mission';
  exception when insufficient_privilege then
    null;
  end;
  begin
    delete from public.game_room_missions;
    raise exception 'FAIL: authenticated user deleted secret mission';
  exception when insufficient_privilege then
    null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$
declare n integer;
begin
  select count(*) into n from public.game_room_missions;
  if n<>1 then raise exception 'FAIL: account B does not see exactly its own mission'; end if;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$
declare n integer;
begin
  select count(*) into n from public.game_room_missions;
  if n<>0 then raise exception 'FAIL: non-member account C can read secret missions'; end if;
end
$$;
reset role;

-- Verify the guest profile trigger and retained profile editing after column hardening.
do $$
declare n integer;
begin
  select count(*) into n from public.profiles
   where id='00000000-0000-4000-8000-000000000003' and username='player_c';
  if n<>1 then raise exception 'FAIL: anonymous guest profile creation was broken'; end if;
end
$$;

select 'PASS: profile column privacy + friend discovery + guest profile + DM isolation + secret mission isolation' as result;
rollback;
