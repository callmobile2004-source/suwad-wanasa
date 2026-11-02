-- Additive security hardening for the authoritative number-game engine.
-- Apply after supabase-schema.sql, supabase-room-security-migration.sql,
-- and the progression migrations. Existing rooms and player data are preserved.
begin;
alter table public.game_rooms add column if not exists game_started_at timestamptz;
alter table public.game_rooms add column if not exists engine_version smallint not null default 1 check (engine_version in (1,2));

create table if not exists public.game_room_private_state (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  secret_state jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
create table if not exists public.game_room_engine_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('number_started','number_restarted','number_guess')),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index if not exists game_room_engine_events_room_created_idx
  on public.game_room_engine_events(room_id,created_at desc);
create index if not exists game_room_engine_events_actor_rate_idx
  on public.game_room_engine_events(room_id,actor_id,event_type,created_at desc);
alter table public.game_room_private_state enable row level security;
alter table public.game_room_engine_events enable row level security;
revoke all on table public.game_room_private_state from public,anon,authenticated;
revoke all on table public.game_room_engine_events from public,anon,authenticated;
grant select,insert,update on table public.game_room_private_state to service_role;
grant select,insert,update on table public.game_room_engine_events to service_role;

create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;

create or replace function private.are_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select auth.uid() is not null
     and (auth.uid()=a or auth.uid()=b)
     and exists (
       select 1 from public.friend_requests r
       where r.status='accepted'
         and ((r.sender_id=a and r.receiver_id=b)
           or (r.sender_id=b and r.receiver_id=a))
     );
$function$;
revoke all on function private.are_friends(uuid,uuid) from public,anon,authenticated;
grant execute on function private.are_friends(uuid,uuid) to authenticated;

create or replace function private.is_game_room_member(p_room_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
  select auth.uid() is not null
     and exists (
       select 1 from public.game_room_players p
       where p.room_id=p_room_id and p.user_id=auth.uid()
     );
$function$;
revoke all on function private.is_game_room_member(uuid) from public,anon,authenticated;
grant execute on function private.is_game_room_member(uuid) to authenticated;

drop policy if exists "friends read messages" on public.messages;
create policy "friends read messages" on public.messages
for select to authenticated
using ((auth.uid()=sender_id or auth.uid()=receiver_id) and private.are_friends(sender_id,receiver_id));
drop policy if exists "friends send messages" on public.messages;
create policy "friends send messages" on public.messages
for insert to authenticated
with check (auth.uid()=sender_id and private.are_friends(sender_id,receiver_id));
drop policy if exists "room members read game rooms" on public.game_rooms;
create policy "room members read game rooms" on public.game_rooms
for select to authenticated using (private.is_game_room_member(id));
drop policy if exists "room members read room players" on public.game_room_players;
create policy "room members read room players" on public.game_room_players
for select to authenticated using (private.is_game_room_member(room_id));

create or replace function public.create_game_room(
  p_room_code text,p_room_name text,p_game_key text,p_max_players integer,p_game_state jsonb,p_display_name text
)
returns public.game_rooms language plpgsql security definer set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_min integer;
  v_max integer;
  v_name text;
  v_initial_state jsonb;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
  if p_room_code is null or p_room_code !~ '^[A-Z0-9]{6}$' then raise exception 'رمز الغرفة غير صالح.'; end if;
  if p_room_name is null or char_length(btrim(p_room_name)) not between 1 and 32 then raise exception 'اسم الغرفة غير صالح.'; end if;
  v_name:=btrim(coalesce(p_display_name,''));
  if char_length(v_name) not between 2 and 24 then raise exception 'اسم اللاعب يجب أن يكون بين حرفين و٢٤ حرفاً.'; end if;
  if jsonb_typeof(coalesce(p_game_state,'{}'::jsonb)) is distinct from 'object'
     or pg_catalog.pg_column_size(coalesce(p_game_state,'{}'::jsonb))>16384 then
    raise exception 'بيانات بداية الغرفة غير صالحة.';
  end if;

  case p_game_key
    when 'who' then v_min:=2; v_max:=12;
    when 'number' then v_min:=2; v_max:=8;
    when 'liar' then v_min:=3; v_max:=16;
    when 'most' then v_min:=2; v_max:=12;
    when 'yesno' then v_min:=2; v_max:=12;
    when 'snakes' then v_min:=2; v_max:=6;
    when 'domino' then v_min:=2; v_max:=4;
    when 'tavla' then v_min:=2; v_max:=2;
    when 'colors' then v_min:=2; v_max:=8;
    when 'quiz' then v_min:=2; v_max:=12;
    when 'wheel' then v_min:=2; v_max:=16;
    else raise exception 'اللعبة المطلوبة غير معروفة.';
  end case;
  if p_max_players is null or p_max_players not between v_min and v_max then
    raise exception 'عدد اللاعبين لا يناسب اللعبة المختارة.';
  end if;

  if p_game_key='number' then
    v_initial_state:=jsonb_build_object(
      'phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('الغرفة جاهزة للعبة تخمين الرقم.'),
      'board',jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
    );
  else
    v_initial_state:=coalesce(p_game_state,'{}'::jsonb);
  end if;

  insert into public.game_rooms(room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(upper(p_room_code),btrim(p_room_name),p_game_key,auth.uid(),p_max_players,'waiting',
         v_initial_state,case when p_game_key='number' then 2 else 1 end)
  returning * into v_room;
  insert into public.game_room_players(room_id,user_id,display_name,seat)
  values(v_room.id,auth.uid(),v_name,0);
  return v_room;
end;
$function$;

create or replace function public.leave_game_room(p_room_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_next_host uuid;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then return; end if;
  if not private.is_game_room_member(p_room_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if v_room.host_id=auth.uid() then
    select user_id into v_next_host
    from public.game_room_players
    where room_id=p_room_id and user_id<>auth.uid()
    order by seat asc limit 1;
    update public.game_rooms
    set host_id=coalesce(v_next_host,host_id),
        status=case when v_next_host is null then 'finished' else status end,
        game_state=case when game_key='wheel' then
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(coalesce(game_state,'{}'::jsonb),'{board,spinning}','false'::jsonb,true),
                '{board,result}','null'::jsonb,true),
              '{board,stage}','"arena"'::jsonb,true),
            '{board,rotation}',coalesce(game_state#>'{board,startRotation}',game_state#>'{board,rotation}','0'::jsonb),true)
          else game_state end,
        updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id;
  end if;
  delete from public.game_room_players where room_id=p_room_id and user_id=auth.uid();
end;
$function$;

create or replace function public.update_game_room_state(
  p_room_id uuid,p_game_state jsonb,p_status text default null,p_game_key text default null,
  p_expected_updated_at timestamptz default null
)
returns public.game_rooms language plpgsql security definer set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_min integer;
  v_max integer;
  v_count integer;
  v_target_game text;
  v_safe_state jsonb;
begin
  if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
  if p_expected_updated_at is null then
    raise exception 'يلزم إرسال إصدار حالة الغرفة لمنع الكتابة فوق تحديث لاعب آخر.' using errcode='22023';
  end if;
  if p_game_state is null or jsonb_typeof(p_game_state) is distinct from 'object'
     or pg_catalog.pg_column_size(p_game_state)>65536 then
    raise exception 'حالة اللعبة غير صالحة أو أكبر من الحد المسموح.';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if not private.is_game_room_member(p_room_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if v_room.game_key='number' or v_room.engine_version>=2 then
    raise exception 'هذه اللعبة تعمل بمحرك خادمي؛ نفّذ الحركة عبر أمر اللعبة المعتمد.' using errcode='42501';
  end if;
  if v_room.status='finished' then raise exception 'الغرفة منتهية ولا تقبل تحديثات جديدة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
  end if;

  v_target_game:=coalesce(p_game_key,v_room.game_key);
  if v_target_game is distinct from v_room.game_key then
    if v_room.game_key<>'wheel' or v_room.status<>'playing'
       or p_status is distinct from 'waiting' or v_room.host_id<>auth.uid() then
      raise exception 'لا يمكن تغيير اللعبة بهذه الحالة.' using errcode='42501';
    end if;
    case v_target_game
      when 'who' then v_min:=2; v_max:=12;
      when 'number' then v_min:=2; v_max:=8;
      when 'liar' then v_min:=3; v_max:=16;
      when 'most' then v_min:=2; v_max:=12;
      when 'yesno' then v_min:=2; v_max:=12;
      when 'snakes' then v_min:=2; v_max:=6;
      when 'domino' then v_min:=2; v_max:=4;
      when 'tavla' then v_min:=2; v_max:=2;
      when 'colors' then v_min:=2; v_max:=8;
      when 'quiz' then v_min:=2; v_max:=12;
      else raise exception 'اللعبة المختارة من الدولاب غير صالحة.';
    end case;
    select count(*)::integer into v_count from public.game_room_players where room_id=p_room_id;
    if v_count not between v_min and v_max then
      raise exception 'عدد اللاعبين الحالي لا يناسب اللعبة المختارة.';
    end if;
  elsif p_status is not null and p_status is distinct from v_room.status then
    if v_room.host_id<>auth.uid() then
      raise exception 'بدء الجولة وإنهاؤها من صلاحية المضيف فقط.' using errcode='42501';
    end if;
    if not ((v_room.status='waiting' and p_status='playing')
         or (v_room.status='playing' and p_status='finished')) then
      raise exception 'انتقال حالة الغرفة غير مسموح.';
    end if;
  elsif p_status is not null and p_status not in ('waiting','playing','finished') then
    raise exception 'حالة الغرفة غير صالحة.';
  end if;

  if p_status='playing' and v_room.status='waiting' then
    v_min:=case v_target_game when 'liar' then 3 else 2 end;
    if (select count(*) from public.game_room_players where room_id=p_room_id)<v_min then
      raise exception 'عدد اللاعبين غير كافٍ لبدء هذه اللعبة.';
    end if;
  end if;

  if v_target_game='number' then
    v_safe_state:=jsonb_build_object(
      'phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',case when jsonb_typeof(p_game_state->'feed')='array'
        then p_game_state->'feed' else jsonb_build_array('اختيرت لعبة تخمين الرقم من الدولاب.') end,
      'board',jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
    );
  else
    v_safe_state:=p_game_state;
  end if;

  update public.game_rooms
  set game_state=v_safe_state,
      status=coalesce(p_status,status),
      game_key=v_target_game,
      engine_version=case when v_target_game='number' then 2 else 1 end,
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  return v_room;
end;
$function$;

create or replace function public.engine_v2_start_number_game(
  p_room_id uuid,p_actor_id uuid,p_secret integer,p_expected_updated_at timestamptz
)
returns public.game_rooms language plpgsql security definer set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_count integer;
  v_state jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_secret is null or p_secret not between 1 and 100
     or p_expected_updated_at is null then
    raise exception 'Invalid engine start request.' using errcode='22023';
  end if;
  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'بدء اللعبة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if v_room.engine_version not in (1,2) or v_room.game_key<>'number' or v_room.status<>'waiting' then
    raise exception 'هذه الغرفة ليست جاهزة لمحرك تخمين الرقم.';
  end if;
  select count(*)::integer into v_count from public.game_room_players where room_id=p_room_id;
  if v_count not between 2 and 8 or v_count>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة تخمين الرقم.';
  end if;
  v_state:=jsonb_build_object(
    'phase','playing','round',1,'turn',0,'scores','{}'::jsonb,
    'feed',jsonb_build_array('بدأت لعبة تخمين الرقم.'),
    'board',jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
  );
  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('number',p_secret))
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();
  update public.game_rooms
  set engine_version=2,status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'number_started',jsonb_build_object('game_key','number'));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_guess_number(
  p_room_id uuid,p_actor_id uuid,p_guess integer,p_expected_updated_at timestamptz
)
returns public.game_rooms language plpgsql security definer set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_secret integer;
  v_count integer;
  v_hint text;
  v_name text;
  v_tries jsonb;
  v_feed jsonb;
  v_board jsonb;
  v_state jsonb;
  v_won boolean;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_guess is null or p_guess not between 1 and 100
     or p_expected_updated_at is null then
    raise exception 'أدخل رقماً من ١ إلى ١٠٠.' using errcode='22023';
  end if;
  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة اللعبة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'number' or v_room.status<>'playing' then
    raise exception 'محرك تخمين الرقم غير نشط لهذه الغرفة.';
  end if;
  if not exists (select 1 from public.game_room_players p
                 where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if exists (
    select 1 from public.game_room_engine_events e
    where e.room_id=p_room_id and e.actor_id=p_actor_id
      and e.event_type='number_guess'
      and e.created_at>pg_catalog.clock_timestamp()-interval '750 milliseconds'
  ) then
    raise exception 'تمهّل قليلاً قبل التخمين التالي.' using errcode='P0001';
  end if;
  select (secret_state->>'number')::integer into v_secret
  from public.game_room_private_state where room_id=p_room_id for update;
  if v_secret is null then raise exception 'سر الجولة غير متاح؛ أعد إنشاء الجولة.'; end if;
  select p.display_name into v_name from public.game_room_players p
  where p.room_id=p_room_id and p.user_id=p_actor_id;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  v_tries:=coalesce(v_board->'tries','{}'::jsonb);
  v_count:=coalesce((v_tries->>p_actor_id::text)::integer,0)+1;
  v_tries:=v_tries||jsonb_build_object(p_actor_id::text,v_count);
  v_won:=p_guess=v_secret;
  v_hint:=case when v_won then 'صحيح! أصبت الرقم.'
    when p_guess<v_secret then 'الرقم أكبر من تخمينك.'
    else 'الرقم أصغر من تخمينك.' end;
  v_feed:=coalesce(v_room.game_state->'feed','[]'::jsonb)
    ||jsonb_build_array(v_name||' خمّن '||p_guess||'، '||v_hint);
  v_board:=jsonb_set(v_board,'{tries}',v_tries,true);
  v_board:=jsonb_set(v_board,'{hint}',to_jsonb(v_hint),true);
  v_board:=jsonb_set(v_board,'{last_guess}',to_jsonb(p_guess),true);
  v_board:=jsonb_set(v_board,'{last_guess_by}',to_jsonb(p_actor_id::text),true);
  if v_won then
    v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
    v_board:=jsonb_set(v_board,'{revealed_number}',to_jsonb(v_secret),true);
  end if;
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',v_feed,true);
  if v_won then v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true); end if;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'number_guess',
    jsonb_build_object('guess',p_guess,'attempt',v_count,
      'result',case when v_won then 'correct' when p_guess<v_secret then 'higher' else 'lower' end));
  update public.game_rooms
  set game_state=v_state,status=case when v_won then 'finished' else status end,
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  if v_won then delete from public.game_room_private_state where room_id=p_room_id; end if;
  return v_room;
end;
$function$;

create or replace function public.engine_v2_restart_number_game(
  p_room_id uuid,p_actor_id uuid,p_secret integer,p_expected_updated_at timestamptz
)
returns public.game_rooms language plpgsql security definer set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_count integer;
  v_round integer;
  v_state jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_secret is null or p_secret not between 1 and 100
     or p_expected_updated_at is null then
    raise exception 'Invalid engine restart request.' using errcode='22023';
  end if;
  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'إعادة الجولة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if v_room.engine_version not in (1,2) or v_room.game_key<>'number' or v_room.status<>'finished' then
    raise exception 'لا يمكن إعادة الجولة بهذه الحالة.';
  end if;
  select count(*)::integer into v_count from public.game_room_players where room_id=p_room_id;
  if v_count not between 2 and 8 or v_count>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة تخمين الرقم.';
  end if;
  if not exists (select 1 from public.game_room_players where room_id=p_room_id and user_id=p_actor_id) then
    raise exception 'المضيف لم يعد عضواً في الغرفة.' using errcode='42501';
  end if;
  v_round:=coalesce((v_room.game_state->>'round')::integer,1)+1;
  v_state:=jsonb_build_object(
    'phase','playing','round',v_round,'turn',0,'scores','{}'::jsonb,
    'feed',jsonb_build_array('بدأت جولة جديدة من تخمين الرقم.'),
    'board',jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
  );
  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('number',p_secret))
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();
  update public.game_rooms
  set engine_version=2,status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'number_restarted',jsonb_build_object('round',v_round));
  return v_room;
end;
$function$;

-- Awards for number-game completion require a matching server event and secret.
create or replace function public.award_completed_room_progress()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare
  v_player record;
  v_games integer;
  v_inserted integer;
  v_board jsonb;
  v_event record;
  v_secret text;
begin
  if old.status is distinct from 'playing'
     or new.status is distinct from 'finished'
     or new.engine_version<>2 or new.game_key<>'number'
     or new.game_state->>'phase' is distinct from 'finished'
     or new.game_started_at is null then
    return new;
  end if;
  v_board:=new.game_state->'board';
  if jsonb_typeof(v_board) is distinct from 'object' then return new; end if;
  select e.actor_id,e.event_payload into v_event
  from public.game_room_engine_events e
  where e.room_id=new.id and e.event_type='number_guess'
  order by e.id desc limit 1;
  if not found
     or v_event.event_payload->>'result' is distinct from 'correct'
     or v_event.actor_id::text is distinct from v_board->>'winner_id'
     or v_event.event_payload->>'guess' is distinct from v_board->>'revealed_number' then
    return new;
  end if;
  select s.secret_state->>'number' into v_secret
  from public.game_room_private_state s where s.room_id=new.id;
  if v_secret is null or v_secret is distinct from v_board->>'revealed_number' then return new; end if;
  if not exists (select 1 from public.game_room_players p where p.room_id=new.id and p.user_id=v_event.actor_id) then
    return new;
  end if;
  for v_player in select p.user_id from public.game_room_players p where p.room_id=new.id
  loop
    insert into public.player_game_history(room_id,user_id,game_key,xp_awarded)
    values(new.id,v_player.user_id,new.game_key,10)
    on conflict(room_id,user_id) do nothing;
    get diagnostics v_inserted=row_count;
    if v_inserted=1 then
      insert into public.player_progress(user_id,xp,games_completed,updated_at)
      values(v_player.user_id,10,1,pg_catalog.now())
      on conflict(user_id) do update
        set xp=public.player_progress.xp+10,
            games_completed=public.player_progress.games_completed+1,
            updated_at=pg_catalog.now()
      returning games_completed into v_games;
      insert into public.player_achievements(user_id,achievement_id)
      select v_player.user_id,a.id from public.achievements a
      where a.requirement_games<=v_games
      on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;
  return new;
end;
$function$;

revoke all on function public.are_friends(uuid,uuid) from public,anon,authenticated;
revoke all on function public.is_game_room_member(uuid) from public,anon,authenticated;
drop function if exists public.are_friends(uuid,uuid);
drop function if exists public.is_game_room_member(uuid);

revoke all on function public.create_game_room(text,text,text,integer,jsonb,text) from public,anon;
revoke all on function public.join_game_room(text,text) from public,anon;
revoke all on function public.leave_game_room(uuid) from public,anon;
revoke all on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz) from public,anon;
grant execute on function public.create_game_room(text,text,text,integer,jsonb,text) to authenticated;
grant execute on function public.join_game_room(text,text) to authenticated;
grant execute on function public.leave_game_room(uuid) to authenticated;
grant execute on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz) to authenticated;

revoke all on function public.engine_v2_start_number_game(uuid,uuid,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_guess_number(uuid,uuid,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_restart_number_game(uuid,uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.engine_v2_start_number_game(uuid,uuid,integer,timestamptz) to service_role;
grant execute on function public.engine_v2_guess_number(uuid,uuid,integer,timestamptz) to service_role;
grant execute on function public.engine_v2_restart_number_game(uuid,uuid,integer,timestamptz) to service_role;

revoke all on function public.award_completed_room_progress() from public,anon,authenticated;
commit;
