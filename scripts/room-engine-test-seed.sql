\set ON_ERROR_STOP on
DO $target_guard$
begin
  if current_database() <> 'suwad_engine_test' then
    raise exception 'Refusing to insert test accounts or rooms outside suwad_engine_test.';
  end if;
  if not exists (select 1 from pg_roles where rolname=session_user and rolsuper) then
    raise exception 'Room-engine test seed requires the isolated CI superuser session.';
  end if;
end
$target_guard$;

begin;

insert into auth.users(id,aud,role,email,raw_user_meta_data,is_anonymous)
values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','engine-host@example.invalid','{"username":"engine_host","display_name":"Engine Host"}',true),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','engine-player@example.invalid','{"username":"engine_player","display_name":"Engine Player"}',true),
 ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','engine-outsider@example.invalid','{"username":"engine_outsider","display_name":"Engine Outsider"}',true),
 ('10000000-0000-4000-8000-000000000004','authenticated','authenticated','engine-player-four@example.invalid','{"username":"engine_player_four","display_name":"Engine Player Four"}',true)
on conflict(id) do nothing;

-- A v1 room with untrusted client-supplied outcome/secret data. The final v2
-- migration must archive this payload privately, clear its live board and
-- never award XP for this client-authored result.
insert into public.game_rooms(
  id,room_code,room_name,game_key,host_id,max_players,status,game_state,
  engine_version,game_started_at
)
values(
  '20000000-0000-4000-8000-000000000001',
  'OLD001','Legacy room under test','number',
  '10000000-0000-4000-8000-000000000001',
  2,'playing',
  '{"phase":"finished","round":7,"turn":0,"scores":{"10000000-0000-4000-8000-000000000001":9999},"board":{"secret":42,"winner_id":"10000000-0000-4000-8000-000000000002","revealed_number":42,"fabricated":true}}'::jsonb,
  1,now()-interval '5 minutes'
)
on conflict(id) do nothing;

insert into public.game_room_players(room_id,user_id,display_name,seat)
values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Engine Host',0),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Engine Player',1)
on conflict(room_id,user_id) do nothing;

-- A second v1 room whose stored host has already left. The migration must
-- transfer host ownership to the first remaining seated player, never leave
-- a waiting room without a current host.
insert into public.game_rooms(
  id,room_code,room_name,game_key,host_id,max_players,status,game_state,
  engine_version,game_started_at
)
values(
  '20000000-0000-4000-8000-000000000002',
  'OLD002','Legacy orphan host room','who',
  '10000000-0000-4000-8000-000000000001',
  12,'waiting',
  '{"phase":"playing","board":{"private_guess":"must be archived"}}'::jsonb,
  1,null
)
on conflict(id) do nothing;

insert into public.game_room_players(room_id,user_id,display_name,seat)
values(
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  'Engine Player',1
)
on conflict(room_id,user_id) do nothing;

commit;
select 'PASS: four test accounts, a legacy room and an orphan-host room seeded' as test_result;
