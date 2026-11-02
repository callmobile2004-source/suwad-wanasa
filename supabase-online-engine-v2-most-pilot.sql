-- Server-authoritative engine v2: "منو الأكثر؟" voting game.
-- Apply only after supabase-online-room-hardening-phase1.sql and
-- supabase-online-engine-v2-number-pilot.sql.
-- Player votes stay in game_room_private_state until the whole room has voted.
begin;

alter table public.game_room_engine_events
  drop constraint if exists game_room_engine_events_event_type_check;
alter table public.game_room_engine_events
  add constraint game_room_engine_events_event_type_check
  check (event_type in (
    'number_started','number_restarted','number_guess',
    'most_started','most_vote','most_question','most_finished','most_restarted','most_player_left'
  ));

create or replace function public.engine_v2_start_most_game(
  p_room_id uuid,
  p_actor_id uuid,
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
  v_scores jsonb;
  v_names jsonb;
  v_state jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_expected_updated_at is null then
    raise exception 'Invalid game start request.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
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
    raise exception 'المضيف ليس عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'most' or v_room.status<>'waiting' then
    raise exception 'هذه الغرفة ليست جاهزة لمحرك التصويت.';
  end if;

  select count(*)::integer into v_count
  from public.game_room_players where room_id=p_room_id;
  if v_count not between 2 and 12 or v_count>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة منو الأكثر.';
  end if;

  select coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
    into v_scores
  from public.game_room_players p where p.room_id=p_room_id;
  select coalesce(jsonb_object_agg(p.user_id::text,p.display_name),'{}'::jsonb)
    into v_names
  from public.game_room_players p where p.room_id=p_room_id;

  v_state:=jsonb_build_object(
    'phase','playing','round',1,'turn',0,'scores',v_scores,
    'feed',jsonb_build_array('بدأت لعبة منو الأكثر؟'),
    'board',jsonb_build_object(
      'question',0,'phase','voting','vote_count',0,'vote_total',v_count,
      'tally','{}'::jsonb,'winners','[]'::jsonb,'player_names',v_names
    )
  );

  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('votes','{}'::jsonb))
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();

  update public.game_rooms
  set status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'most_started',jsonb_build_object('players',v_count));

  return v_room;
end;
$function$;

create or replace function public.engine_v2_vote_most(
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
  v_board jsonb;
  v_state jsonb;
  v_tally jsonb:='{}'::jsonb;
  v_winners jsonb:='[]'::jsonb;
  v_scores jsonb;
  v_vote_count integer;
  v_vote_total integer;
  v_max_votes integer:=0;
  v_row record;
  v_winner text;
  v_name text;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_vote_target is null or p_expected_updated_at is null then
    raise exception 'Invalid vote request.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'most' or v_room.status<>'playing' then
    raise exception 'محرك التصويت غير نشط لهذه الغرفة.';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_vote_target
  ) then
    raise exception 'اللاعب المختار ليس عضواً في الغرفة.' using errcode='22023';
  end if;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_board->>'phase' is distinct from 'voting' then
    raise exception 'انتهى التصويت لهذا السؤال.';
  end if;

  select secret_state into v_private
  from public.game_room_private_state
  where room_id=p_room_id
  for update;
  if not found then raise exception 'حالة التصويت الخاصة غير متاحة.'; end if;

  if jsonb_typeof(coalesce(v_private->'votes','{}'::jsonb)) is distinct from 'object' then
    raise exception 'حالة التصويت غير صالحة.';
  end if;

  -- Drop votes from players who left, or votes that targeted a departed player.
  select coalesce(jsonb_object_agg(v.key,v.value),'{}'::jsonb)
  into v_votes
  from jsonb_each_text(coalesce(v_private->'votes','{}'::jsonb)) as v(key,value)
  join public.game_room_players voter
    on voter.room_id=p_room_id and voter.user_id=v.key::uuid
  join public.game_room_players target
    on target.room_id=p_room_id and target.user_id=v.value::uuid;

  if v_votes ? p_actor_id::text then
    raise exception 'صوّتت بالفعل في هذا السؤال.';
  end if;

  select count(*)::integer into v_vote_total
  from public.game_room_players where room_id=p_room_id;
  if v_vote_total<2 then
    raise exception 'بقي لاعب واحد فقط؛ لا يمكن إكمال التصويت.';
  end if;
  select count(*)::integer into v_vote_count from jsonb_object_keys(v_votes);
  v_vote_count:=v_vote_count+1;
  v_votes:=v_votes||jsonb_build_object(p_actor_id::text,p_vote_target::text);

  select p.display_name into v_name
  from public.game_room_players p
  where p.room_id=p_room_id and p.user_id=p_actor_id;

  v_board:=jsonb_set(v_board,'{vote_count}',to_jsonb(v_vote_count),true);
  v_board:=jsonb_set(v_board,'{vote_total}',to_jsonb(v_vote_total),true);
  v_scores:=coalesce(v_room.game_state->'scores','{}'::jsonb);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',
    coalesce(v_room.game_state->'feed','[]'::jsonb)
      ||jsonb_build_array(coalesce(v_name,'لاعب')||' أرسل تصويته.'),true);

  update public.game_room_private_state
  set secret_state=jsonb_set(coalesce(secret_state,'{}'::jsonb),'{votes}',v_votes,true),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=p_room_id;

  if v_vote_count=v_vote_total then
    for v_row in
      select e.value as target_id,count(*)::integer as vote_count
      from jsonb_each_text(v_votes) as e(key,value)
      group by e.value
    loop
      v_tally:=v_tally||jsonb_build_object(v_row.target_id,v_row.vote_count);
      if v_row.vote_count>v_max_votes then
        v_max_votes:=v_row.vote_count;
        v_winners:=jsonb_build_array(v_row.target_id);
      elsif v_row.vote_count=v_max_votes then
        v_winners:=v_winners||jsonb_build_array(v_row.target_id);
      end if;
    end loop;

    for v_winner in select jsonb_array_elements_text(v_winners)
    loop
      v_scores:=v_scores||jsonb_build_object(
        v_winner,coalesce((v_scores->>v_winner)::integer,0)+1
      );
    end loop;

    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('results'::text),true);
    v_board:=jsonb_set(v_board,'{tally}',v_tally,true);
    v_board:=jsonb_set(v_board,'{winners}',v_winners,true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('اكتمل التصويت وظهرت النتيجة.'),true);
  end if;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'most_vote',
    jsonb_build_object('question',coalesce((v_board->>'question')::integer,0),
      'target_id',p_vote_target,'vote_count',v_vote_count,'vote_total',v_vote_total));

  update public.game_rooms
  set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  return v_room;
end;
$function$;

create or replace function public.engine_v2_next_most_question(
  p_room_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_board jsonb;
  v_state jsonb;
  v_question integer;
  v_question_text text;
  v_total integer;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_expected_updated_at is null then
    raise exception 'Invalid next-question request.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'الانتقال للسؤال التالي من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'المضيف ليس عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'most' or v_room.status<>'playing' then
    raise exception 'لا يمكن الانتقال للسؤال التالي بهذه الحالة.';
  end if;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;

  if v_total<2 then
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_board:=jsonb_set(v_board,'{vote_count}',to_jsonb(0),true);
    v_board:=jsonb_set(v_board,'{vote_total}',to_jsonb(v_total),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('انتهت اللعبة لعدم كفاية اللاعبين.'),true);
    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(p_room_id,p_actor_id,'most_finished',
      jsonb_build_object('reason','not_enough_players','remaining_players',v_total));
    update public.game_rooms
    set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    delete from public.game_room_private_state where room_id=p_room_id;
    return v_room;
  end if;

  if v_board->>'phase' is distinct from 'results' then
    raise exception 'لا تنتقل للسؤال التالي قبل اكتمال تصويت الجميع.';
  end if;
  v_question_text:=coalesce(v_board->>'question','0');
  if v_question_text !~ '^[0-5]$' then
    raise exception 'رقم السؤال الحالي غير صالح.';
  end if;
  v_question:=v_question_text::integer;

  if v_question=5 then
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_board:=jsonb_set(v_board,'{vote_count}',to_jsonb(0),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('انتهت أسئلة منو الأكثر.'),true);

    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(p_room_id,p_actor_id,'most_finished',jsonb_build_object('question',v_question));

    update public.game_rooms
    set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    delete from public.game_room_private_state where room_id=p_room_id;
    return v_room;
  end if;

  v_question:=v_question+1;
  v_board:=jsonb_set(v_board,'{question}',to_jsonb(v_question),true);
  v_board:=jsonb_set(v_board,'{phase}',to_jsonb('voting'::text),true);
  v_board:=jsonb_set(v_board,'{vote_count}',to_jsonb(0),true);
  v_board:=jsonb_set(v_board,'{vote_total}',to_jsonb(v_total),true);
  v_board:=jsonb_set(v_board,'{tally}','{}'::jsonb,true);
  v_board:=jsonb_set(v_board,'{winners}','[]'::jsonb,true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',
    coalesce(v_room.game_state->'feed','[]'::jsonb)
      ||jsonb_build_array('بدأ سؤال جديد.'),true);

  update public.game_room_private_state
  set secret_state=jsonb_build_object('votes','{}'::jsonb),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=p_room_id;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'most_question',jsonb_build_object('question',v_question));

  update public.game_rooms
  set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  return v_room;
end;
$function$;

create or replace function public.engine_v2_restart_most_game(
  p_room_id uuid,
  p_actor_id uuid,
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
  v_scores jsonb;
  v_names jsonb;
  v_state jsonb;
  v_round_text text;
  v_round integer;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_expected_updated_at is null then
    raise exception 'Invalid restart request.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'إعادة اللعبة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'المضيف ليس عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'most' or v_room.status<>'finished' then
    raise exception 'لا يمكن إعادة اللعبة بهذه الحالة.';
  end if;

  select count(*)::integer into v_count
  from public.game_room_players where room_id=p_room_id;
  if v_count not between 2 and 12 or v_count>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة منو الأكثر.';
  end if;
  select coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
  into v_scores from public.game_room_players p where p.room_id=p_room_id;
  select coalesce(jsonb_object_agg(p.user_id::text,p.display_name),'{}'::jsonb)
  into v_names from public.game_room_players p where p.room_id=p_room_id;

  v_round_text:=coalesce(v_room.game_state->>'round','0');
  v_round:=case when v_round_text ~ '^[0-9]{1,6}$' then v_round_text::integer+1 else 1 end;
  v_state:=jsonb_build_object(
    'phase','playing','round',v_round,'turn',0,
    'scores',v_scores,'feed',jsonb_build_array('بدأت لعبة جديدة من منو الأكثر؟'),
    'board',jsonb_build_object(
      'question',0,'phase','voting','vote_count',0,'vote_total',v_count,
      'tally','{}'::jsonb,'winners','[]'::jsonb,'player_names',v_names
    )
  );

  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('votes','{}'::jsonb))
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();

  update public.game_rooms
  set status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'most_restarted',jsonb_build_object('players',v_count));

  return v_room;
end;
$function$;


-- Reconcile a live Most-voting round if a player leaves. This removes votes
-- cast by departed players and votes targeting departed players; if the
-- remaining roster has already voted, it publishes the aggregate result.
create or replace function public.reconcile_most_votes_after_player_leave()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_private jsonb;
  v_votes jsonb;
  v_board jsonb;
  v_state jsonb;
  v_total integer;
  v_vote_count integer;
  v_tally jsonb:='{}'::jsonb;
  v_winners jsonb:='[]'::jsonb;
  v_scores jsonb;
  v_max_votes integer:=0;
  v_row record;
  v_winner text;
begin
  select * into v_room
  from public.game_rooms
  where id=old.room_id
  for update;
  if not found then return old; end if;
  if v_room.engine_version<>2 or v_room.game_key<>'most' then return old; end if;

  if v_room.status='finished' then
    delete from public.game_room_private_state where room_id=old.room_id;
    return old;
  end if;
  if v_room.status<>'playing' then return old; end if;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_board->>'phase' is distinct from 'voting' then return old; end if;

  select secret_state into v_private
  from public.game_room_private_state
  where room_id=old.room_id
  for update;
  if not found then return old; end if;

  if jsonb_typeof(coalesce(v_private->'votes','{}'::jsonb)) is distinct from 'object' then
    v_votes:='{}'::jsonb;
  else
    select coalesce(jsonb_object_agg(v.key,v.value),'{}'::jsonb)
      into v_votes
    from jsonb_each_text(coalesce(v_private->'votes','{}'::jsonb)) as v(key,value)
    join public.game_room_players voter
      on voter.room_id=old.room_id and voter.user_id::text=v.key
    join public.game_room_players target
      on target.room_id=old.room_id and target.user_id::text=v.value;
  end if;

  select count(*)::integer into v_total
  from public.game_room_players where room_id=old.room_id;
  select count(*)::integer into v_vote_count from jsonb_object_keys(v_votes);

  v_board:=jsonb_set(v_board,'{vote_count}',to_jsonb(v_vote_count),true);
  v_board:=jsonb_set(v_board,'{vote_total}',to_jsonb(v_total),true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);

  if v_total<2 then
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_room.game_state->'feed','[]'::jsonb)
        ||jsonb_build_array('انتهت اللعبة لعدم كفاية اللاعبين.'),true);
    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(old.room_id,old.user_id,'most_finished',
      jsonb_build_object('reason','not_enough_players','remaining_players',v_total));
    update public.game_rooms
    set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=old.room_id;
    delete from public.game_room_private_state where room_id=old.room_id;
    return old;
  end if;

  update public.game_room_private_state
  set secret_state=jsonb_set(coalesce(secret_state,'{}'::jsonb),'{votes}',v_votes,true),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=old.room_id;

  if v_vote_count=v_total then
    for v_row in
      select e.value as target_id,count(*)::integer as vote_count
      from jsonb_each_text(v_votes) as e(key,value)
      group by e.value
    loop
      v_tally:=v_tally||jsonb_build_object(v_row.target_id,v_row.vote_count);
      if v_row.vote_count>v_max_votes then
        v_max_votes:=v_row.vote_count;
        v_winners:=jsonb_build_array(v_row.target_id);
      elsif v_row.vote_count=v_max_votes then
        v_winners:=v_winners||jsonb_build_array(v_row.target_id);
      end if;
    end loop;

    v_scores:=coalesce(v_room.game_state->'scores','{}'::jsonb);
    for v_winner in select jsonb_array_elements_text(v_winners)
    loop
      v_scores:=v_scores||jsonb_build_object(
        v_winner,coalesce((v_scores->>v_winner)::integer,0)+1
      );
    end loop;

    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('results'::text),true);
    v_board:=jsonb_set(v_board,'{tally}',v_tally,true);
    v_board:=jsonb_set(v_board,'{winners}',v_winners,true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('اكتمل التصويت بعد مغادرة لاعب وظهرت النتيجة.'),true);
  end if;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(old.room_id,old.user_id,'most_player_left',
    jsonb_build_object('question',coalesce((v_board->>'question')::integer,0),
      'remaining_players',v_total,'vote_count',v_vote_count,'vote_total',v_total));

  update public.game_rooms
  set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=old.room_id;
  return old;
end;
$function$;

drop trigger if exists game_room_players_reconcile_most_votes on public.game_room_players;
create trigger game_room_players_reconcile_most_votes
after delete on public.game_room_players
for each row execute function public.reconcile_most_votes_after_player_leave();

-- Clean private state after all completion triggers have consumed it.
-- This handles host departure as well as normal engine completion.
create or replace function public.cleanup_finished_room_private_state()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.status='finished' and old.status is distinct from 'finished' then
    delete from public.game_room_private_state where room_id=new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists game_rooms_z_cleanup_private_state on public.game_rooms;
create trigger game_rooms_z_cleanup_private_state
after update of status on public.game_rooms
for each row execute function public.cleanup_finished_room_private_state();


create or replace function public.award_completed_room_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_player record;
  v_games integer;
  v_inserted integer;
  v_board jsonb;
  v_event record;
  v_secret text;
  v_completed_questions integer;
begin
  if old.status is distinct from 'playing'
     or new.status is distinct from 'finished'
     or new.engine_version<>2
     or new.game_state->>'phase' is distinct from 'finished'
     or new.game_started_at is null then
    return new;
  end if;

  v_board:=new.game_state->'board';
  if jsonb_typeof(v_board) is distinct from 'object' then return new; end if;

  if new.game_key='number' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.event_type='number_guess'
    order by e.id desc limit 1;
    if not found then return new; end if;
    if v_event.event_payload->>'result' is distinct from 'correct'
       or v_event.actor_id::text is distinct from v_board->>'winner_id'
       or v_event.event_payload->>'guess' is distinct from v_board->>'revealed_number' then
      return new;
    end if;

    select s.secret_state->>'number' into v_secret
    from public.game_room_private_state s where s.room_id=new.id;
    if v_secret is null or v_secret is distinct from v_board->>'revealed_number' then
      return new;
    end if;
    if not exists(
      select 1 from public.game_room_players p
      where p.room_id=new.id and p.user_id=v_event.actor_id
    ) then
      return new;
    end if;

  elsif new.game_key='most' then
    -- Require a proper final event for question six, not an early stop,
    -- host departure, or an arbitrary status update.
    if not exists(
      select 1 from public.game_room_engine_events e
      where e.room_id=new.id
        and e.event_type='most_finished'
        and e.event_payload->>'question'='5'
    ) then
      return new;
    end if;

    -- Each question must have an authoritative completion event showing
    -- that votes received equalled the active room roster at that moment.
    select count(distinct
      case
        when e.event_payload->>'question' ~ '^[0-5]$'
         and e.event_payload->>'vote_count'=e.event_payload->>'vote_total'
         and e.event_payload->>'vote_total' ~ '^(?:[2-9]|1[0-2])$'
        then (e.event_payload->>'question')::integer
        else null
      end
    )::integer
    into v_completed_questions
    from public.game_room_engine_events e
    where e.room_id=new.id
      and e.event_type in ('most_vote','most_player_left');

    if coalesce(v_completed_questions,0)<>6 then
      return new;
    end if;
  else
    return new;
  end if;

  -- One participation award per player per room, regardless of retries.
  for v_player in
    select p.user_id from public.game_room_players p where p.room_id=new.id
  loop
    insert into public.player_game_history(room_id,user_id,game_key,xp_awarded)
    values(new.id,v_player.user_id,new.game_key,10)
    on conflict(room_id,user_id) do nothing;

    get diagnostics v_inserted = row_count;
    if v_inserted=1 then
      insert into public.player_progress(user_id,xp,games_completed,updated_at)
      values(v_player.user_id,10,1,pg_catalog.now())
      on conflict(user_id) do update
        set xp=public.player_progress.xp+10,
            games_completed=public.player_progress.games_completed+1,
            updated_at=pg_catalog.now()
      returning games_completed into v_games;

      insert into public.player_achievements(user_id,achievement_id)
      select v_player.user_id,a.id
      from public.achievements a
      where a.requirement_games<=v_games
      on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function public.reconcile_most_votes_after_player_leave() from public, anon, authenticated;
revoke all on function public.cleanup_finished_room_private_state() from public, anon, authenticated;

revoke all on function public.engine_v2_start_most_game(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_vote_most(uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_next_most_question(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_restart_most_game(uuid,uuid,timestamptz) from public, anon, authenticated;

grant execute on function public.engine_v2_start_most_game(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_vote_most(uuid,uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_next_most_question(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_restart_most_game(uuid,uuid,timestamptz) to service_role;

commit;
