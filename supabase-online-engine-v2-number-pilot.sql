-- Engine v2 pilot: server-authoritative online number guessing.
-- Apply only AFTER supabase-online-room-hardening-phase1.sql.
-- Additive only: existing rooms, players, and legacy game state are preserved.
begin;

create table if not exists public.game_room_private_state (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  secret_state jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

create table if not exists public.game_room_engine_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  actor_id uuid not null,
  event_type text not null check (event_type in ('number_started','number_guess')),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists game_room_engine_events_room_created_idx
  on public.game_room_engine_events(room_id, created_at, id);

alter table public.game_room_private_state enable row level security;
alter table public.game_room_engine_events enable row level security;
revoke all on public.game_room_private_state from public, anon, authenticated;
revoke all on public.game_room_engine_events from public, anon, authenticated;
grant all on public.game_room_private_state to service_role;
grant all on public.game_room_engine_events to service_role;
grant usage, select on sequence public.game_room_engine_events_id_seq to service_role;

create or replace function public.engine_v2_start_number_game(
  p_room_id uuid,
  p_actor_id uuid,
  p_secret integer,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_count integer;
  v_state jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_secret not between 1 and 100 or p_expected_updated_at is null then
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
  if v_room.game_key<>'number' or v_room.status<>'waiting' then
    raise exception 'هذه الغرفة ليست جاهزة لبدء تخمين الرقم.';
  end if;
  select count(*)::integer into v_count from public.game_room_players where room_id=p_room_id;
  if v_count not between 2 and 8 or v_count>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة تخمين الرقم.';
  end if;

  v_state:=jsonb_build_object(
    'phase','playing','round',1,'turn',0,
    'scores','{}'::jsonb,'feed',jsonb_build_array('بدأت لعبة تخمين الرقم.'),
    'board',jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
  );

  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('number',p_secret))
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();

  update public.game_rooms
  set engine_version=2,status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'number_started',jsonb_build_object('game_key','number'));

  return v_room;
end;
$function$;

create or replace function public.engine_v2_guess_number(
  p_room_id uuid,
  p_actor_id uuid,
  p_guess integer,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
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
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_guess not between 1 and 100 or p_expected_updated_at is null then
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
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;

  select (secret_state->>'number')::integer into v_secret
  from public.game_room_private_state where room_id=p_room_id for update;
  if v_secret is null then raise exception 'سر الجولة غير متاح؛ أعد إنشاء الجولة.'; end if;

  select p.display_name into v_name
  from public.game_room_players p
  where p.room_id=p_room_id and p.user_id=p_actor_id;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  v_tries:=coalesce(v_board->'tries','{}'::jsonb);
  v_count:=coalesce((v_tries->>p_actor_id::text)::integer,0)+1;
  v_tries:=v_tries||jsonb_build_object(p_actor_id::text,v_count);
  v_won:=p_guess=v_secret;
  v_hint:=case when v_won then 'صحيح! أصبت الرقم.' when p_guess<v_secret then 'الرقم أكبر من تخمينك.' else 'الرقم أصغر من تخمينك.' end;
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

  update public.game_rooms
  set game_state=v_state,
      status=case when v_won then 'finished' else status end,
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'number_guess',
    jsonb_build_object('guess',p_guess,'attempt',v_count,'result',case when v_won then 'correct' when p_guess<v_secret then 'higher' else 'lower' end));

  if v_won then
    delete from public.game_room_private_state where room_id=p_room_id;
  end if;
  return v_room;
end;
$function$;

revoke all on function public.engine_v2_start_number_game(uuid,uuid,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_guess_number(uuid,uuid,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.engine_v2_start_number_game(uuid,uuid,integer,timestamptz) to service_role;
grant execute on function public.engine_v2_guess_number(uuid,uuid,integer,timestamptz) to service_role;

commit;
