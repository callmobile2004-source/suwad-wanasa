-- Verify that the variable-board migration and the reconciled room-wrapper
-- snapshot compose in their real deployment order. All objects are rolled back.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA private;

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

CREATE OR REPLACE FUNCTION public.engine_v3_apply_action_core(
  p_room_id uuid,p_actor_id uuid,p_action text,p_payload jsonb,p_expected_updated_at timestamptz
)
RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_positions jsonb;
  v_board jsonb;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id;
  v_positions:='[]'::jsonb;
  v_board:=jsonb_build_object('positions',v_positions,'dice',null,'finished',null);
  v_room.game_state:=jsonb_build_object('board',v_board);
  RETURN v_room;
END;
$function$;

-- This is the deployed pre-variable-layout wrapper contract. The first
-- migration must patch this block without disturbing the action wrapper.
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
  v_state jsonb;
  v_board jsonb;
  v_deck jsonb;
  v_used integer[]:=array[1,100];
  v_snakes jsonb:='[]'::jsonb;
  v_ladders jsonb:='[]'::jsonb;
  v_i integer;
  v_head integer;
  v_tail integer;
  v_start integer;
  v_end integer;
BEGIN
  v_room:=public.engine_v3_apply_action_core(p_room_id,p_actor_id,p_action,p_payload,p_expected_updated_at);
  v_state:=v_room.game_state;
  v_board:=coalesce(v_state->'board','{}'::jsonb);
  if v_room.game_key='snakes' then
    v_used:=array[1,100];
    v_snakes:='[]'::jsonb;
    v_ladders:='[]'::jsonb;
    for v_i in 1..6 loop
      select candidate into v_head from generate_series(18,98) candidate
      where not candidate=any(v_used) order by random() limit 1;
      select candidate into v_tail from generate_series(2,v_head-8) candidate
      where not candidate=any(v_used) order by random() limit 1;
      v_used:=array_append(v_used,v_head);
      v_used:=array_append(v_used,v_tail);
      v_snakes:=v_snakes||jsonb_build_array(jsonb_build_object('from',v_head,'to',v_tail));
    end loop;
    for v_i in 1..6 loop
      select candidate into v_start from generate_series(2,88) candidate
      where not candidate=any(v_used) order by random() limit 1;
      select candidate into v_end from generate_series(v_start+8,99) candidate
      where not candidate=any(v_used) order by random() limit 1;
      v_used:=array_append(v_used,v_start);
      v_used:=array_append(v_used,v_end);
      v_ladders:=v_ladders||jsonb_build_array(jsonb_build_object('from',v_start,'to',v_end));
    end loop;
    v_board:=jsonb_set(v_board,'{snakes}',v_snakes,true);
    v_board:=jsonb_set(v_board,'{ladders}',v_ladders,true);
    v_board:=jsonb_set(v_board,'{dice}','null'::jsonb,true);
  end if;
  v_room.game_state:=jsonb_set(v_state,'{board}',v_board,true);
  RETURN v_room;
END;
$function$;

-- Preserve the production-only gateway permission across CREATE OR REPLACE.
REVOKE ALL ON FUNCTION public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)
  TO service_role;

\i supabase/migrations/20261107230000_variable_snakes_ladders_layout.sql
\i supabase/migrations/20261108100000_authoritative_room_engine_wrapper_reconciled.sql

DO $test$
DECLARE
  v_definition text;
  v_core_definition text;
  v_oid oid;
BEGIN
  v_oid:='public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure;
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  v_core_definition:=pg_catalog.pg_get_functiondef(
    'public.engine_v3_apply_action_core(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure
  );

  IF pg_catalog.strpos(v_definition,'private.generate_snakes_board_layout()')=0
     OR pg_catalog.strpos(v_definition,'finish-snake-move')=0
     OR pg_catalog.strpos(v_definition,'private.tavla_apply_action')=0
     OR pg_catalog.strpos(v_definition,'draw-domino')=0
     OR pg_catalog.strpos(v_definition,'pass-domino')=0
     OR pg_catalog.strpos(v_definition,'<>108')=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: final wrapper lost an action contract after sequential migrations';
  END IF;

  IF pg_catalog.strpos(v_definition,'v_used:=array[1,100];')>0
     OR pg_catalog.strpos(v_definition,'for v_i in 1..6 loop')>0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: fixed six-by-six board generator remains after sequential migrations';
  END IF;

  IF pg_catalog.strpos(v_core_definition,'private.generate_snakes_board_layout()')=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: core function was not patched by the variable-layout migration';
  END IF;

  IF pg_catalog.strpos(v_definition,'SECURITY DEFINER')=0
     OR NOT EXISTS(
       SELECT 1 FROM pg_proc
       WHERE oid=v_oid AND proconfig IS NOT NULL
         AND array_to_string(proconfig,',') ILIKE '%search_path%'
     ) THEN
    RAISE EXCEPTION 'SMOKE_FAIL: wrapper security attributes changed';
  END IF;

  IF has_function_privilege('authenticated',v_oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: wrapper ACL changed after sequential migrations';
  END IF;
END;
$test$;

ROLLBACK;
