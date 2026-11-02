\set ON_ERROR_STOP on

DO $target_guard$
begin
  if current_database() <> 'suwad_engine_test' then
    raise exception 'Refusing to run progression tests outside suwad_engine_test.';
  end if;
  if not exists (select 1 from pg_roles where rolname=session_user and rolsuper) then
    raise exception 'Progression tests require the isolated CI superuser session.';
  end if;
end
$target_guard$;

DO $progression_tests$
declare
  v_host uuid:='10000000-0000-4000-8000-000000000001';
  v_player uuid:='10000000-0000-4000-8000-000000000002';
  v_outsider uuid:='10000000-0000-4000-8000-000000000003';
  v_room uuid;
  v_code text;
  v_count integer;
  v_before_xp integer;
  v_after_xp integer;
  v_pieces_host jsonb;
  v_pieces_player jsonb;
begin
  -- Liar: only the all-votes-complete server event with matching private
  -- outsider/word data can award participation XP.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Liar','liar',v_host,3,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1),(v_room,v_outsider,'Engine Outsider',2);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'liar_started','{"players":3,"category":"أماكن"}');
  insert into public.game_room_private_state(room_id,secret_state)
  values(v_room,jsonb_build_object('secret_word','مكتبة','category','أماكن','outsider_id',v_outsider::text,'hints','{}'::jsonb,'votes','{}'::jsonb));
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'liar_finished','{"outsider_caught":true,"votes":3}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('phase','finished','finish_reason','votes_completed',
      'vote_count',3,'vote_total',3,'secret_word','مكتبة','outsider_id',v_outsider::text,'outsider_caught',true)
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>3 then raise exception 'Liar: valid full-vote completion should award exactly three players, got %.',v_count; end if;
  
  -- Snakes: a server dice event must identify the actual player at 100.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Snakes','snakes',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'snakes_started','{"players":2}');
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'snakes_finished','{"dice":1,"from":99,"to":100,"finished":true}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('finish_reason','winner','finished',0,'last_player_id',v_host::text,
      'positions',jsonb_build_array(100,0),'player_order',jsonb_build_array(v_host::text,v_player::text))
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Snakes: verified finish should award both players, got %.',v_count; end if;

  -- Domino: empty-hand completion must agree with the private hand and event.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Domino Empty','domino',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'domino_started','{"players":2}');
  insert into public.game_room_private_state(room_id,secret_state)
  values(v_room,jsonb_build_object('game','domino','hands',jsonb_build_object(v_host::text,'[]'::jsonb,v_player::text,'[[0,1]]'::jsonb),'boneyard','[]'::jsonb,'chain','[[6,6]]'::jsonb));
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'domino_finished','{"finished":true,"hand_count":0}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('finish_reason','empty_hand','winner_ids',jsonb_build_array(v_host::text),
      'hand_counts',jsonb_build_object(v_host::text,0,v_player::text,1))
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Domino empty-hand: verified finish should award two players, got %.',v_count; end if;

  -- Domino: blocked completion requires the entire roster to pass, an empty
  -- boneyard, and a trusted event confirming the same pass count.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Domino Blocked','domino',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'domino_started','{"players":2}');
  insert into public.game_room_private_state(room_id,secret_state)
  values(v_room,jsonb_build_object('game','domino','hands',jsonb_build_object(v_host::text,'[[0,1]]'::jsonb,v_player::text,'[[2,3]]'::jsonb),'boneyard','[]'::jsonb,'chain','[[6,6]]'::jsonb));
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_player,'domino_finished','{"finished":true,"consecutive_passes":2}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('finish_reason','blocked','pass_count',2,'current_player_id',null,
      'winner_ids',jsonb_build_array(v_host::text),'pip_totals',jsonb_build_object(v_host::text,1,v_player::text,5))
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Domino blocked: verified full-roster pass should award two players, got %.',v_count; end if;

  -- Who-am-I: the final correct guess must match the private server word.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Who','who',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'who_started','{"players":2}');
  insert into public.game_room_private_state(room_id,secret_state)
  values(v_room,'{"word":"مكتبة","category":"أماكن"}');
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'who_finished','{"correct":true,"guess":"مكتبة"}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('phase','finished','winner_id',v_host::text,'revealed_word','مكتبة')
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Who-am-I: verified correct guess should award two players, got %.',v_count; end if;

  -- Who-am-I: host/player departure must not be treated as a correct answer.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Who Leave','who',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'who_started','{"players":2}');
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_player,'who_finished','{"reason":"player_left"}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('phase','finished','finish_reason','player_left')
  ) where id=v_room;
  if exists(select 1 from public.player_game_history where room_id=v_room) then
    raise exception 'Who-am-I player-left finish must not award progression.';
  end if;

  -- Colors: the last legal card must agree with the player's private hand.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Colors Winner','colors',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'colors_started','{"players":2}');
  insert into public.game_room_private_state(room_id,secret_state)
  values(v_room,jsonb_build_object('hands',jsonb_build_object(v_host::text,'[]'::jsonb,v_player::text,'[{"c":"أحمر","v":"١"}]'::jsonb),'draw_pile','[]'::jsonb));
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'colors_finished','{"cards_left":0}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('phase','finished','winner_id',v_host::text,
      'hand_counts',jsonb_build_object(v_host::text,0,v_player::text,1))
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Colors winner: verified empty hand should award two players, got %.',v_count; end if;

  -- Colors: a blocked draw pile only awards after every player has passed.
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Colors Blocked','colors',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'colors_started','{"players":2}');
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_player,'colors_finished','{"reason":"blocked","passes":2}');
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('phase','finished','finish_reason','blocked','passes',2)
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Colors blocked: verified all-player pass should award two players, got %.',v_count; end if;

  -- Tavla: a legal server move that bears off the final piece is a completion.
  select jsonb_agg(jsonb_build_object('point',23,'id',n) order by n)
    into v_pieces_host from generate_series(1,15) n;
  select jsonb_agg(jsonb_build_object('point',0,'id',n) order by n)
    into v_pieces_player from generate_series(1,15) n;
  v_room:=gen_random_uuid(); v_code:=upper(substr(md5(v_room::text),1,6));
  insert into public.game_rooms(id,room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version)
  values(v_room,v_code,'Progression Tavla','tavla',v_host,2,'waiting','{"phase":"lobby"}',2);
  insert into public.game_room_players(room_id,user_id,display_name,seat) values
    (v_room,v_host,'Engine Host',0),(v_room,v_player,'Engine Player',1);
  update public.game_rooms set status='playing',game_state='{"phase":"playing","board":{}}' where id=v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'tavla_started','{"players":2}');
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(v_room,v_host,'tavla_finished',jsonb_build_object('from',22,'to',23,'die',1,'winner',v_host::text));
  update public.game_rooms set status='finished',game_state=jsonb_build_object(
    'phase','finished','board',jsonb_build_object('finished',0,'player_order',jsonb_build_array(v_host::text,v_player::text),
      'positions',jsonb_build_array(v_pieces_host,v_pieces_player))
  ) where id=v_room;
  select count(*)::integer into v_count from public.player_game_history where room_id=v_room;
  if v_count<>2 then raise exception 'Tavla: verified final bear-off should award two players, got %.',v_count; end if;

  -- Each completed room is awarded only once; re-updating an already-finished
  -- room cannot duplicate XP/history.
  select xp into v_before_xp from public.player_progress where user_id=v_host;
  update public.game_rooms set game_state=game_state where game_key='who'
    and room_name='Progression Who' and status='finished';
  select xp into v_after_xp from public.player_progress where user_id=v_host;
  if v_after_xp is distinct from v_before_xp then
    raise exception 'Progression award was duplicated by a finished-room replay.';
  end if;

  raise notice 'PASS: validated Liar, Snakes, Domino empty-hand/blocked, Who correct/leave-negative, Colors winner/blocked, Tavla completion, and no duplicate XP.';
end
$progression_tests$;

select 'PASS: server-authoritative progression integration tests' as test_result;
