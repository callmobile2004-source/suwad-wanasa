-- Prove private helper ACLs are narrowed without breaking the trigger path.
-- All roles, functions, triggers, and rows are created inside this disposable transaction.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY,
  surprise_count integer NOT NULL DEFAULT 0
);
CREATE TABLE public.game_room_surprises (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.game_rooms(id)
);
INSERT INTO public.game_rooms(id) VALUES ('00000000-0000-4000-8000-000000000001');
GRANT INSERT ON public.game_room_surprises TO authenticated;

CREATE OR REPLACE FUNCTION private.apply_game_room_surprise_effect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  UPDATE public.game_rooms
  SET surprise_count = surprise_count + 1
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_apply_game_room_surprise_effect
AFTER INSERT ON public.game_room_surprises
FOR EACH ROW EXECUTE FUNCTION private.apply_game_room_surprise_effect();

CREATE OR REPLACE FUNCTION private.t_player(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p_id IS NOT NULL
$function$;

DO $before$
BEGIN
  IF NOT has_function_privilege('anon','private.apply_game_room_surprise_effect()','EXECUTE')
     OR NOT has_function_privilege('authenticated','private.apply_game_room_surprise_effect()','EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: trigger helper fixture did not start with the expected inherited PUBLIC ACL';
  END IF;
  IF NOT has_function_privilege('anon','private.t_player(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','private.t_player(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament helper fixture did not start with the expected inherited PUBLIC ACL';
  END IF;
END;
$before$;

\i supabase/migrations/20261108130000_restrict_private_helper_execute_acl.sql

DO $after$
BEGIN
  IF has_function_privilege('anon','private.apply_game_room_surprise_effect()','EXECUTE')
     OR has_function_privilege('authenticated','private.apply_game_room_surprise_effect()','EXECUTE')
     OR NOT has_function_privilege('service_role','private.apply_game_room_surprise_effect()','EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: trigger helper execution ACL was not restricted to the backend role';
  END IF;
  IF has_function_privilege('anon','private.t_player(uuid)','EXECUTE')
     OR NOT has_function_privilege('authenticated','private.t_player(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role','private.t_player(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament helper authenticated/backend compatibility changed';
  END IF;
  IF has_schema_privilege('anon','private','USAGE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: anon gained access to private schema';
  END IF;
END;
$after$;

SET ROLE authenticated;
SELECT CASE WHEN private.t_player('00000000-0000-4000-8000-000000000001'::uuid)
  THEN 'PASS: authenticated tournament helper remains callable'
  ELSE 1/0::text END;
INSERT INTO public.game_room_surprises(room_id)
VALUES ('00000000-0000-4000-8000-000000000001');
RESET ROLE;

DO $trigger_check$
BEGIN
  IF (SELECT surprise_count FROM public.game_rooms
      WHERE id='00000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: trigger no longer fires after its direct EXECUTE grant is revoked';
  END IF;
END;
$trigger_check$;

ROLLBACK;
