-- Remove inherited PUBLIC execution from legacy private helpers.
-- Existing trigger behavior and authenticated tournament helper behavior are preserved.
-- This is ACL-only: no tables, rows, policies, or function bodies are changed.

DO $private_acl_hardening$
BEGIN
  IF to_regprocedure('private.apply_game_room_surprise_effect()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION private.apply_game_room_surprise_effect() FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.apply_game_room_surprise_effect() TO service_role';
  END IF;

  IF to_regprocedure('private.t_player(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION private.t_player(uuid) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.t_player(uuid) TO authenticated, service_role';
  END IF;
END;
$private_acl_hardening$;
