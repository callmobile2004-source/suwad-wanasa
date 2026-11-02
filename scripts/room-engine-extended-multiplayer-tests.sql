\set ON_ERROR_STOP on

-- Extended behavioral tests for every v2 room game not fully exercised by
-- room-engine-multiplayer-tests.sql. Run only against the disposable CI DB.
do $room_engine_extended_tests$
declare
  v_host uuid := '10000000-0000-4000-8000-000000000001';
  v_player uuid := '10000000-0000-4000-8000-000000000002';
  v_room public.game_rooms;
  v_private jsonb;
  v_host_hand jsonb;
  v_player_hand jsonb;
  v_deck jsonb := '[]'::jsonb;
  v_deal jsonb;
  v_draw_pile jsonb;
  v_discard jsonb;
  v_color text;
  v_value text;
  v_copy integer;
  v_i integer;
begin
  ---------------------------------------------------------------------------
  -- "منو الأكثر؟": private votes, one vote per account, complete-round gate,
  -- tally/tie calculation, all six rounds, finalization and restart.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('MOST02','Most voting CI','most',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('MOST02','Engine Player');

  perform set_config('request.jwt.claim.role','service_role',true);
  v_room:=public.engine_v2_start_most_game(v_room.id,v_host,v_room.updated_at);
  if v_room.game_state->'board'->>'phase'<>'voting'
     or v_room.game_state->'board' ? 'votes' then
    raise exception 'Most game did not start in a private voting phase.';
  end if;

  v_room:=public.engine_v2_vote_most(v_room.id,v_host,v_player,v_room.updated_at);
  if v_room.game_state->'board'->>'vote_count'<>'1'
     or v_room.game_state->'board'->'tally'<>'{}'::jsonb
     or v_room.game_state->'board' ? 'votes' then
    raise exception 'Most votes or tally leaked before every member voted.';
  end if;
  select secret_state into v_private from public.game_room_private_state where room_id=v_room.id;
  if v_private->'votes'->>v_host::text is distinct from v_player::text then
    raise exception 'Most vote was not stored in private server state.';
  end if;

  begin
    perform public.engine_v2_vote_most(v_room.id,v_host,v_player,v_room.updated_at);
    raise exception using errcode='ZX001',message='Duplicate Most vote was accepted.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_next_most_question(v_room.id,v_host,v_room.updated_at);
    raise exception using errcode='ZX001',message='Most advanced before all votes arrived.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_next_most_question(v_room.id,v_player,v_room.updated_at);
    raise exception using errcode='ZX001',message='Non-host advanced the Most question.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;

  v_room:=public.engine_v2_vote_most(v_room.id,v_player,v_host,v_room.updated_at);
  if v_room.game_state->'board'->>'phase'<>'results'
     or jsonb_array_length(v_room.game_state->'board'->'winners')<>2
     or (select coalesce(sum(value::integer),0) from jsonb_each_text(v_room.game_state->'board'->'tally'))<>2 then
    raise exception 'Most tally or tie result is incorrect.';
  end if;

  for v_i in 1..5 loop
    v_room:=public.engine_v2_next_most_question(v_room.id,v_host,v_room.updated_at);
    if v_room.game_state->'board'->>'phase'<>'voting'
       or (v_room.game_state->'board'->>'question')::integer<>v_i then
      raise exception 'Most question % did not reset correctly.',v_i;
    end if;
    v_room:=public.engine_v2_vote_most(v_room.id,v_host,v_player,v_room.updated_at);
    v_room:=public.engine_v2_vote_most(v_room.id,v_player,v_host,v_room.updated_at);
    if v_room.game_state->'board'->>'phase'<>'results' then
      raise exception 'Most question % did not publish only after both votes.',v_i;
    end if;
  end loop;
  v_room:=public.engine_v2_next_most_question(v_room.id,v_host,v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'phase'<>'finished'
     or exists(select 1 from public.game_room_private_state where room_id=v_room.id) then
    raise exception 'Most finalization or private vote cleanup failed.';
  end if;
  begin
    perform public.engine_v2_restart_most_game(v_room.id,v_player,v_room.updated_at);
    raise exception using errcode='ZX001',message='Non-host restarted Most.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_restart_most_game(v_room.id,v_host,v_room.updated_at);
  if v_room.status<>'playing' or v_room.game_state->'board'->>'question'<>'0' then
    raise exception 'Most restart did not return to a clean first question.';
  end if;

  ---------------------------------------------------------------------------
  -- Quiz: canonical answer checking, private submissions, duplicate denial,
  -- all-player result gate, three questions, scoring and restart.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('QUIZ02','Quiz engine CI','quiz',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('QUIZ02','Engine Player');
  perform set_config('request.jwt.claim.role','service_role',true);

  v_room:=public.engine_v2_start_quiz_game(v_room.id,v_host,v_room.updated_at);
  if v_room.game_state->'board' ? 'correct_answer'
     or v_room.game_state->'board'->'results'<>'{}'::jsonb then
    raise exception 'Quiz answer was exposed at game start.';
  end if;
  begin
    perform public.engine_v2_next_quiz_question(v_room.id,v_player,v_room.updated_at);
    raise exception using errcode='ZX001',message='Non-host advanced the quiz.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_answer_quiz(v_room.id,v_host,'بغداد',v_room.updated_at);
  if v_room.game_state->'board'->>'answer_count'<>'1'
     or v_room.game_state->'board' ? 'correct_answer'
     or v_room.game_state->'board'->'results'<>'{}'::jsonb then
    raise exception 'Quiz exposed the answer before all players responded.';
  end if;
  select secret_state into v_private from public.game_room_private_state where room_id=v_room.id;
  if v_private->'submissions'->>v_host::text is distinct from 'true' then
    raise exception 'Quiz correctness was not stored privately.';
  end if;
  begin
    perform public.engine_v2_answer_quiz(v_room.id,v_host,'بغداد',v_room.updated_at);
    raise exception using errcode='ZX001',message='Duplicate quiz answer was accepted.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_answer_quiz(v_room.id,v_player,'إجابة خاطئة',v_room.updated_at);
  if v_room.game_state->'board'->>'phase'<>'results'
     or v_room.game_state->'board'->>'correct_answer'<>'بغداد'
     or v_room.game_state->'scores'->>v_host::text<>'1'
     or v_room.game_state->'scores'->>v_player::text<>'0' then
    raise exception 'Quiz first-question result or scoring is incorrect.';
  end if;

  for v_i in 1..2 loop
    v_room:=public.engine_v2_next_quiz_question(v_room.id,v_host,v_room.updated_at);
    if v_room.game_state->'board'->>'phase'<>'answering'
       or (v_room.game_state->'board'->>'question')::integer<>v_i
       or v_room.game_state->'board' ? 'correct_answer'
       or v_room.game_state->'board' ? 'results' then
      raise exception 'Quiz question % did not reset or hide prior answers.',v_i;
    end if;
    v_room:=public.engine_v2_answer_quiz(
      v_room.id,v_host,case when v_i=1 then 'سبعة' else 'كوكب المشتري' end,v_room.updated_at
    );
    v_room:=public.engine_v2_answer_quiz(v_room.id,v_player,'إجابة خاطئة',v_room.updated_at);
    if v_room.game_state->'board'->>'phase'<>'results' then
      raise exception 'Quiz question % results were not gated by all players.',v_i;
    end if;
  end loop;
  v_room:=public.engine_v2_next_quiz_question(v_room.id,v_host,v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'phase'<>'finished'
     or v_room.game_state->'scores'->>v_host::text<>'3'
     or v_room.game_state->'scores'->>v_player::text<>'0'
     or exists(select 1 from public.game_room_private_state where room_id=v_room.id) then
    raise exception 'Quiz final score, finish state, or private-state cleanup failed.';
  end if;
  v_room:=public.engine_v2_restart_quiz_game(v_room.id,v_host,v_room.updated_at);
  if v_room.status<>'playing' or v_room.game_state->'board'->>'question'<>'0'
     or v_room.game_state->'board'->>'phase'<>'answering' then
    raise exception 'Quiz restart did not create a clean new round.';
  end if;

  ---------------------------------------------------------------------------
  -- Yes/No: private individual answers, aggregate counts only after both
  -- accounts answer, three questions, finalization and restart.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('YES002','Yes No engine CI','yesno',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('YES002','Engine Player');
  perform set_config('request.jwt.claim.role','service_role',true);

  v_room:=public.engine_v2_start_yesno_game(v_room.id,v_host,v_room.updated_at);
  v_room:=public.engine_v2_answer_yesno_game(v_room.id,v_host,true,v_room.updated_at);
  if v_room.game_state->'board'->>'answer_count'<>'1'
     or v_room.game_state->'board'->>'yes_count'<>'0'
     or v_room.game_state->'board'->>'no_count'<>'0' then
    raise exception 'Yes/No individual answer was exposed before the room completed.';
  end if;
  select secret_state into v_private from public.game_room_private_state where room_id=v_room.id;
  if v_private->'submissions'->>v_host::text is distinct from 'true' then
    raise exception 'Yes/No answer was not held in private state.';
  end if;
  begin
    perform public.engine_v2_answer_yesno_game(v_room.id,v_host,false,v_room.updated_at);
    raise exception using errcode='ZX001',message='Duplicate Yes/No answer was accepted.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_answer_yesno_game(v_room.id,v_player,false,v_room.updated_at);
  if v_room.game_state->'board'->>'phase'<>'results'
     or v_room.game_state->'board'->>'yes_count'<>'1'
     or v_room.game_state->'board'->>'no_count'<>'1' then
    raise exception 'Yes/No aggregate result is incorrect.';
  end if;
  for v_i in 1..2 loop
    v_room:=public.engine_v2_next_yesno_question(v_room.id,v_host,v_room.updated_at);
    if v_room.game_state->'board'->>'phase'<>'answering'
       or (v_room.game_state->'board'->>'question')::integer<>v_i then
      raise exception 'Yes/No question % did not reset.',v_i;
    end if;
    v_room:=public.engine_v2_answer_yesno_game(v_room.id,v_host,(v_i=1),v_room.updated_at);
    v_room:=public.engine_v2_answer_yesno_game(v_room.id,v_player,(v_i=2),v_room.updated_at);
    if v_room.game_state->'board'->>'phase'<>'results' then
      raise exception 'Yes/No question % results were not gated.',v_i;
    end if;
  end loop;
  v_room:=public.engine_v2_next_yesno_question(v_room.id,v_host,v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'phase'<>'finished'
     or exists(select 1 from public.game_room_private_state where room_id=v_room.id) then
    raise exception 'Yes/No finalization or private-state cleanup failed.';
  end if;
  v_room:=public.engine_v2_restart_yesno_game(v_room.id,v_host,v_room.updated_at);
  if v_room.status<>'playing' or v_room.game_state->'board'->>'phase'<>'answering' then
    raise exception 'Yes/No restart did not start a fresh round.';
  end if;

  ---------------------------------------------------------------------------
  -- "خمّن منو آني؟": secret-word isolation, fixed turn order, Arabic input
  -- normalization, correct winner and score.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('WHO002','Who am I engine CI','who',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('WHO002','Engine Player');
  perform set_config('request.jwt.claim.role','service_role',true);

  v_room:=public.engine_v2_start_who_game(v_room.id,v_host,'كباب','أكلات',v_room.updated_at);
  if v_room.game_state::text like '%كباب%'
     or v_room.game_state->'board'->>'current_player_id'<>v_host::text then
    raise exception 'Who-am-I secret word leaked or first turn is incorrect.';
  end if;
  begin
    perform public.engine_v2_guess_who(v_room.id,v_player,'كباب',v_room.updated_at);
    raise exception using errcode='ZX001',message='Who-am-I accepted a guess out of turn.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_guess_who(v_room.id,v_host,'بيتزا',v_room.updated_at);
  if v_room.game_state->'board'->>'current_player_id'<>v_player::text
     or v_room.game_state->>'turn'<>'1' then
    raise exception 'Who-am-I did not pass the turn after an incorrect guess.';
  end if;
  v_room:=public.engine_v2_guess_who(v_room.id,v_player,'كـبَاب',v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'winner_id'<>v_player::text
     or v_room.game_state->'scores'->>v_player::text<>'10'
     or exists(select 1 from public.game_room_private_state where room_id=v_room.id) then
    raise exception 'Who-am-I Arabic normalization, winner, score, or secret cleanup failed.';
  end if;

  ---------------------------------------------------------------------------
  -- Colors: full 60-card composition, isolated hands, own-hand enforcement,
  -- turn order, match rule and draw/pass rejection when a playable card exists.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('COL002','Colors engine CI','colors',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('COL002','Engine Player');

  foreach v_color in array array['أحمر','أزرق','أخضر','أصفر'] loop
    foreach v_value in array array['١','٢','٣','٤','تخطي'] loop
      for v_copy in 1..3 loop
        v_deck:=v_deck||jsonb_build_array(jsonb_build_object('c',v_color,'v',v_value));
      end loop;
    end loop;
  end loop;
  select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb)
    into v_host_hand
  from jsonb_array_elements(v_deck) with ordinality e(value,ordinality)
  where e.ordinality between 1 and 7;
  select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb)
    into v_player_hand
  from jsonb_array_elements(v_deck) with ordinality e(value,ordinality)
  where e.ordinality between 8 and 14;
  select e.value into v_discard
  from jsonb_array_elements(v_deck) with ordinality e(value,ordinality)
  where e.ordinality=15;
  select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb)
    into v_draw_pile
  from jsonb_array_elements(v_deck) with ordinality e(value,ordinality)
  where e.ordinality>15;
  v_deal:=jsonb_build_object(v_host::text,v_host_hand,v_player::text,v_player_hand);

  perform set_config('request.jwt.claim.role','service_role',true);
  v_room:=public.engine_v2_start_colors_game(
    v_room.id,v_host,v_deal,v_draw_pile,v_discard,v_room.updated_at
  );
  if v_room.game_state->'board' ? 'hands'
     or v_room.game_state->'board' ? 'draw_pile'
     or v_room.game_state->'board'->>'draw_count'<>'45' then
    raise exception 'Colors public state exposed private cards or has a wrong draw count.';
  end if;
  v_host_hand:=public.engine_v2_get_colors_hand(v_room.id,v_host)->'tiles';
  v_player_hand:=public.engine_v2_get_colors_hand(v_room.id,v_player)->'tiles';
  if jsonb_array_length(v_host_hand)<>7 or jsonb_array_length(v_player_hand)<>7
     or v_host_hand=v_player_hand then
    raise exception 'Colors per-account hand isolation failed.';
  end if;
  v_room:=public.engine_v2_play_colors(v_room.id,v_host,'أحمر','١',v_room.updated_at);
  begin
    perform public.engine_v2_play_colors(v_room.id,v_player,'أحمر','١',v_room.updated_at);
    raise exception using errcode='ZX001',message='Colors allowed a player to use a card outside their hand.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_play_colors(v_room.id,v_player,'أحمر','٤',v_room.updated_at);
  if v_room.game_state->'board'->>'current_player_id'<>v_host::text
     or v_room.game_state->'board'->'hand_counts'->>v_player::text<>'6' then
    raise exception 'Colors did not advance the turn or decrement the correct hand.';
  end if;
  begin
    perform public.engine_v2_draw_colors(v_room.id,v_host,v_room.updated_at);
    raise exception using errcode='ZX001',message='Colors allowed drawing despite a playable card.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_pass_colors(v_room.id,v_host,v_room.updated_at);
    raise exception using errcode='ZX001',message='Colors allowed passing despite a playable card.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;

  ---------------------------------------------------------------------------
  -- Simplified Tavla: server dice bounds, duplicate-roll denial, legal die
  -- distance, ownership, move order, and turn advancement for two accounts.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('TAV002','Tavla engine CI','tavla',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('TAV002','Engine Player');
  perform set_config('request.jwt.claim.role','service_role',true);

  v_room:=public.engine_v2_start_tavla_game(v_room.id,v_host,v_room.updated_at);
  if jsonb_array_length(v_room.game_state->'board'->'positions'->0)<>15
     or jsonb_array_length(v_room.game_state->'board'->'positions'->1)<>15 then
    raise exception 'Tavla did not initialize exactly fifteen pieces per player.';
  end if;
  begin
    perform public.engine_v2_start_tavla_game(v_room.id,v_player,v_room.updated_at);
    raise exception using errcode='ZX001',message='Non-host started Tavla.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_roll_tavla(v_room.id,v_host,1,2,v_room.updated_at);
  begin
    perform public.engine_v2_roll_tavla(v_room.id,v_host,3,4,v_room.updated_at);
    raise exception using errcode='ZX001',message='Tavla allowed a second roll before using the first dice.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_pass_tavla(v_room.id,v_host,v_room.updated_at);
    raise exception using errcode='ZX001',message='Tavla allowed a pass while legal moves were available.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_move_tavla(v_room.id,v_player,23,17,v_room.updated_at);
    raise exception using errcode='ZX001',message='Tavla allowed the second player to move out of turn.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_move_tavla(v_room.id,v_host,0,5,v_room.updated_at);
    raise exception using errcode='ZX001',message='Tavla accepted a move that did not match either die.';
  exception when invalid_parameter_value then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_move_tavla(v_room.id,v_host,0,1,v_room.updated_at);
  v_room:=public.engine_v2_move_tavla(v_room.id,v_host,0,2,v_room.updated_at);
  if v_room.game_state->>'turn'<>'1'
     or jsonb_array_length(v_room.game_state->'board'->'dice')<>0 then
    raise exception 'Tavla did not consume both dice and advance the turn.';
  end if;
  v_room:=public.engine_v2_roll_tavla(v_room.id,v_player,6,1,v_room.updated_at);
  v_room:=public.engine_v2_move_tavla(v_room.id,v_player,23,17,v_room.updated_at);
  v_room:=public.engine_v2_move_tavla(v_room.id,v_player,23,22,v_room.updated_at);
  if v_room.game_state->>'turn'<>'0'
     or jsonb_array_length(v_room.game_state->'board'->'dice')<>0 then
    raise exception 'Tavla second account did not consume dice and return the turn.';
  end if;

  ---------------------------------------------------------------------------
  -- Wheel: host-only stage changes, valid player-count/game selection,
  -- one spin per arena entry, server-controlled adoption into the next game.
  ---------------------------------------------------------------------------
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_host::text,true);
  v_room:=public.create_game_room('WHL002','Wheel engine CI','wheel',2,'{}'::jsonb,'Engine Host');
  perform set_config('request.jwt.claim.sub',v_player::text,true);
  perform public.join_game_room('WHL002','Engine Player');
  perform set_config('request.jwt.claim.role','service_role',true);

  v_room:=public.engine_v2_start_wheel(v_room.id,v_host,v_room.updated_at);
  v_room:=public.engine_v2_wheel_stage(v_room.id,v_host,'arena',v_room.updated_at);
  begin
    perform public.engine_v2_wheel_stage(v_room.id,v_player,'landing',v_room.updated_at);
    raise exception using errcode='ZX001',message='Non-host changed the Wheel stage.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_spin_wheel(v_room.id,v_host,'number',5400,v_room.updated_at);
  if v_room.game_state->'board'->>'stage'<>'result'
     or v_room.game_state->'board'->>'result'<>'number'
     or v_room.game_state->'board'->>'spins'<>'1' then
    raise exception 'Wheel did not record its first valid server-selected result.';
  end if;
  begin
    perform public.engine_v2_spin_wheel(v_room.id,v_host,'number',7200,v_room.updated_at);
    raise exception using errcode='ZX001',message='Wheel allowed a second spin without re-entering the arena.';
  exception when raise_exception then null;
            when sqlstate 'ZX001' then raise;
  end;
  begin
    perform public.engine_v2_adopt_wheel_result(v_room.id,v_player,v_room.updated_at);
    raise exception using errcode='ZX001',message='Non-host adopted the Wheel result.';
  exception when insufficient_privilege then null;
            when sqlstate 'ZX001' then raise;
  end;
  v_room:=public.engine_v2_adopt_wheel_result(v_room.id,v_host,v_room.updated_at);
  if v_room.game_key<>'number' or v_room.status<>'waiting'
     or v_room.game_state->>'phase'<>'lobby' or v_room.engine_version<>2 then
    raise exception 'Wheel adoption did not create a clean v2 lobby for the selected game.';
  end if;

  -- Verify that the adopted game can start and restart through its own engine.
  v_room:=public.engine_v2_start_number_game(v_room.id,v_host,42,v_room.updated_at);
  v_room:=public.engine_v2_guess_number(v_room.id,v_player,42,v_room.updated_at);
  if v_room.status<>'finished'
     or v_room.game_state->'board'->>'winner_id'<>v_player::text then
    raise exception 'The Wheel-adopted game did not execute a server-authoritative round.';
  end if;
  v_room:=public.engine_v2_restart_number_game(v_room.id,v_host,64,v_room.updated_at);
  if v_room.status<>'playing'
     or (select secret_state->>'number' from public.game_room_private_state where room_id=v_room.id)<>'64' then
    raise exception 'The Wheel-adopted game did not restart with a fresh private secret.';
  end if;

  raise notice 'PASS: Most, Quiz, Yes/No, Who-am-I, Colors, Tavla and Wheel behavioral/security integration tests.';
end
$room_engine_extended_tests$;

select 'PASS: extended multi-account game-engine tests' as test_result;
