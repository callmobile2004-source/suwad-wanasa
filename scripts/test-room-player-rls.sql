\set ON_ERROR_STOP on

-- Isolated PostgreSQL regression only. All DDL, roles and fixture rows roll back.
BEGIN;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE TABLE public.game_room_players (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.game_room_players ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.is_game_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.game_room_players p
       WHERE p.room_id = p_room_id
         AND p.user_id = auth.uid()
     );
$function$;

REVOKE ALL ON FUNCTION private.is_game_room_member(uuid) FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA public, auth, private TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_game_room_member(uuid) TO authenticated;
GRANT SELECT ON public.game_room_players TO authenticated;
REVOKE ALL ON public.game_room_players FROM anon, service_role;

CREATE POLICY "room members read room players"
ON public.game_room_players
FOR SELECT
TO authenticated
USING (private.is_game_room_member(room_id));

INSERT INTO public.game_room_players (room_id, user_id, display_name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Host'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'Guest'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'Outsider');

DO $acl$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.game_room_players', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated must retain SELECT for the RLS policy';
  END IF;
  IF has_table_privilege('anon', 'public.game_room_players', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not have SELECT on game_room_players';
  END IF;
  IF has_table_privilege('service_role', 'public.game_room_players', 'SELECT') THEN
    RAISE EXCEPTION 'service_role must not receive broad SELECT on game_room_players';
  END IF;
END;
$acl$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
DO $member$
DECLARE
  visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows FROM public.game_room_players;
  IF visible_rows <> 2 THEN
    RAISE EXCEPTION 'room member should see exactly 2 players in their room; got %', visible_rows;
  END IF;
END;
$member$;

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
DO $outsider$
DECLARE
  visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows FROM public.game_room_players;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'non-member should see 0 room-player rows; got %', visible_rows;
  END IF;
END;
$outsider$;
RESET ROLE;

ROLLBACK;
