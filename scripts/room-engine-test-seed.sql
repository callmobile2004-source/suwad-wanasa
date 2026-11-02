-- Stable fake Supabase accounts for isolated multi-player migration tests.
insert into auth.users(id,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001','{"username":"test_player_a","display_name":"لاعب الاختبار أ"}'::jsonb),
 ('00000000-0000-4000-8000-000000000002','{"username":"test_player_b","display_name":"لاعب الاختبار ب"}'::jsonb),
 ('00000000-0000-4000-8000-000000000003','{"username":"test_player_c","display_name":"لاعب الاختبار ج"}'::jsonb),
 ('00000000-0000-4000-8000-000000000004','{"username":"test_player_d","display_name":"لاعب الاختبار د"}'::jsonb),
 ('00000000-0000-4000-8000-000000000005','{"username":"test_player_e","display_name":"لاعب الاختبار هـ"}'::jsonb)
on conflict(id) do nothing;

-- Simulate a live legacy room whose client-authored state cannot be trusted.
insert into public.game_rooms(
  id,room_code,room_name,game_key,host_id,max_players,status,game_state,game_started_at,updated_at
) values(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','OLD001','غرفة قديمة','number',
  '00000000-0000-4000-8000-000000000001',4,'playing',
  '{"phase":"playing","board":{"secret":37,"tries":{"00000000-0000-4000-8000-000000000002":2}}}'::jsonb,
  pg_catalog.clock_timestamp()-interval '2 minutes',
  pg_catalog.clock_timestamp()-interval '1 minute'
);
insert into public.game_room_players(room_id,user_id,display_name,seat) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-000000000001','لاعب الاختبار أ',0),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','00000000-0000-4000-8000-000000000002','لاعب الاختبار ب',1);
