-- Custom room rules regression test. All rooms, scores and temporary users are rolled back.
BEGIN;
DO $custom_rules_test$
DECLARE
  h uuid:=gen_random_uuid();
  g uuid:=gen_random_uuid();
  r public.game_rooms;
  nr public.game_rooms;
  t public.game_room_tournaments;
  snap jsonb;
  deadline_before timestamptz;
  deadline_after timestamptz;
  rejected boolean:=false;
  max_number integer;
BEGIN
  INSERT INTO auth.users(id,aud,role,raw_user_meta_data,is_anonymous) VALUES
    (h,'authenticated','authenticated',jsonb_build_object('username','ruleh_'||substr(h::text,1,8),'display_name','Rule Host'),true),
    (g,'authenticated','authenticated',jsonb_build_object('username','ruleg_'||substr(g::text,1,8),'display_name','Rule Guest'),true);

  PERFORM set_config('request.jwt.claim.sub',h::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',h::text,'role','authenticated')::text,true);
  SELECT * INTO r FROM public.create_game_room(upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'Rules Quiz','quiz',2,'{}'::jsonb,'Rule Host');
  PERFORM set_config('request.jwt.claim.sub',g::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',g::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(r.room_code,'Rule Guest');
  SELECT * INTO r FROM public.game_rooms WHERE id=r.id;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  SELECT * INTO r FROM public.engine_update_room_rules(r.id,h,r.updated_at,
    jsonb_build_object('rounds',3,'timeLimitSeconds',30,'pointsPerWin',5,'difficulty','hard'));
  IF r.settings->'rules'->>'difficulty'<>'hard' OR (r.settings->'rules'->>'timeLimitSeconds')::integer<>30 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: custom room rules were not persisted';
  END IF;
  SELECT * INTO t FROM public.engine_create_room_tournament(r.id,h,r.updated_at,3,5);
  SELECT * INTO r FROM public.engine_v3_apply_action(r.id,h,'start','{}'::jsonb,r.updated_at);
  SELECT public.engine_v3_get_snapshot(r.id,h) INTO snap;
  IF (snap->'privateState'->'secretMission'->>'required')::integer<>2 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: hard difficulty did not increase the quiz mission requirement';
  END IF;
  deadline_before:=(r.game_state->>'turnDeadlineAt')::timestamptz;
  IF deadline_before IS NULL THEN RAISE EXCEPTION 'SMOKE_FAIL: round timer was not started'; END IF;

  SELECT * INTO r FROM public.engine_v3_apply_action(r.id,h,'submit',jsonb_build_object('value','بغداد'),r.updated_at);
  SELECT * INTO r FROM public.engine_v3_apply_action(r.id,h,'next-round','{}'::jsonb,r.updated_at);
  deadline_after:=(r.game_state->>'turnDeadlineAt')::timestamptz;
  IF deadline_after IS NULL OR deadline_after<=deadline_before THEN
    RAISE EXCEPTION 'SMOKE_FAIL: round timer was not reset for the next question';
  END IF;

  UPDATE public.game_rooms
  SET game_state=jsonb_set(game_state,'{turnDeadlineAt}',to_jsonb((pg_catalog.clock_timestamp()-interval '1 second')::text),true),
      updated_at=pg_catalog.clock_timestamp()
  WHERE id=r.id RETURNING * INTO r;
  BEGIN
    PERFORM public.engine_v3_apply_action(r.id,h,'submit',jsonb_build_object('value','7'),r.updated_at);
  EXCEPTION WHEN OTHERS THEN
    rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SMOKE_FAIL: late quiz action was not rejected'; END IF;

  SELECT * INTO r FROM public.engine_timeout_room_round(r.id,h,r.updated_at);
  IF r.status<>'finished' OR r.game_state->>'phase'<>'finished' OR r.game_state->>'endedBy'<>'timeout' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: host timeout did not finish the round';
  END IF;
  SELECT * INTO t FROM public.game_room_tournaments WHERE room_id=r.id;
  IF t.current_round<>2 OR t.status<>'active' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament did not record the timed-out round';
  END IF;

  -- Hard difficulty expands number guessing to 1..500 and persists the range in the board.
  PERFORM set_config('request.jwt.claim.sub',h::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',h::text,'role','authenticated')::text,true);
  SELECT * INTO nr FROM public.create_game_room(upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),'Rules Number','number',2,'{}'::jsonb,'Rule Host');
  PERFORM set_config('request.jwt.claim.sub',g::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',g::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(nr.room_code,'Rule Guest');
  SELECT * INTO nr FROM public.game_rooms WHERE id=nr.id;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  SELECT * INTO nr FROM public.engine_update_room_rules(nr.id,h,nr.updated_at,
    jsonb_build_object('rounds',5,'timeLimitSeconds',0,'pointsPerWin',3,'difficulty','hard'));
  SELECT * INTO nr FROM public.engine_v2_start_number_game(nr.id,h,500,nr.updated_at);
  max_number:=coalesce((nr.game_state->'board'->>'maxNumber')::integer,0);
  IF max_number<>500 THEN RAISE EXCEPTION 'SMOKE_FAIL: hard number range was not applied'; END IF;
  rejected:=false;
  BEGIN
    PERFORM public.engine_v2_guess_number(nr.id,h,501,nr.updated_at);
  EXCEPTION WHEN OTHERS THEN
    rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'SMOKE_FAIL: number guess outside difficulty range was accepted'; END IF;
  SELECT * INTO nr FROM public.engine_v2_guess_number(nr.id,h,250,nr.updated_at);
  IF nr.game_state->'board'->>'last_guess'<>'250' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: valid hard-mode number guess was not accepted';
  END IF;
END;
$custom_rules_test$;
ROLLBACK;
