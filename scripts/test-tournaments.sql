-- Room tournament regression test. Uses temporary users and rolls back all fixtures.
BEGIN;
DO $tournament_test$
DECLARE
  v_host uuid:=gen_random_uuid();
  v_guest uuid:=gen_random_uuid();
  v_late_guest uuid:=gen_random_uuid();
  v_room public.game_rooms;
  v_tournament public.game_room_tournaments;
  v_answer text;
  v_round integer;
  v_question integer;
  v_score integer;
BEGIN
  INSERT INTO auth.users(id,aud,role,raw_user_meta_data,is_anonymous)
  VALUES
    (v_host,'authenticated','authenticated',jsonb_build_object('username','tourh_'||substr(v_host::text,1,8),'display_name','Tour Host'),true),
    (v_guest,'authenticated','authenticated',jsonb_build_object('username','tourg_'||substr(v_guest::text,1,8),'display_name','Tour Guest'),true),
    (v_late_guest,'authenticated','authenticated',jsonb_build_object('username','tourl_'||substr(v_late_guest::text,1,8),'display_name','Tour Late Guest'),true);

  PERFORM set_config('request.jwt.claim.sub',v_host::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
  SELECT * INTO v_room FROM public.create_game_room(
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'Tournament Smoke','quiz',3,'{}'::jsonb,'Tour Host'
  );

  PERFORM set_config('request.jwt.claim.sub',v_guest::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(v_room.room_code,'Tour Guest');
  SELECT * INTO v_room FROM public.game_rooms WHERE id=v_room.id;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  SELECT * INTO v_tournament FROM public.engine_create_room_tournament(
    v_room.id,v_host,v_room.updated_at,2,3
  );
  IF v_tournament.status<>'active' OR v_tournament.total_rounds<>2 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament was not created with the requested settings';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',v_late_guest::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_late_guest::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(v_room.room_code,'Tour Late Guest');
  IF (SELECT count(*) FROM public.game_room_tournament_scores WHERE room_id=v_room.id)<>3 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: a player joining after tournament creation was not added to standings';
  END IF;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  SELECT * INTO v_room FROM public.game_rooms WHERE id=v_room.id;

  FOR v_round IN 1..2 LOOP
    SELECT * INTO v_room FROM public.engine_v3_apply_action(v_room.id,v_host,'start','{}'::jsonb,v_room.updated_at);
    FOR v_question IN 0..2 LOOP
      v_answer:=CASE v_question WHEN 0 THEN 'بغداد' WHEN 1 THEN '7' ELSE 'المشتري' END;
      SELECT * INTO v_room FROM public.engine_v3_apply_action(
        v_room.id,v_host,'submit',jsonb_build_object('value',v_answer),v_room.updated_at
      );
      SELECT * INTO v_room FROM public.engine_v3_apply_action(
        v_room.id,v_host,'next-round','{}'::jsonb,v_room.updated_at
      );
    END LOOP;
    SELECT * INTO v_tournament FROM public.game_room_tournaments WHERE room_id=v_room.id;
    IF v_round=1 AND (v_tournament.status<>'active' OR v_tournament.current_round<>2) THEN
      RAISE EXCEPTION 'SMOKE_FAIL: tournament did not advance to round two';
    END IF;
  END LOOP;

  SELECT * INTO v_tournament FROM public.game_room_tournaments WHERE room_id=v_room.id;
  SELECT points INTO v_score FROM public.game_room_tournament_scores
  WHERE room_id=v_room.id AND user_id=v_host;
  IF v_tournament.status<>'completed' OR v_tournament.champion_id IS DISTINCT FROM v_host THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament did not declare the expected champion';
  END IF;
  IF v_score<>6 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: expected six cumulative tournament points, got %',v_score;
  END IF;
  IF (SELECT count(*) FROM public.game_room_tournament_rounds WHERE room_id=v_room.id)<>2 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament did not store both round results';
  END IF;
END;
$tournament_test$;
ROLLBACK;
