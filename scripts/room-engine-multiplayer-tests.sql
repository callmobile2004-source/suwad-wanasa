\set ON_ERROR_STOP on

DO $target_guard$
begin
  if current_database() <> 'suwad_engine_test' then
    raise exception 'Refusing to run room-engine test data/scripts outside suwad_engine_test.';
  end if;
  if not exists (select 1 from pg_roles where rolname=session_user and rolsuper) then
    raise exception 'Room-engine test scripts require the isolated CI superuser session.';
  end if;
end
$target_guard$;

do $room_engine_tests$
declare
  v_host uuid := '10000000-0000-4000-8000-000000000001';
  v_player uuid := '10000000-0000-4000-8000-000000000002';
  v_outsider uuid := '10000000-0000-4000-8000-000000000003';
  v_legacy_id uuid := '20000000-0000-4000-8000-000000000001';
  v_legacy public.game_rooms;
  v_room public.game_rooms;
  v_stale timestamptz;
  v_count integer;
  v_i integer;
  v_sig text;
  v_oid regprocedure;
  v_card jsonb;
  v_host_card jsonb;
  v_outsider_card jsonb;
  v_domino_host_hand jsonb;
  v_domino_player_hand jsonb;
  v_domino_deal jsonb;
  v_hand_host jsonb;
  v_hand_player jsonb;
  v_boneyard jsonb;
  v_tile_no integer;
  v_a integer;
  v_b integer;
begin
  -- Verify that v1 outcomes were archived and removed from public live state.
  select * into v_legacy from public.game_rooms where id=v_legacy_id;
  if not found or v_legacy.engine_version<>2 or v_legacy.status<>'waiting'
     or v_legacy.game_state->>'phase'<>'lobby'
     or v_legacy.game_state->'board' ? 'secret'
     or v_legacy.game_state->'board' ? 'revealed_number' then
    raise exception 'Legacy room was not safely reset to the v2 lobby.';
  end if;
  if not exists (
    select 1 from public.game_room_engine_events e
    where e.room_id=v_legacy_id and e.event_type='legacy_state_archived'
      and e.event_payload->'old_game_state'->'board'->>'secret'='42'
  ) then
    raise exception 'The original v1 state was not preserved in the private archive.';
  end if;
  if exists (select 1 from public.player_game_history h where h.room_id=v_legacy_id) then
    raise exception 'An untrusted legacy result was incorrectly awarded progression.';
  end if;

  -- An orphaned stored host must be replaced by the first remaining seated
  -- member; the old host and old board remain visible in the private archive.
  if not exists(
    select 1 from public.game_rooms r
    where r.id='20000000-0000-4000-8000-000000000002'
      and r.engine_version=2 and r.status='waiting'
      and r.host_id=v_player
      and exists(select 1 from public.game_room_players p where p.room_id=r.id and p.user_id=r.host_id)
  ) then
    raise exception 'Legacy migration left a waiting room without transferring an absent host.';
  end if;
  if not exists(
    select 1 from public.game_room_engine_events e
    where e.room_id='20000000-0000-4000-8000-000000000002'
      and e.event_type='legacy_state_archived'
      and e.event_payload->>'old_host_id'=v_host::text
      and e.event_payload->'old_game_state'->'board'->>'private_guess'='must be archived'
  ) then
    raise exception 'Orphaned-host migration failed to preserve previous host and state metadata.';
  end if;

  -- Engine internals and generic client-authored state writes must not be
  -- directly callable/readable by anon or authenticated browser sessions.
  if has_function_privilege('authenticated',
       'public.update_game_room_state(uuid,jsonb,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon',
       'public.update_game_room_state(uuid,jsonb,text,text,timestamptz)','EXECUTE') then
    raise exception 'Browser roles can still call the legacy arbitrary-state RPC.';
  end if;
  if has_function_privilege('authenticated',
       'public.engine_v2_guess_number(uuid,uuid,integer,timestamptz)','EXECUTE')
     or has_function_privilege('anon',
       'public.engine_v2_guess_number(uuid,uuid,integer,timestamptz)','EXECUTE') then
    raise exception 'Browser roles can directly call the number engine RPC.';
  end if;
  if has_function_privilege('authenticated',
       'public.engine_v2_consume_action_slot(uuid,uuid)','EXECUTE')
     or has_function_privilege('anon',
       'public.engine_v2_consume_action_slot(uuid,uuid)','EXECUTE') then
    raise exception 'Browser roles can directly consume server action slots.';
  end if;
  if has_table_privilege('authenticated','public.game_room_private_state','SELECT')
     or has_table_privilege('authenticated','public.game_room_private_state','INSERT')
     or has_table_privilege('authenticated','public.game_room_private_state','UPDATE')
     or has_table_privilege('authenticated','public.game_room_private_state','DELETE')
     or has_table_privilege('authenticated','public.game_room_engine_events','SELECT')
     or has_table_privilege('authenticated','public.game_room_engine_events','INSERT')
     or has_table_privilege('authenticated','public.game_room_engine_events','UPDATE')
     or has_table_privilege('authenticated','public.game_room_engine_events','DELETE')
     or has_table_privilege('authenticated','public.game_room_engine_rate_limits','SELECT')
     or has_table_privilege('authenticated','public.game_room_engine_rate_limits','INSERT')
     or has_table_privilege('authenticated','public.game_room_engine_rate_limits','UPDATE')
     or has_table_privilege('authenticated','public.game_room_engine_rate_limits','DELETE')
     or has_table_privilege('anon','public.game_room_private_state','SELECT')
     or has_table_privilege('anon','public.game_room_private_state','INSERT')
     or has_table_privilege('anon','public.game_room_private_state','UPDATE')
     or has_table_privilege('anon','public.game_room_private_state','DELETE')
     or has_table_privilege('anon','public.game_room_engine_events','SELECT')
     or has_table_privilege('anon','public.game_room_engine_events','INSERT')
     or has_table_privilege('anon','public.game_room_engine_events','UPDATE')
     or has_table_privilege('anon','public.game_room_engine_events','DELETE')
     or has_table_privilege('anon','public.game_room_engine_rate_limits','SELECT')
     or has_table_privilege('anon','public.game_room_engine_rate_limits','INSERT')
     or has_table_privilege('anon','public.game_room_engine_rate_limits','UPDATE')
     or has_table_privilege('anon','public.game_room_engine_rate_limits','DELETE') then
    raise exception 'Browser roles have unexpected access to private engine tables.';
  end if;
  if not has_table_privilege('service_role','public.game_rooms','SELECT') then
    raise exception 'The service role is missing required room table access in CI.';
  end if;
  -- Auth user records are not directly exposed to anon/authenticated roles.
  if has_table_privilege('anon','auth.users','SELECT')
     or has_table_privilege('anon','auth.users','INSERT')
     or has_table_privilege('anon','auth.users','UPDATE')
     or has_table_privilege('anon','auth.users','DELETE')
     or has_table_privilege('authenticated','auth.users','SELECT')
     or has_table_privilege('authenticated','auth.users','INSERT')
     or has_table_privilege('authenticated','auth.users','UPDATE')
     or has_table_privilege('authenticated','auth.users','DELETE') then
    raise exception 'Browser roles have unexpected direct access to auth.users.';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.game_room_private_state'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.game_room_engine_events'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.game_room_engine_rate_limits'::regclass) then
    raise exception 'RLS is not enabled on every private engine table.';
  end if;

  -- Check every client-facing game-engine RPC: service_role only.
  foreach v_sig in array array[
    'public.engine_v2_start_number_game(uuid,uuid,integer,timestamptz)',
    'public.engine_v2_restart_number_game(uuid,uuid,integer,timestamptz)',
    'public.engine_v2_guess_number(uuid,uuid,integer,timestamptz)',
    'public.engine_v2_start_most_game(uuid,uuid,timestamptz)',
    'public.engine_v2_vote_most(uuid,uuid,uuid,timestamptz)',
    'public.engine_v2_next_most_question(uuid,uuid,timestamptz)',
    'public.engine_v2_restart_most_game(uuid,uuid,timestamptz)',
    'public.engine_v2_start_quiz_game(uuid,uuid,timestamptz)',
    'public.engine_v2_answer_quiz(uuid,uuid,text,timestamptz)',
    'public.engine_v2_next_quiz_question(uuid,uuid,timestamptz)',
    'public.engine_v2_restart_quiz_game(uuid,uuid,timestamptz)',
    'public.engine_v2_start_yesno_game(uuid,uuid,timestamptz)',
    'public.engine_v2_answer_yesno_game(uuid,uuid,boolean,timestamptz)',
    'public.engine_v2_next_yesno_question(uuid,uuid,timestamptz)',
    'public.engine_v2_restart_yesno_game(uuid,uuid,timestamptz)',
    'public.engine_v2_start_liar_game(uuid,uuid,text,text,uuid,timestamptz)',
    'public.engine_v2_get_liar_card(uuid,uuid)',
    'public.engine_v2_submit_liar_hint(uuid,uuid,text,timestamptz)',
    'public.engine_v2_vote_liar(uuid,uuid,uuid,timestamptz)',
    'public.engine_v2_restart_liar_game(uuid,uuid,text,text,uuid,timestamptz)',
    'public.engine_v2_start_snakes_game(uuid,uuid,timestamptz)',
    'public.engine_v2_roll_snakes(uuid,uuid,integer,timestamptz)',
    'public.engine_v2_restart_snakes_game(uuid,uuid,timestamptz)',
    'public.engine_v2_start_domino_game(uuid,uuid,jsonb,jsonb,uuid,timestamptz,boolean)',
    'public.engine_v2_get_domino_hand(uuid,uuid)',
    'public.engine_v2_play_domino(uuid,uuid,integer,integer,text,timestamptz)',
    'public.engine_v2_draw_domino(uuid,uuid,timestamptz)',
    'public.engine_v2_pass_domino(uuid,uuid,timestamptz)',
    'public.engine_v2_restart_domino_game(uuid,uuid,jsonb,jsonb,uuid,timestamptz)',
    'public.engine_v2_start_who_game(uuid,uuid,text,text,timestamptz)',
    'public.engine_v2_guess_who(uuid,uuid,text,timestamptz)',
    'public.engine_v2_start_colors_game(uuid,uuid,jsonb,jsonb,jsonb,timestamptz)',
    'public.engine_v2_play_colors(uuid,uuid,text,text,timestamptz)',
    'public.engine_v2_get_colors_hand(uuid,uuid)',
    'public.engine_v2_draw_colors(uuid,uuid,timestamptz)',
    'public.engine_v2_pass_colors(uuid,uuid,timestamptz)',
    'public.engine_v2_start_tavla_game(uuid,uuid,timestamptz)',
    'public.engine_v2_roll_tavla(uuid,uuid,integer,integer,timestamptz)',
    'public.engine_v2_move_tavla(uuid,uuid,integer,integer,timestamptz)',
    'public.engine_v2_pass_tavla(uuid,uuid,timestamptz)',
    'public.engine_v2_restart_tavla(uuid,uuid,timestamptz)',
    'public.engine_v2_start_wheel(uuid,uuid,timestamptz)',
    'public.engine_v2_wheel_stage(uuid,uuid,text,timestamptz)',
    'public.engine_v2_spin_wheel(uuid,uuid,text,integer,timestamptz)',
    'public.engine_v2_adopt_wheel_result(uuid,uuid,timestamptz)',
    'public.engine_v2_consume_action_slot(uuid,uuid)'
  ]
  loop
    v_oid:=to_regprocedure(v_sig);
    if v_oid is null then
      raise exception 'Required server RPC is missing: %',v_sig;
    end if;
    if has_function_privilege('authenticated',v_oid,'EXECUTE')
       or has_function_privilege('anon',v_oid,'EXECUTE') then
      raise exception 'A browser role can directly execute server RPC: %',v_sig;
    end if;
    if not has_function_privilege('service_role',v_oid,'EXECUTE') then
      raise exception 'The Edge Function service role cannot execute RPC: %',v_sig;
    end if;
  end loop;

  -- The request's verified Supabase identity is simulated as two different
  -- authenticated accounts. Room creation/joining still uses the Auth UID.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room(
    'NUM002','Number engine CI','number',2,'{}'::jsonb,'Engine Host'
  );
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('NUM002','Engine Player');
  select * into v_room from public.game_rooms where id=v_room.id;
  if (select count(*) from public.game_room_players where room_id=v_room.id)<>2 then
    raise exception 'Two-account room membership did not persist.';
  end if;

  -- A non-member cannot consume room quota, even though the Edge service key
  -- is used for the database RPC. The rejection occurs before any quota row.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  begin
    perform public.engine_v2_consume_action_slot(v_room.id,v_outsider);
    raise exception 'A non-member unexpectedly consumed a room action slot.';
  exception when insufficient_privilege then
    null;
  end;
  if exists(select 1 from public.game_room_engine_rate_limits
            where room_id=v_room.id and actor_id=v_outsider) then
    raise exception 'A non-member left a rate-limit row behind.';
  end if;

  -- Start the game with trusted private state; no secret is placed in the
  -- public room JSON. The service-only SQL RPC receives the host UID.
  v_room:=public.engine_v2_start_number_game(v_room.id,v_host,42,v_room.updated_at);
  v_stale:=v_room.updated_at;
  if v_room.game_state->'board' ? 'secret'
     or v_room.game_state->'board' ? 'revealed_number'
     or (select secret_state->>'number' from public.game_room_private_state
         where room_id=v_room.id)<>'42' then
    raise exception 'Number secret is not isolated from public room state.';
  end if;

  -- Direct invocation by an authenticated role claim must fail.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  begin
    perform public.engine_v2_guess_number(v_room.id,v_player,41,v_stale);
    raise exception 'A browser role unexpectedly executed the number engine.';
  exception when insufficient_privilege then
    null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';

  -- One member submits a move. The same version cannot be replayed by a
  -- second account after the room has advanced.
  v_room:=public.engine_v2_guess_number(v_room.id,v_player,41,v_stale);
  begin
    perform public.engine_v2_guess_number(v_room.id,v_host,42,v_stale);
    raise exception 'A stale state version was unexpectedly accepted.';
  exception when serialization_failure then
    null;
  end;
  select * into v_room from public.game_rooms where id=v_room.id;
  v_room:=public.engine_v2_guess_number(v_room.id,v_host,42,v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'winner_id'<>v_host::text
     or v_room.game_state->'board'->>'revealed_number'<>'42'
     or exists(select 1 from public.game_room_private_state where room_id=v_room.id) then
    raise exception 'Trusted number result or private-state cleanup failed.';
  end if;
  select count(*)::integer into v_count
  from public.player_game_history where room_id=v_room.id;
  if v_count<>2 then
    raise exception 'Progression did not award exactly once to the two room members.';
  end if;
  if (select xp from public.player_progress where user_id=v_host)<>10
     or (select xp from public.player_progress where user_id=v_player)<>10 then
    raise exception 'Progression awarded an incorrect amount or missed a room member.';
  end if;

  -- The per-account cap is enforced under a room-scoped lock.
  select * into v_room from public.game_rooms where id=v_room.id;
  for v_i in 1..40 loop
    perform public.engine_v2_consume_action_slot(v_room.id,v_host);
  end loop;
  begin
    perform public.engine_v2_consume_action_slot(v_room.id,v_host);
    raise exception 'The 41st action was unexpectedly accepted.';
  exception when program_limit_exceeded then
    null;
  end;

  -- The old generic API must reject a forged board even for a valid member.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  begin
    perform public.update_game_room_state(v_room.id,'{"phase":"finished","scores":{"forged":999999}}'::jsonb,'finished',null,v_room.updated_at);
    raise exception 'The legacy arbitrary-state RPC accepted a forged result.';
  exception when insufficient_privilege then
    null;
  end;

  -- Exercise server-owned movement and turn ordering with a second room.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  v_room:=public.create_game_room(
    'SNK002','Snakes engine CI','snakes',2,'{}'::jsonb,'Engine Host'
  );
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('SNK002','Engine Player');
  select * into v_room from public.game_rooms where room_code='SNK002';
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  v_room:=public.engine_v2_start_snakes_game(v_room.id,v_host,v_room.updated_at);
  v_stale:=v_room.updated_at;

  -- The second account cannot jump the first player's turn.
  begin
    perform public.engine_v2_roll_snakes(v_room.id,v_player,3,v_stale);
    raise exception 'A player acted out of turn.';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.engine_v2_roll_snakes(v_room.id,v_host,7,v_stale);
    raise exception 'An out-of-range server dice value was accepted.';
  exception when invalid_parameter_value then
    null;
  end;
  v_room:=public.engine_v2_roll_snakes(v_room.id,v_host,1,v_stale);
  v_stale:=v_room.updated_at;
  if v_room.game_state->'board'->'positions'->>0<>'1'
     or v_room.game_state->'board'->>'turn'<>'1' then
    raise exception 'Snakes and Ladders server movement/turn result is incorrect.';
  end if;
  begin
    perform public.engine_v2_roll_snakes(v_room.id,v_host,2,v_stale);
    raise exception 'The first player received a second consecutive turn.';
  exception when insufficient_privilege then
    null;
  end;
  v_room:=public.engine_v2_roll_snakes(v_room.id,v_player,6,v_stale);
  if v_room.game_state->'board'->'positions'->>1<>'6'
     or v_room.game_state->'board'->>'turn'<>'0' then
    raise exception 'Second-account turn did not advance correctly.';
  end if;

  -- Liar: secret role and word are delivered per authenticated member only.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room(
    'LIA002','Liar engine CI','liar',3,'{}'::jsonb,'Engine Host'
  );
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('LIA002','Engine Player');
  perform set_config('request.jwt.claim.sub',v_outsider::text,true);
  perform public.join_game_room('LIA002','Engine Outsider');
  select * into v_room from public.game_rooms where room_code='LIA002';
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  v_room:=public.engine_v2_start_liar_game(
    v_room.id,v_host,'كباب','أكلات',v_outsider,v_room.updated_at
  );
  if v_room.game_state::text like '%كباب%'
     or v_room.game_state->'board' ? 'secret_word'
     or v_room.game_state->'board' ? 'outsider_id' then
    raise exception 'Liar secret word or outsider identity leaked into public room state.';
  end if;
  v_host_card:=public.engine_v2_get_liar_card(v_room.id,v_host);
  v_outsider_card:=public.engine_v2_get_liar_card(v_room.id,v_outsider);
  if v_host_card->>'is_outsider'<>'false'
     or v_host_card->>'secret_word'<>'كباب'
     or v_outsider_card->>'is_outsider'<>'true'
     or v_outsider_card->>'secret_word' is not null
     or v_host_card->>'category'<>'أكلات'
     or v_outsider_card->>'category'<>'أكلات' then
    raise exception 'Liar cards did not isolate the outsider role and secret word per player.';
  end if;
  begin
    perform public.engine_v2_get_liar_card(v_room.id,'10000000-0000-4000-8000-000000000004');
    raise exception 'A non-member obtained a liar card.';
  exception when insufficient_privilege then
    null;
  end;

  v_room:=public.engine_v2_submit_liar_hint(v_room.id,v_host,'ريحة طيبة',v_room.updated_at);
  if jsonb_array_length(v_room.game_state->'board'->'hints')<>0
     or v_room.game_state->'board'->>'phase'<>'hints' then
    raise exception 'Liar hints became public before every player submitted.';
  end if;
  v_room:=public.engine_v2_submit_liar_hint(v_room.id,v_player,'يؤكل بالغداء',v_room.updated_at);
  v_room:=public.engine_v2_submit_liar_hint(v_room.id,v_outsider,'موجود بالمطاعم',v_room.updated_at);
  if v_room.game_state->'board'->>'phase'<>'voting'
     or jsonb_array_length(v_room.game_state->'board'->'hints')<>3 then
    raise exception 'Liar hint round did not transition to voting after all 3 accounts submitted.';
  end if;

  v_room:=public.engine_v2_vote_liar(v_room.id,v_host,v_outsider,v_room.updated_at);
  if v_room.game_state->'board'->>'vote_count'<>'1'
     or v_room.game_state->'board' ? 'votes' then
    raise exception 'Liar votes were not kept private during the voting round.';
  end if;
  begin
    perform public.engine_v2_vote_liar(v_room.id,v_host,v_outsider,v_room.updated_at);
    raise exception using errcode='P0002',message='Duplicate liar vote was accepted.';
  exception when raise_exception then
    null;
  end;
  v_room:=public.engine_v2_vote_liar(v_room.id,v_player,v_outsider,v_room.updated_at);
  v_room:=public.engine_v2_vote_liar(v_room.id,v_outsider,v_host,v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'outsider_caught'<>'true'
     or v_room.game_state->'board'->>'outsider_id'<>v_outsider::text
     or v_room.game_state->'board'->>'secret_word'<>'كباب'
     or exists(select 1 from public.game_room_private_state where room_id=v_room.id) then
    raise exception 'Liar final tally, winner outcome, or private-state cleanup is incorrect.';
  end if;

  -- Domino: a complete double-six deck is validated, hands stay private,
  -- the opener is enforced and the next account can only play its own tile.
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room(
    'DOM002','Domino engine CI','domino',2,'{}'::jsonb,'Engine Host'
  );
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('DOM002','Engine Player');
  select * into v_room from public.game_rooms where room_code='DOM002';

  v_hand_host:=jsonb_build_array(jsonb_build_array(6,6));
  v_hand_player:='[]'::jsonb;
  v_boneyard:='[]'::jsonb;
  v_tile_no:=0;
  for v_a in 0..6 loop
    for v_b in v_a..6 loop
      if v_a=6 and v_b=6 then
        continue;
      end if;
      if v_tile_no<6 then
        v_hand_host:=v_hand_host||jsonb_build_array(jsonb_build_array(v_a,v_b));
      elsif v_tile_no<13 then
        v_hand_player:=v_hand_player||jsonb_build_array(jsonb_build_array(v_a,v_b));
      else
        v_boneyard:=v_boneyard||jsonb_build_array(jsonb_build_array(v_a,v_b));
      end if;
      v_tile_no:=v_tile_no+1;
    end loop;
  end loop;
  v_domino_deal:=jsonb_build_object(v_host::text,v_hand_host,v_player::text,v_hand_player);
  execute 'reset role';
  perform set_config('request.jwt.claim.role','',true);
  perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  execute 'set local role service_role';
  v_room:=public.engine_v2_start_domino_game(
    v_room.id,v_host,v_domino_deal,v_boneyard,v_host,v_room.updated_at,false
  );
  v_domino_host_hand:=public.engine_v2_get_domino_hand(v_room.id,v_host);
  v_domino_player_hand:=public.engine_v2_get_domino_hand(v_room.id,v_player);
  if jsonb_array_length(v_domino_host_hand->'tiles')<>7
     or jsonb_array_length(v_domino_player_hand->'tiles')<>7
     or v_domino_host_hand->'tiles'=v_domino_player_hand->'tiles'
     or v_domino_host_hand->>'is_current_turn'<>'true'
     or v_domino_player_hand->>'is_current_turn'<>'false'
     or v_room.game_state->'board' ? 'hands'
     or v_room.game_state->'board' ? 'boneyard' then
    raise exception 'Domino server deal or per-player hand privacy is incorrect.';
  end if;
  begin
    perform public.engine_v2_get_domino_hand(
      v_room.id,'10000000-0000-4000-8000-000000000004'
    );
    raise exception 'A non-member obtained a domino hand.';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.engine_v2_play_domino(v_room.id,v_player,0,6,'auto',v_room.updated_at);
    raise exception 'The second domino player moved before the opener.';
  exception when insufficient_privilege then
    null;
  end;
  v_room:=public.engine_v2_play_domino(v_room.id,v_host,6,6,'auto',v_room.updated_at);
  if jsonb_array_length(v_room.game_state->'board'->'chain')<>1
     or v_room.game_state->'board'->>'current_player_id'<>v_player::text
     or v_room.game_state->'board'->'hand_counts'->>v_host::text<>'6' then
    raise exception 'Domino opening double-six was not processed on the server.';
  end if;
  begin
    perform public.engine_v2_play_domino(v_room.id,v_player,6,6,'auto',v_room.updated_at);
    raise exception 'A player played a tile that was not in their private hand.';
  exception when insufficient_privilege then
    null;
  end;
  v_room:=public.engine_v2_play_domino(v_room.id,v_player,0,6,'auto',v_room.updated_at);
  if jsonb_array_length(v_room.game_state->'board'->'chain')<>2
     or v_room.game_state->'board'->>'current_player_id'<>v_host::text
     or v_room.game_state->'board'->'hand_counts'->>v_player::text<>'6'
     or v_room.game_state->'board'->>'right_end'<>'0' then
    raise exception 'Domino tile placement, private hand decrement, or turn advance failed.';
  end if;

  raise notice 'PASS: legacy archive, RLS/ACL, 2-account room joins, service-only RPCs, secret privacy, stale replay rejection, one-time XP, account rate limits, arbitrary-state rejection, server dice/turn validation, private liar cards/hints/votes, and domino hands/turns.';
end
$room_engine_tests$;

select 'PASS: multiplayer room-engine security integration tests' as test_result;
