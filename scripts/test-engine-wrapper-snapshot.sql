-- PostgreSQL integration check for the reconciled authoritative room wrapper.
-- Verifies the production wrapper contract, variable board helper, and preserved ACL.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY,
  game_key text NOT NULL,
  engine_version integer NOT NULL,
  host_id uuid NOT NULL,
  status text NOT NULL,
  updated_at timestamptz NOT NULL,
  game_started_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_players integer NOT NULL DEFAULT 8,
  game_state jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.engine_v3_apply_action(
  p_room_id uuid,p_actor_id uuid,p_action text,p_payload jsonb,p_expected_updated_at timestamptz
)
RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_room public.game_rooms;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id;
  RETURN v_room;
END;
$function$;

REVOKE ALL ON FUNCTION public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone) TO service_role;

\i supabase/migrations/20261108100000_authoritative_room_engine_wrapper_reconciled.sql

DO $test$
DECLARE
  v_definition text;
  v_tail text;
  v_snake_block text;
  v_start integer;
  v_end integer;
  v_oid oid;
BEGIN
  v_oid:='public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure;
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  IF pg_catalog.strpos(v_definition,'finish-snake-move')=0
     OR pg_catalog.strpos(v_definition,'private.tavla_apply_action')=0
     OR pg_catalog.strpos(v_definition,'move-tavla')=0
     OR pg_catalog.strpos(v_definition,'pass-tavla')=0
     OR pg_catalog.strpos(v_definition,'openingTile')=0
     OR pg_catalog.strpos(v_definition,'draw-domino')=0
     OR pg_catalog.strpos(v_definition,'pass-domino')=0
     OR pg_catalog.strpos(v_definition,'<>108')=0
     OR pg_catalog.strpos(v_definition,'private.generate_snakes_board_layout()')=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: reconciled wrapper is missing a deployed game action contract';
  END IF;
  v_start:=pg_catalog.strpos(v_definition,'v_deck:=private.generate_snakes_board_layout();');
  v_tail:=pg_catalog.substr(v_definition,v_start);
  v_end:=pg_catalog.strpos(v_tail,'v_board:=jsonb_set(v_board,''{dice}''');
  IF v_start=0 OR v_end=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: variable snake layout block is not correctly positioned';
  END IF;
  v_snake_block:=pg_catalog.substr(v_tail,1,v_end-1);
  IF pg_catalog.strpos(v_snake_block,'generate_series')>0
     OR pg_catalog.strpos(v_snake_block,'v_used:=array[1,100]')>0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: fixed snake/ladder loops remain in the reconciled wrapper';
  END IF;
  IF pg_catalog.strpos(v_definition,'SECURITY DEFINER')=0
     OR pg_catalog.strpos(v_definition,'SET search_path TO ''''')=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: wrapper security attributes changed';
  END IF;
  IF has_function_privilege('authenticated',v_oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: wrapper execution ACL changed during reconciliation';
  END IF;
END;
$test$;

ROLLBACK;
