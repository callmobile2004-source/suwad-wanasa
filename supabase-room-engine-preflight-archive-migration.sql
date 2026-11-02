-- One-time, private pre-v2 snapshot of the only live tables rewritten by
-- supabase-online-engine-v2-all-games.sql. Free Supabase projects do not have
-- automatic backups, so keep this private copy until the rollout is verified.
begin;

create schema if not exists internal_archive authorization postgres;
revoke all on schema internal_archive from public,anon,authenticated,service_role;

create table if not exists internal_archive.game_rooms_pre_engine_v2_snapshot
as table public.game_rooms;

create table if not exists internal_archive.game_room_players_pre_engine_v2_snapshot
as table public.game_room_players;

alter table internal_archive.game_rooms_pre_engine_v2_snapshot enable row level security;
alter table internal_archive.game_room_players_pre_engine_v2_snapshot enable row level security;

revoke all on all tables in schema internal_archive from public,anon,authenticated,service_role;

comment on schema internal_archive is
  'Private one-time pre-engine-v2 room data snapshot. Do not expose through the Supabase Data API.';
comment on table internal_archive.game_rooms_pre_engine_v2_snapshot is
  'Original game_rooms rows captured before the server-authoritative engine v2 migration on 2026-11-02.';
comment on table internal_archive.game_room_players_pre_engine_v2_snapshot is
  'Original game_room_players rows captured before the server-authoritative engine v2 migration on 2026-11-02.';

commit;
