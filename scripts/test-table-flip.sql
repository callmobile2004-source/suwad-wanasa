-- Table Flip regression tests. All temporary users, rooms and events are rolled back.
BEGIN;
DO $table_flip_test$
DECLARE
  v_host uuid:=gen_random_uuid();
  v_guest uuid:=gen_random_uuid();
  v_room public.game_rooms;
  v_actor uuid;
  v_i integer;
  v_score integer;
  v_number_room public.game_rooms;
  v_guest2 uuid:=gen_random_uuid();
  v_guest3 uuid:=gen_random_uuid();
  v_guest4 uuid:=gen_random_uuid();
  v_players uuid[];
  v_guesses integer[]:=ARRAY[11,22,33,44];
BEGIN
  INSERT INTO auth.users(id,aud,role,raw_user_meta_data,is_anonymous)
  VALUES
    (v_host,'authenticated','authenticated',jsonb_build_object('username','tfhost_'||substr(v_host::text,1,8),'display_name','TF Host'),true),
    (v_guest,'authenticated','authenticated',jsonb_build_object('username','tfguest_'||substr(v_guest::text,1,8),'display_name','TF Guest'),true),
    (v_guest2,'authenticated','authenticated',jsonb_build_object('username','tfguest2_'||substr(v_guest2::text,1,8),'display_name','TF Guest 2'),true),
    (v_guest3,'authenticated','authenticated',jsonb_build_object('username','tfguest3_'||substr(v_guest3::text,1,8),'display_name','TF Guest 3'),true),
    (v_guest4,'authenticated','authenticated',jsonb_build_object('username','tfguest4_'||substr(v_guest4::text,1,8),'display_name','TF Guest 4'),true);

  PERFORM set_config('request.jwt.claim.sub',v_host::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
  SELECT * INTO v_room FROM public.create_game_room(
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'Table Flip Smoke','snakes',2,'{}'::jsonb,'TF Host'
  );

  PERFORM set_config('request.jwt.claim.sub',v_guest::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
  PERFORM public.join_game_room(v_room.room_code,'TF Guest');

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  SELECT * INTO v_room FROM public.engine_v3_apply_action(v_room.id,v_host,'start','{}'::jsonb,v_room.updated_at);

  FOR v_i IN 1..4 LOOP
    v_actor:=CASE WHEN mod(v_i,2)=1 THEN v_host ELSE v_guest END;
    SELECT * INTO v_room FROM public.engine_v3_apply_action(v_room.id,v_actor,'roll','{}'::jsonb,v_room.updated_at);
  END LOOP;
  IF v_room.game_state->'tableFlip'->'lastEvent' IS NULL
     OR (v_room.game_state->'tableFlip'->'lastEvent'->>'actionNumber')::integer<>4 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: v3 engine did not create the fourth-action surprise';
  END IF;

  UPDATE public.game_rooms
  SET game_state=jsonb_set(game_state,'{tableFlip}',jsonb_build_object(
    'enabled',true,
    'activeChallenge',jsonb_build_object(
      'targetId',v_guest::text,'targetName','TF Guest','text','Test challenge',
      'bonus',2,'status','pending','claimed',false,'claimedBy',null
    )
  ),true),updated_at=pg_catalog.clock_timestamp()
  WHERE id=v_room.id RETURNING * INTO v_room;

  SELECT * INTO v_room FROM public.engine_resolve_table_flip_challenge(
    v_room.id,v_guest,'claim-table-flip-challenge',v_room.updated_at
  );
  SELECT * INTO v_room FROM public.engine_resolve_table_flip_challenge(
    v_room.id,v_host,'confirm-table-flip-challenge',v_room.updated_at
  );
  v_score:=coalesce((v_room.game_state->'scores'->>v_guest::text)::integer,0);
  IF v_score<>2 OR v_room.game_state->'tableFlip'->'activeChallenge'->>'status'<>'completed' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: challenge confirmation did not award the expected points';
  END IF;

  -- Verify the separate v2 number engine also emits a shared Table Flip event.
  v_players:=ARRAY[v_host,v_guest,v_guest2,v_guest3,v_guest4];
  PERFORM set_config('request.jwt.claim.sub',v_host::text,true);
  PERFORM set_config('request.jwt.claim.role','authenticated',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
  SELECT * INTO v_number_room FROM public.create_game_room(
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'Number Table Flip Smoke','number',5,'{}'::jsonb,'TF Host'
  );

  FOREACH v_actor IN ARRAY ARRAY[v_guest,v_guest2,v_guest3,v_guest4] LOOP
    PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated')::text,true);
    PERFORM public.join_game_room(v_number_room.room_code,'TF Guest');
  END LOOP;

  PERFORM set_config('request.jwt.claim.role','service_role',true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  SELECT * INTO v_number_room FROM public.engine_v2_start_number_game(
    v_number_room.id,v_host,100,v_number_room.updated_at
  );
  FOR v_i IN 1..4 LOOP
    v_actor:=v_players[v_i];
    SELECT * INTO v_number_room FROM public.engine_v2_guess_number(
      v_number_room.id,v_actor,v_guesses[v_i],v_number_room.updated_at
    );
  END LOOP;
  IF v_number_room.game_state->'tableFlip'->'lastEvent' IS NULL
     OR (v_number_room.game_state->'tableFlip'->'lastEvent'->>'actionNumber')::integer<>4 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: v2 number engine did not create the fourth-guess surprise';
  END IF;
END;
$table_flip_test$;
ROLLBACK;
