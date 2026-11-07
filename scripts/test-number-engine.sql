-- Isolated authoritative number-engine integration test.
-- Run only on a disposable Supabase preview branch after the number-engine migrations.
-- All auth users, rooms, events, private secrets, and progression rows are rolled back.
BEGIN;

CREATE TEMP TABLE number_smoke_results(test_name text, passed boolean) ON COMMIT DROP;

DO $number_test$
DECLARE
  v_host uuid:=gen_random_uuid();
  v_guest uuid:=gen_random_uuid();
  v_room public.game_rooms;
  v_wrong public.game_rooms;
  v_won public.game_rooms;
  v_out_of_range boolean:=false;
BEGIN
  INSERT INTO auth.users(id,aud,role,raw_user_meta_data,is_anonymous)
  VALUES
    (v_host,'authenticated','authenticated',jsonb_build_object('username','numh_'||substr(v_host::text,1,8),'display_name','Number Host'),true),
    (v_guest,'authenticated','authenticated',jsonb_build_object('username','numg_'||substr(v_guest::text,1,8),'display_name','Number Guest'),true);

  PERFORM set_config('request.jwt.claim.sub',v_host::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);

  SELECT * INTO v_room FROM public.create_game_room(
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'Number isolated test','number',2,'{}'::jsonb,'Number Host'
  );
  PERFORM set_config('request.jwt.claim.sub',v_guest::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(v_room.room_code,'Number Guest');

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);

  SELECT * INTO v_room FROM public.engine_v2_start_number_game(
    v_room.id,v_host,42,v_room.updated_at
  );
  IF v_room.engine_version<>2 OR v_room.status<>'playing'
     OR v_room.game_state->>'phase'<>'playing'
     OR v_room.game_state->'board' ? 'secret'
     OR NOT EXISTS(
       SELECT 1 FROM public.game_room_private_state
       WHERE room_id=v_room.id AND secret_state->>'number'='42'
     ) THEN
    RAISE EXCEPTION 'NUMBER_SMOKE_FAIL: secret was not initialized privately';
  END IF;
  INSERT INTO number_smoke_results VALUES('server secret initialized privately',true);

  v_out_of_range:=false;
  BEGIN
    PERFORM public.engine_v2_guess_number(v_room.id,v_guest,101,v_room.updated_at);
  EXCEPTION WHEN invalid_parameter_value THEN
    v_out_of_range:=true;
  END;
  IF NOT v_out_of_range THEN
    RAISE EXCEPTION 'NUMBER_SMOKE_FAIL: out-of-range guess was accepted';
  END IF;
  INSERT INTO number_smoke_results VALUES('out-of-range guess rejected',true);

  SELECT * INTO v_wrong FROM public.engine_v2_guess_number(
    v_room.id,v_host,41,v_room.updated_at
  );
  IF v_wrong.status<>'playing'
     OR v_wrong.game_state->'board'->>'hint'<>'الرقم أكبر من تخمينك.'
     OR v_wrong.game_state->'board'->>'last_guess'<>'41' THEN
    RAISE EXCEPTION 'NUMBER_SMOKE_FAIL: incorrect guess hint or feed state is wrong';
  END IF;
  INSERT INTO number_smoke_results VALUES('higher/lower hint persisted for wrong guess',true);

  SELECT * INTO v_won FROM public.engine_v2_guess_number(
    v_room.id,v_guest,42,v_wrong.updated_at
  );
  IF v_won.status<>'finished'
     OR v_won.game_state->>'phase'<>'finished'
     OR v_won.game_state->'board'->>'winner_id'<>v_guest::text
     OR v_won.game_state->'board'->>'revealed_number'<>'42'
     OR EXISTS(SELECT 1 FROM public.game_room_private_state WHERE room_id=v_room.id) THEN
    RAISE EXCEPTION 'NUMBER_SMOKE_FAIL: correct guess did not finish and clear private secret';
  END IF;
  INSERT INTO number_smoke_results VALUES('correct guess finishes game and clears secret',true);

  IF NOT EXISTS(
       SELECT 1 FROM public.game_room_engine_events
       WHERE room_id=v_room.id AND actor_id=v_guest AND event_type='number_guess'
         AND event_payload->>'result'='correct' AND event_payload->>'guess'='42'
     )
     OR NOT EXISTS(
       SELECT 1 FROM public.player_game_history
       WHERE room_id=v_room.id AND user_id=v_host AND game_key='number'
     )
     OR NOT EXISTS(
       SELECT 1 FROM public.player_game_history
       WHERE room_id=v_room.id AND user_id=v_guest AND game_key='number'
     )
     OR NOT EXISTS(
       SELECT 1 FROM public.player_progress
       WHERE user_id=v_guest AND xp>=10 AND games_completed>=1
     ) THEN
    RAISE EXCEPTION 'NUMBER_SMOKE_FAIL: correct guess event or progression reward missing';
  END IF;
  INSERT INTO number_smoke_results VALUES('correct-guess event and progression rewards',true);
END;
$number_test$;

SELECT test_name,passed FROM number_smoke_results ORDER BY test_name;
ROLLBACK;
