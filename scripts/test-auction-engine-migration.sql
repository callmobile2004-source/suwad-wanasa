\set ON_ERROR_STOP on
do $roles$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then execute 'create role anon nologin'; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then execute 'create role authenticated nologin'; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then execute 'create role service_role nologin bypassrls'; end if;
end $roles$;
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists private;
create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $fn$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$fn$;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
grant usage on schema private to authenticated;
\ir ../supabase/migrations/20261109110000_auction_game_foundation.sql

do $checks$
declare
 v_room public.auction_rooms;
 v_started public.auction_rooms;
 v_bid public.auction_rooms;
 v_closed public.auction_rooms;
 v_stale public.auction_rooms;\n v_stale_started public.auction_rooms;\n v_stale_next public.auction_rooms;\n v_secret public.auction_rooms;
 v_secret_started public.auction_rooms;
 v_secret_closed public.auction_rooms;
 u1 uuid:='10000000-0000-4000-8000-000000000001';
 u2 uuid:='10000000-0000-4000-8000-000000000002';
begin
 insert into auth.users(id) values(u1),(u2);
 insert into public.auction_items(category_id,slug,title_ar,description_ar,facts,estimated_value,opening_price,min_increment,is_active,source_name,source_url,source_license,source_verified_at)
 values
 ('football-players','fixture-player-1','لاعب اختبار ١','قطعة اختبار للمحرك','{"position":"ST"}',5000,100,10,true,'Fixture only','https://example.invalid/fixture-1','Test fixture',now()),
 ('football-players','fixture-player-2','لاعب اختبار ٢','قطعة اختبار للمحرك','{"position":"GK"}',5000,100,10,true,'Fixture only','https://example.invalid/fixture-2','Test fixture',now());
 insert into public.auction_item_media(item_id,media_kind,external_url,alt_ar,attribution,license,is_primary)
 select id,'image','https://example.invalid/fixture-image.jpg','صورة اختبار','Fixture only','Test fixture',true
 from public.auction_items where slug in ('fixture-player-1','fixture-player-2');

 if not (select relrowsecurity from pg_class where oid='public.auction_rooms'::regclass) then raise exception 'auction_rooms RLS missing'; end if;
 if has_table_privilege('authenticated','public.auction_room_secret_state','select') then raise exception 'secret state leaked to authenticated'; end if;
 if has_function_privilege('authenticated','public.auction_place_bid(uuid,uuid,bigint,timestamptz)','execute') then raise exception 'authenticated can bypass auction Edge Function'; end if;
 if not has_function_privilege('service_role','public.auction_place_bid(uuid,uuid,bigint,timestamptz)','execute') then raise exception 'service role cannot place bids'; end if;

 perform set_config('request.jwt.claim.sub',u1::text,true);
 v_room:=public.auction_create_room(u1,'football-players','Host test',2,10000,'open',30,1);
 perform public.auction_join_room(u2,v_room.room_code,'Guest test');
 v_started:=public.auction_start_room(v_room.id,u1);
 if v_started.status<>'active' or v_started.current_item_id is null then raise exception 'open auction did not start'; end if;
 v_bid:=public.auction_place_bid(v_room.id,u2,110,v_started.updated_at);
 if v_bid.current_price<>110 or v_bid.highest_bidder_id<>u2 then raise exception 'open bid was not recorded'; end if;
 v_closed:=public.auction_close_lot(v_room.id,u1,v_started.current_item_id);
 if v_closed.status<>'completed' then raise exception 'open auction did not complete'; end if;
 if (select balance from public.auction_room_players where room_id=v_room.id and user_id=u2)<>9890 then raise exception 'winner balance not settled'; end if;

 v_stale:=public.auction_create_room(u1,'football-players','Host stale',2,10000,'open',30,2);
 perform public.auction_join_room(u2,v_stale.room_code,'Guest stale');
 v_stale_started:=public.auction_start_room(v_stale.id,u1);
 v_stale_next:=public.auction_close_lot(v_stale.id,u1,v_stale_started.current_item_id);
 if v_stale_next.status<>'active' or v_stale_next.current_item_id=v_stale_started.current_item_id then raise exception 'second lot did not start'; end if;
 begin
  perform public.auction_close_lot(v_stale.id,u1,v_stale_started.current_item_id);
  raise exception 'stale close unexpectedly advanced the next lot';
 exception when sqlstate '40001' then null;
 end;
 v_stale_next:=public.auction_close_lot(v_stale.id,u1,v_stale_next.current_item_id);
 if v_stale_next.status<>'completed' then raise exception 'second lot did not complete'; end if;

 v_secret:=public.auction_create_room(u1,'football-players','Host secret',2,10000,'secret',30,1);
 perform public.auction_join_room(u2,v_secret.room_code,'Guest secret');
 v_secret_started:=public.auction_start_room(v_secret.id,u1);
 if v_secret_started.current_price is not null or v_secret_started.highest_bidder_id is not null then raise exception 'secret room exposed live bid fields'; end if;
 perform public.auction_place_bid(v_secret.id,u1,130,v_secret_started.updated_at);
 begin
  perform public.auction_place_bid(v_secret.id,u1,140,(select updated_at from public.auction_rooms where id=v_secret.id));
  raise exception 'duplicate sealed bid unexpectedly accepted';
 exception when unique_violation then null;
 end;
 perform public.auction_place_bid(v_secret.id,u2,150,(select updated_at from public.auction_rooms where id=v_secret.id));
 if exists(select 1 from public.auction_rooms where id=v_secret.id and (current_price is not null or highest_bidder_id is not null)) then raise exception 'secret bid leaked into public room row'; end if;
 if (select current_price from public.auction_room_secret_state where room_id=v_secret.id)<>150 then raise exception 'secret highest bid state incorrect'; end if;
 v_secret_closed:=public.auction_close_lot(v_secret.id,u1,v_secret_started.current_item_id);
 if v_secret_closed.status<>'completed' then raise exception 'secret auction did not complete'; end if;
 if (select balance from public.auction_room_players where room_id=v_secret.id and user_id=u2)<>9850 then raise exception 'secret winner balance not settled'; end if;
 raise notice 'PASS: auction migration, RLS, RPC grants, room create/join/start, open bidding, sealed bidding, privacy and settlement.';
end $checks$;
