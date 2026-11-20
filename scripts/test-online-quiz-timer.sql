-- Online quiz authoritative timer/security regression.
-- Run only in a disposable Supabase staging project after applying
-- 20261120120000_authoritative_online_quiz_timer.sql and deploying room-engine.
-- Every write is rolled back; no users, rooms, events, or progress are retained.
BEGIN;
CREATE TEMP TABLE online_quiz_smoke_results(test_name text,passed boolean) ON COMMIT DROP;

DO $smoke$
DECLARE
  v_host uuid:=gen_random_uuid();
  v_guest uuid:=gen_random_uuid();
  v_code text:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  v_room public.game_rooms;
  v_question jsonb;
  v_next_question jsonb;
  v_secret jsonb;
  v_host_private jsonb;
  v_guest_private jsonb;
  v_stale timestamptz;
  v_seconds numeric;
  v_caught boolean;
BEGIN
  INSERT INTO auth.users(id,aud,role,raw_user_meta_data,is_anonymous)
  VALUES
    (v_host,'authenticated','authenticated',jsonb_build_object('username','quiz_host_'||substr(v_host::text,1,8),'display_name','Quiz Host'),true),
    (v_guest,'authenticated','authenticated',jsonb_build_object('username','quiz_guest_'||substr(v_guest::text,1,8),'display_name','Quiz Guest'),true);

  PERFORM set_config('request.jwt.claim.sub',v_host::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
  SELECT * INTO v_room FROM public.create_game_room(v_code,'Online Quiz Timer Test','quiz',2,'{}'::jsonb,'Quiz Host');

  PERFORM set_config('request.jwt.claim.sub',v_guest::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(v_code,'Quiz Guest');

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);

  v_question:=jsonb_build_object(
    'public',jsonb_build_object(
      'id','online-quiz-smoke-1','category','math','difficulty','easy',
      'question','ما ناتج ٢ + ٢؟','options',jsonb_build_array('٣','٤','٥','٦')
    ),
    'private',jsonb_build_object(
      'questionId','online-quiz-smoke-1','correctChoice',1,
      'explanation','إضافة ٢ إلى ٢ تساوي ٤.',
      'source',jsonb_build_object('label','OpenStax','url','https://openstax.org/')
    )
  );
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_host,'start',v_question,NULL,v_room.updated_at
  );

  v_seconds:=extract(epoch FROM (
    (v_room.game_state->'board'->'quizQuestion'->>'deadlineAt')::timestamptz-
    (v_room.game_state->'board'->'quizQuestion'->>'startedAt')::timestamptz
  ));
  IF abs(v_seconds-15)>0.001 THEN RAISE EXCEPTION 'SMOKE_FAIL: first question is not exactly 15 seconds'; END IF;
  IF (v_room.game_state->'board'->'quizQuestion') ? 'correctChoice'
     OR (v_room.game_state->'board'->'quizQuestion') ? 'explanation'
     OR (v_room.game_state->'board'->'quizQuestion') ? 'source' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: answer key leaked before timeout';
  END IF;
  SELECT secret_state INTO v_secret FROM public.game_room_private_state WHERE room_id=v_room.id;
  IF v_secret->'quizQuestion'->>'correctChoice'<>'1' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: correct answer was not stored privately';
  END IF;
  INSERT INTO online_quiz_smoke_results VALUES('15-second deadline and private answer key',true);

  -- Move the deadline well into the future so the premature-timeout test is deterministic.
  UPDATE public.game_rooms
    SET game_state=jsonb_set(game_state,'{board,quizQuestion,deadlineAt}',
          to_jsonb((pg_catalog.clock_timestamp()+interval '1 minute')::text),true),
        updated_at=pg_catalog.clock_timestamp()
    WHERE id=v_room.id RETURNING * INTO v_room;

  v_stale:=v_room.updated_at;
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_host,'submit',NULL,1,v_room.updated_at
  );
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_guest,'submit',NULL,0,v_room.updated_at
  );

  v_caught:=false;
  BEGIN
    PERFORM public.engine_v3_apply_quiz_action(v_room.id,v_guest,'submit',NULL,1,v_room.updated_at);
  EXCEPTION WHEN unique_violation THEN
    v_caught:=true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'SMOKE_FAIL: duplicate answer was accepted'; END IF;
  INSERT INTO online_quiz_smoke_results VALUES('one answer per player',true);

  v_caught:=false;
  BEGIN
    PERFORM public.engine_v3_apply_quiz_action(v_room.id,v_guest,'timeout',NULL,NULL,v_stale);
  EXCEPTION WHEN serialization_failure THEN
    v_caught:=true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'SMOKE_FAIL: stale room write was accepted'; END IF;
  INSERT INTO online_quiz_smoke_results VALUES('stale concurrent writes rejected',true);

  UPDATE public.game_rooms
    SET game_state=jsonb_set(game_state,'{board,quizQuestion,deadlineAt}',
          to_jsonb((pg_catalog.clock_timestamp()-interval '1 second')::text),true),
        updated_at=pg_catalog.clock_timestamp()
    WHERE id=v_room.id RETURNING * INTO v_room;
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_guest,'timeout',NULL,NULL,v_room.updated_at
  );
  IF coalesce((v_room.game_state->'board'->'quizQuestion'->>'revealed')::boolean,false) IS NOT TRUE
     OR coalesce((v_room.game_state->'board'->'quizQuestion'->>'correctChoice')::integer,-1)<>1 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: correct answer was not revealed after the deadline';
  END IF;
  IF coalesce((v_room.game_state->'scores'->>v_host::text)::integer,0)<>1
     OR coalesce((v_room.game_state->'scores'->>v_guest::text)::integer,0)<>0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: server-side answer scoring is incorrect';
  END IF;
  SELECT private_state INTO v_host_private FROM public.game_room_player_private_state
    WHERE room_id=v_room.id AND user_id=v_host;
  SELECT private_state INTO v_guest_private FROM public.game_room_player_private_state
    WHERE room_id=v_room.id AND user_id=v_guest;
  IF (v_host_private->'quizResult'->>'isCorrect') IS DISTINCT FROM 'true'
     OR (v_guest_private->'quizResult'->>'isCorrect') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: player-specific answer feedback was not isolated';
  END IF;
  INSERT INTO online_quiz_smoke_results VALUES('deadline reveal and private per-player scoring',true);

  v_next_question:=jsonb_build_object(
    'public',jsonb_build_object(
      'id','online-quiz-smoke-2','category','math','difficulty','easy',
      'question','ما ناتج ٣ + ٣؟','options',jsonb_build_array('٥','٦','٧','٨')
    ),
    'private',jsonb_build_object(
      'questionId','online-quiz-smoke-2','correctChoice',1,
      'explanation','إضافة ٣ إلى ٣ تساوي ٦.',
      'source',jsonb_build_object('label','OpenStax','url','https://openstax.org/')
    )
  );
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_host,'next',v_question,NULL,v_room.updated_at
  );
  v_caught:=false;
  BEGIN
    PERFORM public.engine_v3_apply_quiz_action(v_room.id,v_host,'next',v_question,NULL,v_room.updated_at);
  EXCEPTION WHEN unique_violation THEN
    v_caught:=true;
  END;
  IF NOT v_caught THEN RAISE EXCEPTION 'SMOKE_FAIL: repeated question accepted'; END IF;
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_host,'next',v_next_question,NULL,v_room.updated_at
  );
  IF (v_room.game_state->'board'->'quizQuestion'->>'questionNumber')::integer<>2 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: next question did not advance';
  END IF;
  v_seconds:=extract(epoch FROM (
    (v_room.game_state->'board'->'quizQuestion'->>'deadlineAt')::timestamptz-
    (v_room.game_state->'board'->'quizQuestion'->>'startedAt')::timestamptz
  ));
  IF abs(v_seconds-15)>0.001 THEN RAISE EXCEPTION 'SMOKE_FAIL: next question does not receive a fresh 15-second window'; END IF;
  INSERT INTO online_quiz_smoke_results VALUES('no-repeat question history and fresh timer',true);

  UPDATE public.game_rooms
    SET game_state=jsonb_set(game_state,'{board,quizQuestion,deadlineAt}',
          to_jsonb((pg_catalog.clock_timestamp()-interval '1 second')::text),true),
        updated_at=pg_catalog.clock_timestamp()
    WHERE id=v_room.id RETURNING * INTO v_room;
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_guest,'timeout',NULL,NULL,v_room.updated_at
  );
  SELECT * INTO v_room FROM public.engine_v3_apply_quiz_action(
    v_room.id,v_host,'finish',NULL,NULL,v_room.updated_at
  );
  IF v_room.status<>'finished' OR v_room.game_state->>'phase'<>'finished' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: host finish did not close the match';
  END IF;
  INSERT INTO online_quiz_smoke_results VALUES('host-controlled match completion',true);

  IF has_function_privilege('authenticated',
      'public.engine_v3_apply_quiz_action(uuid,uuid,text,jsonb,integer,timestamp with time zone)','EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: authenticated clients can call the service-only quiz RPC';
  END IF;
  INSERT INTO online_quiz_smoke_results VALUES('service-role-only database entry point',true);
END;
$smoke$;

SELECT test_name,passed FROM online_quiz_smoke_results ORDER BY test_name;
ROLLBACK;
