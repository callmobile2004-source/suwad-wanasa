-- Server-authoritative engine v2: private-role online "برا السالفة".
-- Apply after room hardening, number, Most, Quiz, and Yes/No migrations.
-- Secret word, outsider identity, hints-in-progress, and votes stay server-side.
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
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists game_room_engine_events_room_created_idx
  on public.game_room_engine_events(room_id,created_at,id);

alter table public.game_room_engine_events
  drop constraint if exists game_room_engine_events_event_type_check;
alter table public.game_room_engine_events
  add constraint game_room_engine_events_event_type_check
  check (event_type in (
    'number_started','number_restarted','number_guess',
    'most_started','most_vote','most_question','most_finished','most_restarted','most_player_left',
    'quiz_started','quiz_answer','quiz_question','quiz_finished','quiz_restarted','quiz_player_left',
    'yesno_started','yesno_answer','yesno_question','yesno_finished','yesno_restarted','yesno_player_left',
    'liar_started','liar_hint','liar_vote','liar_finished','liar_restarted','liar_player_left'
  ));

alter table public.game_room_private_state enable row level security;
alter table public.game_room_engine_events enable row level security;
revoke all on public.game_room_private_state from public,anon,authenticated;
revoke all on public.game_room_engine_events from public,anon,authenticated;
grant all on public.game_room_private_state to service_role;
grant all on public.game_room_engine_events to service_role;
grant usage,select on sequence public.game_room_engine_events_id_seq to service_role;

create or replace function public.engine_v2_start_liar_game(
  p_room_id uuid,
  p_actor_id uuid,
  p_secret_word text,
  p_category text,
  p_outsider_id uuid,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_total integer;
  v_scores jsonb;
  v_state jsonb;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_outsider_id is null
     or p_secret_word is null or char_length(btrim(p_secret_word)) not between 2 and 60
     or p_category is null or char_length(btrim(p_category)) not between 2 and 40
     or p_expected_updated_at is null then
    raise exception 'بيانات بدء برا السالفة غير صالحة.' using errcode='22023';
  end if;

  select * into v_room
  from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'بدء اللعبة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'المضيف لم يعد عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'liar' or v_room.status<>'waiting' then
    raise exception 'هذه الغرفة ليست جاهزة لمحرك برا السالفة.';
  end if;

  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;
  if v_total not between 3 and 16 or v_total>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب برا السالفة.';
  end if;
  if not exists(
    select 1 from public.game_room_players
    where room_id=p_room_id and user_id=p_outsider_id
  ) then
    raise exception 'لاعب الدور الغريب غير موجود في الغرفة.' using errcode='22023';
  end if;

  select coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
    into v_scores
  from public.game_room_players p where p.room_id=p_room_id;

  v_state:=jsonb_build_object(
    'phase','playing','round',1,'turn',0,'scores',v_scores,
    'feed',jsonb_build_array('بدأت لعبة برا السالفة. كل لاعب يكتب تلميحاً واحداً.'),
    'board',jsonb_build_object(
      'phase','hints','category',btrim(p_category),
      'hint_count',0,'hint_total',v_total,
      'hints','[]'::jsonb,'vote_count',0,'vote_total',v_total,
      'tally','{}'::jsonb,'leaders','[]'::jsonb,
      'outsider_caught',null
    )
  );

  insert into public.game_room_private_state(room_id,secret_state)
  values(
    p_room_id,
    jsonb_build_object(
      'secret_word',btrim(p_secret_word),
      'category',btrim(p_category),
      'outsider_id',p_outsider_id::text,
      'hints','{}'::jsonb,
      'votes','{}'::jsonb
    )
  )
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();

  update public.game_rooms
  set engine_version=2,status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'liar_started',
    jsonb_build_object('players',v_total,'category',btrim(p_category)));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_get_liar_card(
  p_room_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_private jsonb;
  v_outsider boolean;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null then
    raise exception 'بيانات اللاعب غير صالحة.' using errcode='22023';
  end if;

  select * into v_room
  from public.game_rooms where id=p_room_id;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.engine_version<>2 or v_room.game_key<>'liar' or v_room.status<>'playing' then
    raise exception 'محرك برا السالفة غير نشط لهذه الغرفة.';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;

  select secret_state into v_private
  from public.game_room_private_state where room_id=p_room_id;
  if not found then raise exception 'البطاقة السرية غير متاحة.'; end if;

  v_outsider:=v_private->>'outsider_id'=p_actor_id::text;
  return jsonb_build_object(
    'is_outsider',v_outsider,
    'role',case when v_outsider then 'outsider' else 'insider' end,
    'secret_word',case when v_outsider then null else v_private->>'secret_word' end,
    'category',v_private->>'category',
    'has_submitted_hint',coalesce((v_private->'hints') ? p_actor_id::text,false),
    'has_voted',coalesce((v_private->'votes') ? p_actor_id::text,false)
  );
end;
$function$;

create or replace function public.engine_v2_submit_liar_hint(
  p_room_id uuid,
  p_actor_id uuid,
  p_hint text,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_private jsonb;
  v_hints jsonb;
  v_board jsonb;
  v_state jsonb;
  v_total integer;
  v_hint_count integer;
  v_public_hints jsonb;
  v_name text;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_hint is null
     or char_length(btrim(p_hint)) not between 1 and 100
     or p_expected_updated_at is null then
    raise exception 'اكتب تلميحاً من حرف إلى ١٠٠ حرف.' using errcode='22023';
  end if;

  select * into v_room
  from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'liar' or v_room.status<>'playing'
     or v_room.game_state->'board'->>'phase' is distinct from 'hints' then
    raise exception 'مرحلة التلميحات غير نشطة.';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  select secret_state into v_private
  from public.game_room_private_state where room_id=p_room_id for update;
  if not found then raise exception 'حالة اللعبة الخاصة غير متاحة.'; end if;

  select coalesce(jsonb_object_agg(h.key,h.value),'{}'::jsonb)
  into v_hints
  from jsonb_each(coalesce(v_private->'hints','{}'::jsonb)) h
  join public.game_room_players p
    on p.room_id=p_room_id and p.user_id::text=h.key;
  if v_hints ? p_actor_id::text then
    raise exception 'أرسلت تلميحك بالفعل.';
  end if;

  v_hints:=v_hints||jsonb_build_object(p_actor_id::text,btrim(p_hint));
  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;
  select count(*)::integer into v_hint_count from jsonb_object_keys(v_hints);
  select display_name into v_name
  from public.game_room_players where room_id=p_room_id and user_id=p_actor_id;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_hint_count>=v_total then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'player_id',p.user_id::text,
          'player_name',p.display_name,
          'hint',v_hints->>p.user_id::text
        ) order by p.seat
      ),
      '[]'::jsonb
    )
    into v_public_hints
    from public.game_room_players p
    where p.room_id=p_room_id and v_hints ? p.user_id::text;

    v_board:=v_board||jsonb_build_object(
      'phase','voting','hint_count',v_hint_count,'hint_total',v_total,
      'hints',v_public_hints,'vote_count',0,'vote_total',v_total
    );
  else
    v_board:=v_board||jsonb_build_object('hint_count',v_hint_count,'hint_total',v_total);
  end if;

  v_state:=v_room.game_state||jsonb_build_object(
    'board',v_board,
    'feed',coalesce(v_room.game_state->'feed','[]'::jsonb)
      ||jsonb_build_array(v_name||' أرسل تلميحه.')
  );

  update public.game_room_private_state
  set secret_state=jsonb_set(secret_state,'{hints}',v_hints,true),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=p_room_id;

  update public.game_rooms
  set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'liar_hint',jsonb_build_object('hint_length',char_length(btrim(p_hint))));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_vote_liar(
  p_room_id uuid,
  p_actor_id uuid,
  p_vote_target uuid,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_private jsonb;
  v_votes jsonb;
  v_tally jsonb:='{}'::jsonb;
  v_leaders jsonb:='[]'::jsonb;
  v_board jsonb;
  v_state jsonb;
  v_feed jsonb;
  v_scores jsonb;
  v_total integer;
  v_vote_count integer;
  v_max_votes integer:=0;
  v_outsider_id uuid;
  v_secret_word text;
  v_caught boolean:=false;
  v_player record;
  v_score integer;
  v_delta integer;
  v_name text;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_vote_target is null or p_expected_updated_at is null then
    raise exception 'بيانات التصويت غير صالحة.' using errcode='22023';
  end if;
  if p_actor_id=p_vote_target then
    raise exception 'ما تگدر تصوّت لنفسك.';
  end if;

  select * into v_room
  from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'liar' or v_room.status<>'playing'
     or v_room.game_state->'board'->>'phase' is distinct from 'voting' then
    raise exception 'مرحلة التصويت غير نشطة.';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) or not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_vote_target
  ) then
    raise exception 'المصوّت واللاعب المختار يجب أن يكونا داخل الغرفة.' using errcode='42501';
  end if;

  select secret_state into v_private
  from public.game_room_private_state where room_id=p_room_id for update;
  if not found then raise exception 'حالة التصويت الخاصة غير متاحة.'; end if;
  v_outsider_id:=(v_private->>'outsider_id')::uuid;
  v_secret_word:=v_private->>'secret_word';

  select coalesce(jsonb_object_agg(v.key,v.value),'{}'::jsonb)
  into v_votes
  from jsonb_each_text(coalesce(v_private->'votes','{}'::jsonb)) v
  join public.game_room_players voter
    on voter.room_id=p_room_id and voter.user_id::text=v.key
  join public.game_room_players target
    on target.room_id=p_room_id and target.user_id::text=v.value;

  if v_votes ? p_actor_id::text then
    raise exception 'صوّتت بالفعل في هذه الجولة.';
  end if;
  v_votes:=v_votes||jsonb_build_object(p_actor_id::text,p_vote_target::text);

  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;
  select count(*)::integer into v_vote_count
  from jsonb_object_keys(v_votes);
  select display_name into v_name
  from public.game_room_players where room_id=p_room_id and user_id=p_actor_id;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_vote_count>=v_total then
    select coalesce(jsonb_object_agg(t.target_id,t.votes),'{}'::jsonb),
           coalesce(max(t.votes),0)
    into v_tally,v_max_votes
    from (
      select v.value as target_id,count(*)::integer as votes
      from jsonb_each_text(v_votes) v
      group by v.value
    ) t;

    select coalesce(jsonb_agg(t.target_id order by t.target_id),'[]'::jsonb)
    into v_leaders
    from (
      select v.value as target_id,count(*)::integer as votes
      from jsonb_each_text(v_votes) v
      group by v.value
      having count(*)::integer=v_max_votes
    ) t;

    v_caught:=jsonb_array_length(v_leaders)=1
      and v_leaders->>0=v_outsider_id::text;

    v_scores:=coalesce(v_room.game_state->'scores','{}'::jsonb);
    for v_player in
      select p.user_id from public.game_room_players p where p.room_id=p_room_id
    loop
      v_delta:=0;
      if v_votes->>v_player.user_id::text=v_outsider_id::text then
        v_delta:=v_delta+1;
      end if;
      if v_player.user_id=v_outsider_id and not v_caught then
        v_delta:=v_delta+2;
      end if;
      v_score:=coalesce((v_scores->>v_player.user_id::text)::integer,0)+v_delta;
      v_scores:=jsonb_set(v_scores,array[v_player.user_id::text],to_jsonb(v_score),true);
    end loop;

    v_board:=v_board||jsonb_build_object(
      'phase','finished','vote_count',v_vote_count,'vote_total',v_total,
      'tally',v_tally,'leaders',v_leaders,
      'outsider_id',v_outsider_id::text,'secret_word',v_secret_word,
      'outsider_caught',v_caught,'finish_reason','votes_completed'
    );
    v_feed:=coalesce(v_room.game_state->'feed','[]'::jsonb)
      ||jsonb_build_array(case when v_caught
        then 'تم كشف اللاعب الذي كان خارج السالفة!'
        else 'لم يتم كشف اللاعب الغريب بشكل منفرد؛ فاز برا السالفة!'
      end);
    v_state:=v_room.game_state||jsonb_build_object(
      'phase','finished','scores',v_scores,'board',v_board,'feed',v_feed
    );

    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(p_room_id,p_actor_id,'liar_finished',
      jsonb_build_object('outsider_caught',v_caught,'votes',v_vote_count));

    update public.game_rooms
    set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;

    delete from public.game_room_private_state where room_id=p_room_id;
  else
    v_board:=v_board||jsonb_build_object('vote_count',v_vote_count,'vote_total',v_total);
    v_state:=v_room.game_state||jsonb_build_object(
      'board',v_board,
      'feed',coalesce(v_room.game_state->'feed','[]'::jsonb)
        ||jsonb_build_array(v_name||' سجّل تصويته بسرية.')
    );

    update public.game_room_private_state
    set secret_state=jsonb_set(secret_state,'{votes}',v_votes,true),
        updated_at=pg_catalog.clock_timestamp()
    where room_id=p_room_id;

    update public.game_rooms
    set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;

    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(p_room_id,p_actor_id,'liar_vote',jsonb_build_object('vote_recorded',true));
  end if;

  return v_room;
end;
$function$;

create or replace function public.engine_v2_restart_liar_game(
  p_room_id uuid,
  p_actor_id uuid,
  p_secret_word text,
  p_category text,
  p_outsider_id uuid,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_total integer;
  v_round integer;
  v_scores jsonb;
  v_state jsonb;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_outsider_id is null
     or p_secret_word is null or char_length(btrim(p_secret_word)) not between 2 and 60
     or p_category is null or char_length(btrim(p_category)) not between 2 and 40
     or p_expected_updated_at is null then
    raise exception 'بيانات إعادة برا السالفة غير صالحة.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'إعادة الجولة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'المضيف لم يعد عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'liar' or v_room.status<>'finished' then
    raise exception 'لا يمكن إعادة برا السالفة بهذه الحالة.';
  end if;

  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;
  if v_total not between 3 and 16 or v_total>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب برا السالفة.';
  end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_outsider_id) then
    raise exception 'لاعب الدور الغريب غير موجود في الغرفة.';
  end if;

  v_round:=coalesce((v_room.game_state->>'round')::integer,1)+1;
  select coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
  into v_scores from public.game_room_players p where p.room_id=p_room_id;

  v_state:=jsonb_build_object(
    'phase','playing','round',v_round,'turn',0,'scores',v_scores,
    'feed',jsonb_build_array('بدأت جولة جديدة من برا السالفة.'),
    'board',jsonb_build_object(
      'phase','hints','category',btrim(p_category),
      'hint_count',0,'hint_total',v_total,
      'hints','[]'::jsonb,'vote_count',0,'vote_total',v_total,
      'tally','{}'::jsonb,'leaders','[]'::jsonb,
      'outsider_caught',null
    )
  );

  insert into public.game_room_private_state(room_id,secret_state)
  values(
    p_room_id,
    jsonb_build_object(
      'secret_word',btrim(p_secret_word),
      'category',btrim(p_category),
      'outsider_id',p_outsider_id::text,
      'hints','{}'::jsonb,
      'votes','{}'::jsonb
    )
  )
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();

  update public.game_rooms
  set status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'liar_restarted',jsonb_build_object('round',v_round));
  return v_room;
end;
$function$;

create or replace function public.reconcile_liar_after_player_leave()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_private jsonb;
  v_board jsonb;
  v_state jsonb;
begin
  select * into v_room from public.game_rooms
  where id=old.room_id for update;
  if not found or v_room.engine_version<>2 or v_room.game_key<>'liar'
     or v_room.status<>'playing' then
    return old;
  end if;

  select secret_state into v_private
  from public.game_room_private_state where room_id=old.room_id;
  if not found then return old; end if;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb)
    ||jsonb_build_object(
      'phase','finished',
      'secret_word',v_private->>'secret_word',
      'outsider_id',v_private->>'outsider_id',
      'outsider_caught',false,
      'finish_reason','player_left'
    );
  v_state:=v_room.game_state||jsonb_build_object(
    'phase','finished','board',v_board,
    'feed',coalesce(v_room.game_state->'feed','[]'::jsonb)
      ||jsonb_build_array('انتهت الجولة لأن لاعباً غادر الغرفة.')
  );

  update public.game_rooms
  set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=old.room_id;

  delete from public.game_room_private_state where room_id=old.room_id;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(old.room_id,old.user_id,'liar_player_left',jsonb_build_object('round_ended',true));
  return old;
end;
$function$;

drop trigger if exists game_room_players_reconcile_liar on public.game_room_players;
create trigger game_room_players_reconcile_liar
after delete on public.game_room_players
for each row execute function public.reconcile_liar_after_player_leave();

revoke all on function public.engine_v2_start_liar_game(uuid,uuid,text,text,uuid,timestamptz)
  from public,anon,authenticated;
revoke all on function public.engine_v2_get_liar_card(uuid,uuid)
  from public,anon,authenticated;
revoke all on function public.engine_v2_submit_liar_hint(uuid,uuid,text,timestamptz)
  from public,anon,authenticated;
revoke all on function public.engine_v2_vote_liar(uuid,uuid,uuid,timestamptz)
  from public,anon,authenticated;
revoke all on function public.engine_v2_restart_liar_game(uuid,uuid,text,text,uuid,timestamptz)
  from public,anon,authenticated;
revoke all on function public.reconcile_liar_after_player_leave()
  from public,anon,authenticated;

grant execute on function public.engine_v2_start_liar_game(uuid,uuid,text,text,uuid,timestamptz)
  to service_role;
grant execute on function public.engine_v2_get_liar_card(uuid,uuid)
  to service_role;
grant execute on function public.engine_v2_submit_liar_hint(uuid,uuid,text,timestamptz)
  to service_role;
grant execute on function public.engine_v2_vote_liar(uuid,uuid,uuid,timestamptz)
  to service_role;
grant execute on function public.engine_v2_restart_liar_game(uuid,uuid,text,text,uuid,timestamptz)
  to service_role;

commit;
