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
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select,insert on public.friend_requests to authenticated;
grant update(status) on public.friend_requests to authenticated;
grant select,insert on public.messages to authenticated;


-- غرف اللعب الجماعي أونلاين ومزامنة الحالة بين الأجهزة
create table if not exists public.game_rooms (
 id uuid primary key default gen_random_uuid(),
 room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
 room_name text not null check (char_length(room_name) between 1 and 32),
 game_key text not null check (game_key in ('who','number','liar','most','yesno','snakes','domino','tavla','colors','quiz','wheel')),
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


-- شات اللمة العام: سجل مشترك بين كل الأعضاء المسجلين.
create table if not exists public.public_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 500),
 created_at timestamptz not null default now()
);
create index if not exists public_messages_created_idx on public.public_messages(created_at desc);
alter table public.public_messages drop constraint if exists public_messages_body_check;
alter table public.public_messages add constraint public_messages_body_check check (char_length(btrim(body)) between 1 and 500);
create or replace function public.enforce_public_chat_rate_limit()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if char_length(btrim(new.body)) not between 1 and 500 then raise exception 'رسالة الشات يجب أن تكون بين حرف واحد و٥٠٠ حرف.'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.sender_id::text));
 if exists (select 1 from public.public_messages m where m.sender_id=new.sender_id and m.created_at>pg_catalog.now()-interval '2 seconds') then raise exception 'انتظر ثانيتين قبل إرسال رسالة أخرى.'; end if;
 return new;
end;
$$;
drop trigger if exists public_messages_rate_limit on public.public_messages;
create trigger public_messages_rate_limit before insert on public.public_messages for each row execute function public.enforce_public_chat_rate_limit();
alter table public.public_messages enable row level security;
drop policy if exists "members read public chat" on public.public_messages;
create policy "members read public chat" on public.public_messages for select to authenticated using(true);
drop policy if exists "members send public chat as self" on public.public_messages;
create policy "members send public chat as self" on public.public_messages for insert to authenticated with check(auth.uid()=sender_id);
grant select,insert on public.public_messages to authenticated;
do $$
begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='public_messages') then
  alter publication supabase_realtime add table public.public_messages;
 end if;
end $$;


-- ترحيل أمني إضافي للغرف والعلاقات (مكرر هنا لتجهيز قواعد البيانات الجديدة).
-- ترحيل إضافي محافظ على البيانات: لا يحذف جداول أو صفوفاً ولا يعيد إنشاءها.

create or replace function public.are_friends(a uuid,b uuid)
returns boolean
language sql stable security definer
set search_path=''
as $$
 select auth.uid() is not null
    and (auth.uid()=a or auth.uid()=b)
    and exists (
      select 1 from public.friend_requests r
      where r.status='accepted'
        and ((r.sender_id=a and r.receiver_id=b) or (r.sender_id=b and r.receiver_id=a))
    );
$$;
revoke all on function public.are_friends(uuid,uuid) from public;
grant execute on function public.are_friends(uuid,uuid) to authenticated;

-- منع الطلبات المتعاكسة المكررة، مع إبقاء السجلات القديمة كما هي.
create or replace function public.prevent_duplicate_friend_pair()
returns trigger
language plpgsql security definer
set search_path=''
as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(
     least(new.sender_id::text,new.receiver_id::text)||':'||
     greatest(new.sender_id::text,new.receiver_id::text),0
   )
 );
 if exists (
   select 1 from public.friend_requests r
   where r.status in ('pending','accepted')
     and ((r.sender_id=new.sender_id and r.receiver_id=new.receiver_id)
       or (r.sender_id=new.receiver_id and r.receiver_id=new.sender_id))
 ) then
   raise exception 'طلب الصداقة موجود مسبقاً أو أنكما أصدقاء بالفعل.' using errcode='23505';
 end if;
 return new;
end;
$$;
drop trigger if exists friend_requests_prevent_duplicate_pair on public.friend_requests;
create trigger friend_requests_prevent_duplicate_pair
before insert on public.friend_requests
for each row execute function public.prevent_duplicate_friend_pair();

-- دالة داخلية آمنة لاستخدامها في سياسات RLS دون recursion على جدول اللاعبين.
create or replace function public.is_game_room_member(p_room_id uuid)
returns boolean
language sql stable security definer
set search_path=''
as $$
 select auth.uid() is not null and exists (
   select 1 from public.game_room_players p
   where p.room_id=p_room_id and p.user_id=auth.uid()
 );
$$;
revoke all on function public.is_game_room_member(uuid) from public;
grant execute on function public.is_game_room_member(uuid) to authenticated;

drop policy if exists "authenticated can read game rooms" on public.game_rooms;
drop policy if exists "host creates game room" on public.game_rooms;
drop policy if exists "room members update game room" on public.game_rooms;
drop policy if exists "authenticated can read room players" on public.game_room_players;
drop policy if exists "players join waiting rooms as self" on public.game_room_players;
drop policy if exists "players update own room seat" on public.game_room_players;
drop policy if exists "players leave own room" on public.game_room_players;

create policy "room members read game rooms" on public.game_rooms
for select to authenticated using (public.is_game_room_member(id));
create policy "room members read room players" on public.game_room_players
for select to authenticated using (public.is_game_room_member(room_id));

-- كل عمليات الكتابة تتم عبر RPCs ذرّية تتحقق من هوية اللاعب وسعة الغرفة.
create or replace function public.create_game_room(
 p_room_code text,p_room_name text,p_game_key text,p_max_players integer,p_game_state jsonb
)
returns public.game_rooms
language plpgsql security definer
set search_path=''
as $$
declare v_room public.game_rooms;
begin
 if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
 if p_room_code !~ '^[A-Z0-9]{6}$' then raise exception 'رمز الغرفة غير صالح.'; end if;
 if char_length(btrim(p_room_name)) not between 1 and 32 then raise exception 'اسم الغرفة غير صالح.'; end if;
 if p_max_players not between 2 and 16 then raise exception 'عدد اللاعبين غير صالح.'; end if;
 insert into public.game_rooms(room_code,room_name,game_key,host_id,max_players,status,game_state)
 values(upper(p_room_code),btrim(p_room_name),p_game_key,auth.uid(),p_max_players,'waiting',coalesce(p_game_state,'{}'::jsonb))
 returning * into v_room;
 insert into public.game_room_players(room_id,user_id,display_name,seat)
 values(v_room.id,auth.uid(),left(coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'display_name'),''),'ضيف الوناسة'),24),0);
 return v_room;
end;
$$;

create or replace function public.join_game_room(p_room_code text,p_display_name text)
returns public.game_rooms
language plpgsql security definer
set search_path=''
as $$
declare v_room public.game_rooms; v_count integer; v_seat integer; v_existing uuid;
begin
 if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
 select * into v_room from public.game_rooms
 where room_code=upper(btrim(p_room_code)) for update;
 if not found then raise exception 'ما لقينا غرفة بهالرمز.'; end if;
 select id into v_existing from public.game_room_players
 where room_id=v_room.id and user_id=auth.uid();
 if found then return v_room; end if;
 if v_room.status<>'waiting' then raise exception 'اللعبة بلشت أو الغرفة منتهية.'; end if;
 select count(*)::integer into v_count from public.game_room_players where room_id=v_room.id;
 if v_count>=v_room.max_players then raise exception 'الغرفة مكتملة.'; end if;
 select n into v_seat from generate_series(0,15) n
 where not exists(select 1 from public.game_room_players p where p.room_id=v_room.id and p.seat=n)
 order by n limit 1;
 if v_seat is null then raise exception 'ماكو مقعد متاح.'; end if;
 insert into public.game_room_players(room_id,user_id,display_name,seat)
 values(v_room.id,auth.uid(),left(btrim(p_display_name),24),v_seat);
 return v_room;
end;
$$;

create or replace function public.update_game_room_state(
 p_room_id uuid,p_game_state jsonb,p_status text default null,
 p_game_key text default null,p_expected_updated_at timestamptz default null
)
returns public.game_rooms
language plpgsql security definer
set search_path=''
as $$
declare v_room public.game_rooms; v_min integer;
begin
 if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
 select * into v_room from public.game_rooms where id=p_room_id for update;
 if not found then raise exception 'الغرفة غير موجودة.'; end if;
 if not public.is_game_room_member(p_room_id) then raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501'; end if;
 if p_expected_updated_at is not null and v_room.updated_at is distinct from p_expected_updated_at then
   raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
 end if;
 if (p_status is not null or p_game_key is not null) and v_room.host_id<>auth.uid() then
   raise exception 'هذه العملية للمضيف فقط.' using errcode='42501';
 end if;
 if p_status is not null and p_status not in ('waiting','playing','finished') then raise exception 'حالة الغرفة غير صالحة.'; end if;
 if p_status='playing' and v_room.status<>'playing' then
   v_min:=case v_room.game_key when 'liar' then 3 else 2 end;
   if (select count(*) from public.game_room_players where room_id=p_room_id)<v_min then
     raise exception 'عدد اللاعبين غير كافٍ لبدء هذه اللعبة.';
   end if;
 end if;
 update public.game_rooms
 set game_state=coalesce(p_game_state,game_state),
     status=coalesce(p_status,status),
     game_key=coalesce(p_game_key,game_key),
     updated_at=pg_catalog.now()
 where id=p_room_id returning * into v_room;
 return v_room;
end;
$$;

create or replace function public.leave_game_room(p_room_id uuid)
returns void
language plpgsql security definer
set search_path=''
as $$
declare v_room public.game_rooms;
begin
 if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
 select * into v_room from public.game_rooms where id=p_room_id for update;
 if not found then return; end if;
 if not public.is_game_room_member(p_room_id) then raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501'; end if;
 if v_room.host_id=auth.uid() then
   update public.game_rooms set status='finished',updated_at=pg_catalog.now() where id=p_room_id;
 else
   delete from public.game_room_players where room_id=p_room_id and user_id=auth.uid();
 end if;
end;
$$;

revoke all on function public.create_game_room(text,text,text,integer,jsonb) from public;
revoke all on function public.join_game_room(text,text) from public;
revoke all on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz) from public;
revoke all on function public.leave_game_room(uuid) from public;
grant execute on function public.create_game_room(text,text,text,integer,jsonb) to authenticated;
grant execute on function public.join_game_room(text,text) to authenticated;
grant execute on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz) to authenticated;
grant execute on function public.leave_game_room(uuid) to authenticated;

revoke insert,update,delete on public.game_rooms from authenticated;
revoke insert,update,delete on public.game_room_players from authenticated;
grant select on public.game_rooms to authenticated;
grant select on public.game_room_players to authenticated;

-- مزامنة الرسائل الخاصة فورياً أيضاً، دون المساس بالرسائل الموجودة.
do $$
begin
 if not exists (
   select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
 ) then
   alter publication supabase_realtime add table public.messages;
 end if;
end $$;
