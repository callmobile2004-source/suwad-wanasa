-- Isolated chess RPC integration tests.
-- Run only on a disposable Supabase preview branch after the chess migration.
-- All rows and auth users are rolled back.
BEGIN;

CREATE TEMP TABLE chess_smoke_results(test_name text, passed boolean) ON COMMIT DROP;

DO $chess_test$
DECLARE
  v_host uuid:=gen_random_uuid();
  v_guest uuid:=gen_random_uuid();
  v_room public.game_rooms;
  v_start_fen text:='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  v_legal jsonb;
  v_payload jsonb;
  v_expected timestamptz;
  v_denied boolean:=false;
  v_stale boolean:=false;
BEGIN
  INSERT INTO auth.users(id,aud,role,raw_user_meta_data,is_anonymous)
  VALUES
    (v_host,'authenticated','authenticated',jsonb_build_object('username','chessh_'||substr(v_host::text,1,8),'display_name','Chess Host'),true),
    (v_guest,'authenticated','authenticated',jsonb_build_object('username','chessg_'||substr(v_guest::text,1,8),'display_name','Chess Guest'),true);

  PERFORM set_config('request.jwt.claim.sub',v_host::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);

  SELECT * INTO v_room FROM public.create_game_room(
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'Chess isolated test','chess',2,'{}'::jsonb,'Chess Host'
  );

  PERFORM set_config('request.jwt.claim.sub',v_guest::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(v_room.room_code,'Chess Guest');

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);

  SELECT jsonb_agg(jsonb_build_object('from','a2','to','a3','san','a3','flags','n'))
  INTO v_legal FROM generate_series(1,20);

  v_payload:=jsonb_build_object(
    'fen',v_start_fen,'pgn','','sideToMove','w','turnIndex',0,
    'legalMoves',v_legal
  );
  SELECT * INTO v_room FROM public.engine_v3_apply_chess_action(
    v_room.id,v_host,'start-chess',v_room.updated_at,v_payload
  );
  IF v_room.status<>'playing'
     OR v_room.game_state->>'phase'<>'playing'
     OR v_room.game_state->'board'->>'fen'<>v_start_fen
     OR (v_room.game_state->'board'->>'turnIndex')::integer<>0 THEN
    RAISE EXCEPTION 'CHESS_SMOKE_FAIL: start did not create the standard position';
  END IF;
  INSERT INTO chess_smoke_results VALUES('host starts standard two-player chess',true);

  v_expected:=v_room.updated_at;
  BEGIN
    PERFORM public.engine_v3_apply_chess_action(
      v_room.id,v_guest,'move-chess',v_expected,
      jsonb_build_object('expectedFen',v_start_fen)
    );
    RAISE EXCEPTION 'CHESS_SMOKE_FAIL: out-of-turn move was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied:=true;
  END;
  IF NOT v_denied THEN RAISE EXCEPTION 'CHESS_SMOKE_FAIL: turn ownership was not enforced'; END IF;
  INSERT INTO chess_smoke_results VALUES('out-of-turn player rejected',true);

  BEGIN
    PERFORM public.engine_v3_apply_chess_action(
      v_room.id,v_host,'move-chess',v_expected-interval '1 second',
      jsonb_build_object('expectedFen',v_start_fen)
    );
    RAISE EXCEPTION 'CHESS_SMOKE_FAIL: stale room version was accepted';
  EXCEPTION WHEN serialization_failure THEN
    v_stale:=true;
  END;
  IF NOT v_stale THEN RAISE EXCEPTION 'CHESS_SMOKE_FAIL: optimistic concurrency was not enforced'; END IF;
  INSERT INTO chess_smoke_results VALUES('stale board version rejected',true);

  IF has_function_privilege(
    'authenticated',
    'public.engine_v3_apply_chess_action(uuid,uuid,text,timestamp with time zone,jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'CHESS_SMOKE_FAIL: authenticated role can call service-only chess RPC';
  END IF;
  INSERT INTO chess_smoke_results VALUES('RPC is not executable by authenticated clients',true);
END;
$chess_test$;

SELECT test_name,passed FROM chess_smoke_results ORDER BY test_name;
ROLLBACK;
