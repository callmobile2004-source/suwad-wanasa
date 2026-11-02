-- Server-authoritative engine v2: online Yes/No questions.
-- Apply after room hardening, number, Most, and Quiz engine migrations.
-- Individual Yes/No choices stay private; only aggregate counts are public.
begin;

alter table public.game_room_engine_events
  drop constraint if exists game_room_engine_events_event_type_check;
alter table public.game_room_engine_events
  add constraint game_room_engine_events_event_type_check
  check (event_type in (
    'number_started','number_restarted','number_guess',
    'most_started','most_vote','most_question','most_finished','most_restarted','most_player_left',
    'quiz_started','quiz_answer','quiz_question','quiz_finished','quiz_restarted','quiz_player_left',
    'yesno_started','yesno_answer','yesno_question','yesno_finished','yesno_restarted','yesno_player_left'
  ));

create or replace function public.engine_v2_start_yesno_game(
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
  v_total integer;
  v_scores jsonb;
  v_state jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_expected_updated_at is null then
    raise exception 'Invalid Yes/No start request.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'بدء اللعبة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'المضيف ليس عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'yesno' or v_room.status<>'waiting' then
    raise exception 'هذه الغرفة ليست جاهزة لمحرك نعم أو لا.';
  end if;

  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;
  if v_total not between 2 and 12 or v_total>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة نعم أو لا.';
  end if;
  select coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
  into v_scores from public.game_room_players p where p.room_id=p_room_id;

  v_state:=jsonb_build_object(
    'phase','playing','round',1,'turn',0,
    'scores',v_scores,
    'feed',jsonb_build_array('بدأت لعبة نعم أو لا؟'),
    'board',jsonb_build_object(
      'question',0,'phase','answering','answer_count',0,'answer_total',v_total,
      'yes_count',0,'no_count',0
    )
  );

  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('submissions','{}'::jsonb))
  on conflict(room_id) do update
    set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();

  update public.game_rooms
  set status='playing',game_state=v_state,
      game_started_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'yesno_started',jsonb_build_object('players',v_total));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_answer_yesno_game(
  p_room_id uuid,
  p_actor_id uuid,
  p_answer boolean,
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
  v_submissions jsonb;
  v_board jsonb;
  v_state jsonb;
  v_total integer;
  v_answer_count integer;
  v_question_text text;
  v_question integer;
  v_yes_count integer;
  v_no_count integer;
  v_name text;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_answer is null or p_expected_updated_at is null then
    raise exception 'اختار نعم أو لا.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'yesno' or v_room.status<>'playing' then
    raise exception 'محرك نعم أو لا غير نشط لهذه الغرفة.';
  end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;

  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_board->>'phase' is distinct from 'answering' then
    raise exception 'انتهى استقبال الإجابات لهذا السؤال.';
  end if;
  v_question_text:=coalesce(v_board->>'question','');
  if v_question_text !~ '^[0-2]$' then
    raise exception 'رقم السؤال غير صالح.';
  end if;
  v_question:=v_question_text::integer;

  select secret_state into v_private
  from public.game_room_private_state where room_id=p_room_id for update;
  if not found then raise exception 'حالة الإجابات الخاصة غير متاحة.'; end if;
  if jsonb_typeof(coalesce(v_private->'submissions','{}'::jsonb)) is distinct from 'object' then
    raise exception 'حالة الإجابات غير صالحة.';
  end if;
  select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb)
  into v_submissions
  from jsonb_each_text(coalesce(v_private->'submissions','{}'::jsonb)) s
  join public.game_room_players p on p.room_id=p_room_id and p.user_id::text=s.key;
  if v_submissions ? p_actor_id::text then
    raise exception 'أرسلت إجابتك بالفعل في هذا السؤال.';
  end if;

  v_submissions:=v_submissions||jsonb_build_object(p_actor_id::text,p_answer);
  select count(*)::integer into v_total
  from public.game_room_players where room_id=p_room_id;
  select count(*)::integer into v_answer_count
  from jsonb_object_keys(v_submissions);
  select p.display_name into v_name
  from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id;

  v_board:=jsonb_set(v_board,'{answer_count}',to_jsonb(v_answer_count),true);
  v_board:=jsonb_set(v_board,'{answer_total}',to_jsonb(v_total),true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',
    coalesce(v_state->'feed','[]'::jsonb)
      ||jsonb_build_array(coalesce(v_name,'لاعب')||' أرسل اختياره.'),true);

  update public.game_room_private_state
  set secret_state=jsonb_set(coalesce(secret_state,'{}'::jsonb),'{submissions}',v_submissions,true),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=p_room_id;

  if v_answer_count=v_total then
    select count(*)::integer into v_yes_count
    from jsonb_each_text(v_submissions) s where s.value='true';
    v_no_count:=v_total-v_yes_count;
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('results'::text),true);
    v_board:=jsonb_set(v_board,'{yes_count}',to_jsonb(v_yes_count),true);
    v_board:=jsonb_set(v_board,'{no_count}',to_jsonb(v_no_count),true);
    v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('اكتمل التصويت وظهرت الحصيلة.'),true);
  end if;

  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'yesno_answer',
    jsonb_build_object(
      'question',v_question,'answer_count',v_answer_count,'answer_total',v_total,
      'yes_count',case when v_answer_count=v_total then v_yes_count else null end,
      'no_count',case when v_answer_count=v_total then v_no_count else null end
    ));

  update public.game_rooms
  set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  return v_room;
end;
$function$;

create or replace function public.engine_v2_next_yesno_question(
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
  v_question_text text;
  v_question integer;
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
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'المضيف ليس عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'yesno' or v_room.status<>'playing' then
    raise exception 'لا يمكن الانتقال للسؤال التالي بهذه الحالة.';
  end if;

  select count(*)::integer into v_total from public.game_room_players where room_id=p_room_id;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_total<2 then
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('انتهت اللعبة لعدم كفاية اللاعبين.'),true);
    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(p_room_id,p_actor_id,'yesno_finished',jsonb_build_object('reason','not_enough_players','remaining_players',v_total));
    update public.game_rooms set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    delete from public.game_room_private_state where room_id=p_room_id;
    return v_room;
  end if;

  if v_board->>'phase' is distinct from 'results' then
    raise exception 'لا تنتقل للسؤال التالي قبل إجابة الجميع.';
  end if;
  v_question_text:=coalesce(v_board->>'question','');
  if v_question_text !~ '^[0-2]$' then raise exception 'رقم السؤال غير صالح.'; end if;
  v_question:=v_question_text::integer;

  if v_question=2 then
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('انتهت أسئلة نعم أو لا.'),true);
    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(p_room_id,p_actor_id,'yesno_finished',jsonb_build_object('question',2));
    update public.game_rooms set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    delete from public.game_room_private_state where room_id=p_room_id;
    return v_room;
  end if;

  v_question:=v_question+1;
  v_board:=jsonb_set(v_board,'{question}',to_jsonb(v_question),true);
  v_board:=jsonb_set(v_board,'{phase}',to_jsonb('answering'::text),true);
  v_board:=jsonb_set(v_board,'{answer_count}',to_jsonb(0),true);
  v_board:=jsonb_set(v_board,'{answer_total}',to_jsonb(v_total),true);
  v_board:=jsonb_set(v_board,'{yes_count}',to_jsonb(0),true);
  v_board:=jsonb_set(v_board,'{no_count}',to_jsonb(0),true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',
    coalesce(v_state->'feed','[]'::jsonb)
      ||jsonb_build_array('بدأ سؤال جديد.'),true);

  update public.game_room_private_state
  set secret_state=jsonb_build_object('submissions','{}'::jsonb),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=p_room_id;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'yesno_question',jsonb_build_object('question',v_question));
  update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  return v_room;
end;
$function$;

create or replace function public.engine_v2_restart_yesno_game(
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
  v_total integer;
  v_scores jsonb;
  v_round_text text;
  v_round integer;
  v_state jsonb;
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
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'المضيف ليس عضواً في الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'yesno' or v_room.status<>'finished' then
    raise exception 'لا يمكن إعادة اللعبة بهذه الحالة.';
  end if;
  select count(*)::integer into v_total from public.game_room_players where room_id=p_room_id;
  if v_total not between 2 and 12 or v_total>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة نعم أو لا.';
  end if;
  select coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
  into v_scores from public.game_room_players p where p.room_id=p_room_id;
  v_round_text:=coalesce(v_room.game_state->>'round','0');
  v_round:=case when v_round_text ~ '^[0-9]{1,6}$' then v_round_text::integer+1 else 1 end;
  v_state:=jsonb_build_object(
    'phase','playing','round',v_round,'turn',0,'scores',v_scores,
    'feed',jsonb_build_array('بدأت لعبة جديدة من نعم أو لا.'),
    'board',jsonb_build_object('question',0,'phase','answering','answer_count',0,
      'answer_total',v_total,'yes_count',0,'no_count',0)
  );
  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('submissions','{}'::jsonb))
  on conflict(room_id) do update set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();
  update public.game_rooms set status='playing',game_state=v_state,
    game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'yesno_restarted',jsonb_build_object('players',v_total));
  return v_room;
end;
$function$;

create or replace function public.reconcile_yesno_answers_after_player_leave()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_private jsonb;
  v_submissions jsonb;
  v_board jsonb;
  v_state jsonb;
  v_total integer;
  v_answer_count integer;
  v_yes_count integer;
  v_no_count integer;
  v_question_text text;
begin
  select * into v_room from public.game_rooms where id=old.room_id for update;
  if not found then return old; end if;
  if v_room.engine_version<>2 or v_room.game_key<>'yesno' then return old; end if;
  if v_room.status='finished' then
    delete from public.game_room_private_state where room_id=old.room_id;
    return old;
  end if;
  if v_room.status<>'playing' then return old; end if;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  if v_board->>'phase' is distinct from 'answering' then return old; end if;
  select secret_state into v_private from public.game_room_private_state
    where room_id=old.room_id for update;
  if not found then return old; end if;

  if jsonb_typeof(coalesce(v_private->'submissions','{}'::jsonb)) is distinct from 'object' then
    v_submissions:='{}'::jsonb;
  else
    select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb)
    into v_submissions
    from jsonb_each_text(coalesce(v_private->'submissions','{}'::jsonb)) s
    join public.game_room_players p on p.room_id=old.room_id and p.user_id::text=s.key;
  end if;

  select count(*)::integer into v_total from public.game_room_players where room_id=old.room_id;
  select count(*)::integer into v_answer_count from jsonb_object_keys(v_submissions);
  v_board:=jsonb_set(v_board,'{answer_count}',to_jsonb(v_answer_count),true);
  v_board:=jsonb_set(v_board,'{answer_total}',to_jsonb(v_total),true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);

  if v_total<2 then
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('انتهت اللعبة لعدم كفاية اللاعبين.'),true);
    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(old.room_id,old.user_id,'yesno_finished',
      jsonb_build_object('reason','not_enough_players','remaining_players',v_total));
    update public.game_rooms set status='finished',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=old.room_id;
    delete from public.game_room_private_state where room_id=old.room_id;
    return old;
  end if;

  update public.game_room_private_state
  set secret_state=jsonb_set(coalesce(secret_state,'{}'::jsonb),'{submissions}',v_submissions,true),
      updated_at=pg_catalog.clock_timestamp()
  where room_id=old.room_id;

  if v_answer_count=v_total then
    select count(*)::integer into v_yes_count from jsonb_each_text(v_submissions) s where s.value='true';
    v_no_count:=v_total-v_yes_count;
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('results'::text),true);
    v_board:=jsonb_set(v_board,'{yes_count}',to_jsonb(v_yes_count),true);
    v_board:=jsonb_set(v_board,'{no_count}',to_jsonb(v_no_count),true);
    v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',
      coalesce(v_state->'feed','[]'::jsonb)
        ||jsonb_build_array('اكتملت الإجابات بعد مغادرة لاعب وظهرت الحصيلة.'),true);
  end if;

  v_question_text:=coalesce(v_board->>'question','');
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(old.room_id,old.user_id,'yesno_player_left',
    jsonb_build_object(
      'question',case when v_question_text ~ '^[0-2]$' then v_question_text::integer else null end,
      'answer_count',v_answer_count,'answer_total',v_total,
      'yes_count',case when v_answer_count=v_total then v_yes_count else null end,
      'no_count',case when v_answer_count=v_total then v_no_count else null end
    ));
  update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=old.room_id;
  return old;
end;
$function$;

drop trigger if exists game_room_players_reconcile_yesno_answers on public.game_room_players;
create trigger game_room_players_reconcile_yesno_answers
after delete on public.game_room_players
for each row execute function public.reconcile_yesno_answers_after_player_leave();

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
    from public.game_room_engine_events e where e.room_id=new.id and e.event_type='number_guess'
    order by e.id desc limit 1;
    if not found or v_event.event_payload->>'result' is distinct from 'correct'
       or v_event.actor_id::text is distinct from v_board->>'winner_id'
       or v_event.event_payload->>'guess' is distinct from v_board->>'revealed_number' then
      return new;
    end if;
    select s.secret_state->>'number' into v_secret
    from public.game_room_private_state s where s.room_id=new.id;
    if v_secret is null or v_secret is distinct from v_board->>'revealed_number' then return new; end if;
    if not exists(select 1 from public.game_room_players p where p.room_id=new.id and p.user_id=v_event.actor_id) then
      return new;
    end if;
  elsif new.game_key='most' then
    if not exists(select 1 from public.game_room_engine_events e where e.room_id=new.id and e.event_type='most_finished' and e.event_payload->>'question'='5') then
      return new;
    end if;
    select count(distinct case
      when e.event_payload->>'question' ~ '^[0-5]$'
       and e.event_payload->>'vote_count'=e.event_payload->>'vote_total'
       and e.event_payload->>'vote_total' ~ '^(?:[2-9]|1[0-2])$'
      then (e.event_payload->>'question')::integer else null end)::integer
    into v_completed_questions from public.game_room_engine_events e
    where e.room_id=new.id and e.event_type in ('most_vote','most_player_left');
    if coalesce(v_completed_questions,0)<>6 then return new; end if;
  elsif new.game_key='quiz' then
    if not exists(select 1 from public.game_room_engine_events e where e.room_id=new.id and e.event_type='quiz_finished' and e.event_payload->>'question'='2') then
      return new;
    end if;
    select count(distinct case
      when e.event_payload->>'question' ~ '^[0-2]$'
       and e.event_payload->>'answer_count'=e.event_payload->>'answer_total'
       and e.event_payload->>'answer_total' ~ '^(?:[2-9]|1[0-2])$'
      then (e.event_payload->>'question')::integer else null end)::integer
    into v_completed_questions from public.game_room_engine_events e
    where e.room_id=new.id and e.event_type in ('quiz_answer','quiz_player_left');
    if coalesce(v_completed_questions,0)<>3 then return new; end if;
  elsif new.game_key='yesno' then
    if not exists(select 1 from public.game_room_engine_events e where e.room_id=new.id and e.event_type='yesno_finished' and e.event_payload->>'question'='2') then
      return new;
    end if;
    select count(distinct case
      when e.event_payload->>'question' ~ '^[0-2]$'
       and e.event_payload->>'answer_count'=e.event_payload->>'answer_total'
       and e.event_payload->>'answer_total' ~ '^(?:[2-9]|1[0-2])$'
      then (e.event_payload->>'question')::integer else null end)::integer
    into v_completed_questions from public.game_room_engine_events e
    where e.room_id=new.id and e.event_type in ('yesno_answer','yesno_player_left');
    if coalesce(v_completed_questions,0)<>3 then return new; end if;
  else
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
      where a.requirement_games<=v_games on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;
  return new;
end;
$function$;

revoke all on function public.award_completed_room_progress() from public, anon, authenticated;
revoke all on function public.reconcile_yesno_answers_after_player_leave() from public, anon, authenticated;
revoke all on function public.engine_v2_start_yesno_game(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_answer_yesno_game(uuid,uuid,boolean,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_next_yesno_question(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.engine_v2_restart_yesno_game(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.engine_v2_start_yesno_game(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_answer_yesno_game(uuid,uuid,boolean,timestamptz) to service_role;
grant execute on function public.engine_v2_next_yesno_question(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_restart_yesno_game(uuid,uuid,timestamptz) to service_role;

commit;
