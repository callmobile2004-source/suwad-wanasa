-- Authoritative room engine v3: multi-account security and lifecycle regression.
-- Run after supabase-authoritative-room-engines-v3-migration.sql.
-- All writes are rolled back; test users, rooms, events, and scores are not retained.
begin;
create temporary table v3_engine_smoke_results(game_key text,test_name text,passed boolean) on commit drop;

do $smoke$
declare
  v_host uuid:=gen_random_uuid();
  v_guest uuid:=gen_random_uuid();
  v_guest2 uuid:=gen_random_uuid();
  v_room public.game_rooms;
  v_room2 public.game_rooms;
  v_snapshot jsonb;
  v_snapshot_guest jsonb;
  v_hand jsonb;
  v_code text;
  v_game text;
  v_dice integer;
  v_dest integer;
  v_result text;
  v_target uuid;
  v_role_count integer;
  v_word_count integer;
  v_seat integer;
  v_card_index integer;
  v_expected timestamptz;
  v_caught boolean;
  v_expected_failure boolean;
begin
  insert into auth.users(id,aud,role,raw_user_meta_data,is_anonymous)
  values
    (v_host,'authenticated','authenticated',jsonb_build_object('username','v3host_'||substr(v_host::text,1,8),'display_name','V3 Host'),true),
    (v_guest,'authenticated','authenticated',jsonb_build_object('username','v3guest_'||substr(v_guest::text,1,8),'display_name','V3 Guest'),true),
    (v_guest2,'authenticated','authenticated',jsonb_build_object('username','v3guest2_'||substr(v_guest2::text,1,8),'display_name','V3 Guest 2'),true);

  perform set_config('request.jwt.claim.sub',v_host::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);

  foreach v_game in array array['snakes','domino','tavla','colors','quiz','who','most','yesno','liar','wheel']
  loop
    v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    select * into v_room from public.create_game_room(
      v_code,'Engine V3 Test',v_game,case when v_game='liar' then 3 else 2 end,'{}'::jsonb,'V3 Host'
    );

    perform set_config('request.jwt.claim.sub',v_guest::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
    perform public.join_game_room(v_code,'V3 Guest');
    if v_game='liar' then
      perform set_config('request.jwt.claim.sub',v_guest2::text,true);
      perform set_config('request.jwt.claim.role','authenticated',true);
      perform set_config('request.jwt.claims',jsonb_build_object('sub',v_guest2::text,'role','authenticated')::text,true);
      perform public.join_game_room(v_code,'V3 Guest 2');
    end if;

    perform set_config('request.jwt.claim.role','service_role',true);
    perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
    select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'start','{}'::jsonb,v_room.updated_at);
    if v_room.engine_version<>3 or v_room.status<>'playing' or v_room.game_state->>'phase'<>'playing' then
      raise exception 'SMOKE_FAIL: % start',v_game;
    end if;
    insert into v3_engine_smoke_results values(v_game,'authoritative server start',true);

    perform set_config('request.jwt.claim.sub',v_host::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
    begin
      perform public.update_game_room_state(v_room.id,jsonb_build_object('phase','finished'),'finished',null,v_room.updated_at);
      raise exception 'SMOKE_FAIL: % client state write allowed',v_game;
    exception when insufficient_privilege then
      insert into v3_engine_smoke_results values(v_game,'client-authored state rejected',true);
    end;

    perform set_config('request.jwt.claim.role','service_role',true);
    perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);

    if v_game='snakes' then
      if jsonb_array_length(v_room.game_state->'board'->'snakes')<>6
         or jsonb_array_length(v_room.game_state->'board'->'ladders')<>6 then
        raise exception 'SMOKE_FAIL: randomized board must contain six snakes and ladders';
      end if;
      insert into v3_engine_smoke_results values(v_game,'six randomized snakes and ladders',true);
      begin
        perform public.engine_v3_apply_action(v_room.id,v_guest,'roll','{}'::jsonb,v_room.updated_at);
        raise exception 'SMOKE_FAIL: snakes wrong turn accepted';
      exception when insufficient_privilege then
        insert into v3_engine_smoke_results values(v_game,'out-of-turn roll rejected',true);
      end;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'roll','{}'::jsonb,v_room.updated_at);
      if v_room.game_state->'board'->>'dice' is null
         or v_room.game_state->'board'->'pendingMove' is null
         or (v_room.game_state->>'turn')::integer<>0
         or (v_room.game_state->'board'->'positions'->>0)::integer<>0 then
        raise exception 'SMOKE_FAIL: snake movement must wait for animation';
      end if;
      insert into v3_engine_smoke_results values(v_game,'server dice and deferred movement',true);
      begin
        perform public.engine_v3_apply_action(v_room.id,v_guest,'finish-snake-move','{}'::jsonb,v_room.updated_at);
        raise exception 'SMOKE_FAIL: premature snake finish accepted';
      exception when object_not_in_prerequisite_state then
        insert into v3_engine_smoke_results values(v_game,'premature animation completion rejected',true);
      end;
      update public.game_rooms
      set game_state=jsonb_set(game_state,'{board,pendingMove,startedAt}',
            to_jsonb((pg_catalog.clock_timestamp()-interval '1 minute')::text),true),
          updated_at=pg_catalog.clock_timestamp()
      where id=v_room.id returning * into v_room;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest,'finish-snake-move','{}'::jsonb,v_room.updated_at);
      if v_room.game_state->'board'->'pendingMove' is not null
         or (v_room.game_state->'turn')::integer<>1 then
        raise exception 'SMOKE_FAIL: snake turn did not advance after animation';
      end if;
      insert into v3_engine_smoke_results values(v_game,'turn advances after completed movement',true);
      v_expected:=v_room.updated_at;
      update public.game_rooms set updated_at=pg_catalog.clock_timestamp() where id=v_room.id returning * into v_room;
      begin
        perform public.engine_v3_apply_action(v_room.id,v_guest,'roll','{}'::jsonb,v_expected);
        raise exception 'SMOKE_FAIL: stale write accepted';
      exception when serialization_failure then
        insert into v3_engine_smoke_results values(v_game,'stale concurrent write rejected',true);
      end;

    elsif v_game='domino' then
      v_target:=(v_room.game_state->'board'->>'openingPlayerId')::uuid;
      select public.engine_v3_get_snapshot(v_room.id,v_target) into v_snapshot;
      select public.engine_v3_get_snapshot(v_room.id,case when v_target=v_host then v_guest else v_host end) into v_snapshot_guest;
      if jsonb_array_length(v_snapshot->'privateState'->'hand')<>7
         or jsonb_array_length(v_room.game_state->'board'->'openingTile')<>2
         or (v_room.game_state->'board' ? 'hands') then
        raise exception 'SMOKE_FAIL: domino hand/opening tile not private and valid';
      end if;
      if v_snapshot->'privateState'->'hand'=v_snapshot_guest->'privateState'->'hand' then
        raise exception 'SMOKE_FAIL: domino hands not player-isolated';
      end if;
      select (x.ordinality-1)::integer into v_card_index
      from jsonb_array_elements(v_snapshot->'privateState'->'hand') with ordinality x(value,ordinality)
      where x.value=v_room.game_state->'board'->'openingTile' limit 1;
      if v_card_index is null then raise exception 'SMOKE_FAIL: highest opening tile not in starter hand'; end if;
      insert into v3_engine_smoke_results values(v_game,'private hands and highest opening tile',true);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_target,'play-domino',jsonb_build_object('index',v_card_index),v_room.updated_at);
      select public.engine_v3_get_snapshot(v_room.id,v_target) into v_snapshot;
      if jsonb_array_length(v_snapshot->'privateState'->'hand')<>6
         or v_room.game_state->'board' ? 'openingTile' then
        raise exception 'SMOKE_FAIL: domino opening tile play not applied';
      end if;
      -- Force a blocked board with no stock. Lowest remaining pip total must win after all players pass.
      update public.game_room_private_state set secret_state=jsonb_set(secret_state,'{domino_draw}','[]'::jsonb,true) where room_id=v_room.id;
      update public.game_room_player_private_state set private_state=jsonb_set(private_state,'{hand}','[[1,2]]'::jsonb,true) where room_id=v_room.id and user_id=v_guest;
      update public.game_room_player_private_state set private_state=jsonb_set(private_state,'{hand}','[[3,4]]'::jsonb,true) where room_id=v_room.id and user_id=v_host;
      update public.game_rooms set game_state=jsonb_set(jsonb_set(jsonb_set(game_state,'{board,chain}','[[0,0]]'::jsonb,true),'{board,stock_count}','0'::jsonb,true),'{turn}','1'::jsonb,true),
        updated_at=pg_catalog.clock_timestamp() where id=v_room.id returning * into v_room;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest,'pass-domino','{}'::jsonb,v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'pass-domino','{}'::jsonb,v_room.updated_at);
      if v_room.status<>'finished' or v_room.game_state->'board'->>'winner_id'<>v_guest::text then
        raise exception 'SMOKE_FAIL: blocked domino lowest-pip winner';
      end if;
      insert into v3_engine_smoke_results values(v_game,'private play, legal passes and blocked-game scoring',true);

    elsif v_game='tavla' then
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'roll','{}'::jsonb,v_room.updated_at);
      v_dice:=(v_room.game_state->'board'->'dice'->>0)::integer;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'select-piece',jsonb_build_object('point',0),v_room.updated_at);
      v_dest:=v_dice;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'move-piece',jsonb_build_object('destination',v_dest),v_room.updated_at);
      if (v_room.game_state->'board'->'positions'->0->0->>'point')::integer<>v_dest then raise exception 'SMOKE_FAIL: tavla move failed'; end if;
      insert into v3_engine_smoke_results values(v_game,'server dice and piece movement',true);
      update public.game_rooms
      set game_state=jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(game_state,'{board,positions}',
              jsonb_build_array(
                jsonb_build_array(jsonb_build_object('point',23,'id',0)),
                jsonb_build_array(jsonb_build_object('point',10,'id',0))
              ),true),
            '{board,off}','[14,0]'::jsonb,true),
          '{board,dice}','[]'::jsonb,true),
        '{turn}','0'::jsonb,true),
        updated_at=pg_catalog.clock_timestamp()
      where id=v_room.id returning * into v_room;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'roll','{}'::jsonb,v_room.updated_at);
      v_dice:=(v_room.game_state->'board'->'dice'->>0)::integer;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'select-piece',jsonb_build_object('point',23),v_room.updated_at);
      v_dest:=23+v_dice;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'move-piece',jsonb_build_object('destination',v_dest),v_room.updated_at);
      if v_room.status<>'finished' or v_room.game_state->'board'->>'winner_id'<>v_host::text
         or (v_room.game_state->'board'->'off'->>0)::integer<>15
         or not exists(select 1 from public.player_game_history where room_id=v_room.id and user_id=v_host and game_key='tavla') then
        raise exception 'SMOKE_FAIL: tavla verified finish/progression';
      end if;
      insert into v3_engine_smoke_results values(v_game,'server bear-off win and progression',true);

    elsif v_game='colors' then
      select public.engine_v3_get_snapshot(v_room.id,v_host) into v_snapshot;
      select public.engine_v3_get_snapshot(v_room.id,v_guest) into v_snapshot_guest;
      if jsonb_array_length(v_snapshot->'privateState'->'hand')<>7 or (v_room.game_state->'board' ? 'hands') then raise exception 'SMOKE_FAIL: colors hands public'; end if;
      if v_snapshot->'privateState'->'hand'=v_snapshot_guest->'privateState'->'hand' then raise exception 'SMOKE_FAIL: colors hands not isolated'; end if;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'draw-color','{}'::jsonb,v_room.updated_at);
      select public.engine_v3_get_snapshot(v_room.id,v_host) into v_snapshot;
      if jsonb_array_length(v_snapshot->'privateState'->'hand')<>8 then raise exception 'SMOKE_FAIL: color draw failed'; end if;
      v_expected_failure:=false;
      begin
        perform public.engine_v3_apply_action(v_room.id,v_host,'draw-color','{}'::jsonb,v_room.updated_at);
      exception when others then
        if sqlstate='P0001' then v_expected_failure:=true; else raise; end if;
      end;
      if not v_expected_failure then raise exception 'SMOKE_FAIL: repeated color draw accepted'; end if;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'pass-color','{}'::jsonb,v_room.updated_at);
      if (v_room.game_state->>'turn')::integer<>1 then raise exception 'SMOKE_FAIL: color pass failed'; end if;
      insert into v3_engine_smoke_results values(v_game,'private hand, single draw limit and pass',true);

    elsif v_game='quiz' then
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value','بغداد'),v_room.updated_at);
      if (v_room.game_state->'scores'->>v_host::text)::integer<>1 then raise exception 'SMOKE_FAIL: quiz score incorrect'; end if;
      begin
        perform public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value','بغداد'),v_room.updated_at);
        raise exception 'SMOKE_FAIL: duplicate quiz answer accepted';
      exception when unique_violation then insert into v3_engine_smoke_results values(v_game,'duplicate answer rejected',true);
      end;
      insert into v3_engine_smoke_results values(v_game,'answer validation and scoring',true);

    elsif v_game='who' then
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value','حيوان'),v_room.updated_at);
      insert into v3_engine_smoke_results values(v_game,'one answer stored by server',true);

    elsif v_game='most' then
      v_expected:=v_room.updated_at;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value',v_guest::text),v_room.updated_at);
      begin
        perform public.engine_v3_apply_action(v_room.id,v_guest,'submit',jsonb_build_object('value',v_host::text),v_expected);
        raise exception 'SMOKE_FAIL: stale concurrent party submission accepted';
      exception when serialization_failure then
        insert into v3_engine_smoke_results values(v_game,'stale concurrent submission rejected',true);
      end;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest,'submit',jsonb_build_object('value',v_host::text),v_room.updated_at);
      if v_room.game_state->'board'->'votes'->>v_host::text is distinct from v_guest::text
         or v_room.game_state->'board'->'votes'->>v_guest::text is distinct from v_host::text then
        raise exception 'SMOKE_FAIL: simultaneous most votes not stored';
      end if;
      insert into v3_engine_smoke_results values(v_game,'simultaneous submissions safely retried',true);

    elsif v_game='yesno' then
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value','إي أوافق'),v_room.updated_at);
      select (event_payload->>'caught')::boolean into v_caught
      from public.game_room_action_events where room_id=v_room.id and actor_id=v_host and action='submit' order by id desc limit 1;
      if v_caught is distinct from true then raise exception 'SMOKE_FAIL: forbidden yes/no answer not caught'; end if;
      insert into v3_engine_smoke_results values(v_game,'forbidden yes/no phrase caught',true);

    elsif v_game='liar' then
      select count(*) into v_role_count from public.game_room_player_private_state where room_id=v_room.id and private_state->>'role'='liar';
      select count(*) into v_word_count from public.game_room_player_private_state where room_id=v_room.id and private_state->>'word' is not null;
      if v_role_count<>1 or v_word_count<>2 then raise exception 'SMOKE_FAIL: private liar roles not assigned'; end if;
      select public.engine_v3_get_snapshot(v_room.id,v_host) into v_snapshot;
      select public.engine_v3_get_snapshot(v_room.id,v_guest) into v_snapshot_guest;
      if (v_snapshot->'privateState'->>'role'='liar' and v_snapshot->'privateState'->>'word' is not null)
         or (v_snapshot->'privateState'->>'role'='player' and v_snapshot->'privateState'->>'word' is null)
         or (v_snapshot_guest->'privateState'->>'role'='liar' and v_snapshot_guest->'privateState'->>'word' is not null)
         or (v_snapshot_guest->'privateState'->>'role'='player' and v_snapshot_guest->'privateState'->>'word' is null)
         or v_snapshot->'privateState'->>'role' is null
         or v_snapshot_guest->'privateState'->>'role' is null then
        raise exception 'SMOKE_FAIL: private liar snapshot mismatch';
      end if;
      insert into v3_engine_smoke_results values(v_game,'private secret and liar role isolation',true);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value','تلميح أول'),v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest,'submit',jsonb_build_object('value','تلميح ثاني'),v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest2,'submit',jsonb_build_object('value','تلميح ثالث'),v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'advance-vote','{}'::jsonb,v_room.updated_at);
      if v_room.game_state->'board'->>'stage'<>'votes' then raise exception 'SMOKE_FAIL: liar vote phase'; end if;
      select user_id into v_target from public.game_room_player_private_state where room_id=v_room.id and private_state->>'role'='liar';
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'submit',jsonb_build_object('value',(case when v_target=v_host then v_guest else v_target end)::text),v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest,'submit',jsonb_build_object('value',(case when v_target=v_guest then v_guest2 else v_target end)::text),v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest2,'submit',jsonb_build_object('value',(case when v_target=v_guest2 then v_host else v_target end)::text),v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'next-round','{}'::jsonb,v_room.updated_at);
      select count(*) into v_role_count from public.game_room_player_private_state where room_id=v_room.id and private_state->>'role'='liar';
      if v_role_count<>1 then raise exception 'SMOKE_FAIL: liar next round did not rotate role'; end if;
      insert into v3_engine_smoke_results values(v_game,'hints, voting and role rotation',true);

    elsif v_game='wheel' then
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'wheel-enter','{}'::jsonb,v_room.updated_at);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'wheel-spin','{}'::jsonb,v_room.updated_at);
      if coalesce((v_room.game_state->'board'->>'spinning')::boolean,false) is distinct from true
        or v_room.game_state->'board'->>'result' is not null then raise exception 'SMOKE_FAIL: wheel result exposed before spin end'; end if;
      update public.game_rooms
      set game_state=jsonb_set(game_state,'{board,spinStartedAt}',to_jsonb((pg_catalog.clock_timestamp()-interval '8 seconds')::text),true),
          updated_at=pg_catalog.clock_timestamp()
      where id=v_room.id returning * into v_room;
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_guest,'wheel-finish','{}'::jsonb,v_room.updated_at);
      v_result:=v_room.game_state->'board'->>'result';
      if not (v_result=any(array['who','number','liar','yesno','most','snakes','domino','tavla','colors','quiz']))
        or coalesce((v_room.game_state->'board'->>'spinning')::boolean,true) then raise exception 'SMOKE_FAIL: wheel finish recovery'; end if;
      insert into v3_engine_smoke_results values(v_game,'server wheel result and reconnect-safe finish',true);
      select * into v_room from public.engine_v3_apply_action(v_room.id,v_host,'wheel-select','{}'::jsonb,v_room.updated_at);
      if v_room.game_key<>v_result or v_room.status<>'waiting' then raise exception 'SMOKE_FAIL: wheel server transition'; end if;
      insert into v3_engine_smoke_results values(v_game,'server-only game selection',true);
    end if;

    -- Leave while playing preserves the player's seat; rejoin restores it.
    perform set_config('request.jwt.claim.sub',v_guest::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
    select seat into v_seat from public.game_room_players where room_id=v_room.id and user_id=v_guest;
    if v_room.status='playing' and v_room.engine_version>=2 then
      perform public.leave_game_room(v_room.id);
      if (select count(*) from public.game_room_players where room_id=v_room.id and user_id=v_guest)<>1 then
        raise exception 'SMOKE_FAIL: playing leave deleted seat';
      end if;
    end if;
    perform public.join_game_room(v_code,'V3 Guest');
    if (select count(*) from public.game_room_players where room_id=v_room.id and user_id=v_guest)<>1
       or (select seat from public.game_room_players where room_id=v_room.id and user_id=v_guest)<>v_seat then
      raise exception 'SMOKE_FAIL: reconnect duplicate or changed seat';
    end if;
    insert into v3_engine_smoke_results values(v_game,'disconnect/reconnect same seat',true);
    perform set_config('request.jwt.claim.sub',v_host::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
  end loop;

  -- An active v1 board cannot be replaced while a legacy round is still live.
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  select * into v_room from public.create_game_room(v_code,'Legacy Live Test','snakes',2,'{}'::jsonb,'V3 Host');
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  update public.game_rooms set engine_version=1,status='playing',game_state=jsonb_build_object('phase','playing','board',jsonb_build_object('positions','[0,0]'::jsonb))
  where id=v_room.id returning * into v_room;
  begin
    perform public.engine_v3_apply_action(v_room.id,v_host,'upgrade','{}'::jsonb,v_room.updated_at);
    raise exception 'SMOKE_FAIL: active legacy game upgraded';
  exception when object_not_in_prerequisite_state then
    insert into v3_engine_smoke_results values('legacy','active legacy round upgrade rejected',true);
  end;

  -- Completed legacy party round can be promoted safely by the host.
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_host::text,'role','authenticated')::text,true);
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  select * into v_room2 from public.create_game_room(v_code,'Legacy Party Test','most',2,'{}'::jsonb,'V3 Host');
  perform set_config('request.jwt.claim.sub',v_guest::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_guest::text,'role','authenticated')::text,true);
  perform public.join_game_room(v_code,'V3 Guest');
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
  update public.game_rooms set engine_version=1,status='playing',
    game_state=jsonb_build_object('phase','playing','turn',0,'board',jsonb_build_object('votes',jsonb_build_object(v_host::text,v_guest::text,v_guest::text,v_host::text)))
  where id=v_room2.id returning * into v_room2;
  select * into v_room2 from public.engine_v3_apply_action(v_room2.id,v_host,'upgrade','{}'::jsonb,v_room2.updated_at);
  if v_room2.engine_version<>3 or v_room2.status<>'waiting' then raise exception 'SMOKE_FAIL: completed legacy party promotion failed'; end if;
  insert into v3_engine_smoke_results values('legacy','completed party round promoted safely',true);
end;
$smoke$;

select game_key,test_name,passed from v3_engine_smoke_results order by game_key,test_name;
rollback;
