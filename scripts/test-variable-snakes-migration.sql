-- Integration test for the variable snakes/ladders migration.
-- Runs against a disposable PostgreSQL database and rolls back every object.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA private;

CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY,
  game_key text NOT NULL,
  game_state jsonb NOT NULL
);

INSERT INTO public.game_rooms(id,game_key,game_state)
VALUES ('00000000-0000-0000-0000-000000000001','snakes','{}'::jsonb);

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
      select candidate into v_head
      from generate_series(18,98) candidate
      where not candidate=any(v_used)
      order by random() limit 1;
      select candidate into v_tail
      from generate_series(2,v_head-8) candidate
      where not candidate=any(v_used)
      order by random() limit 1;
      v_used:=array_append(v_used,v_head);
      v_used:=array_append(v_used,v_tail);
      v_snakes:=v_snakes||jsonb_build_array(jsonb_build_object('from',v_head,'to',v_tail));
    end loop;
    for v_i in 1..6 loop
      select candidate into v_start
      from generate_series(2,88) candidate
      where not candidate=any(v_used)
      order by random() limit 1;
      select candidate into v_end
      from generate_series(v_start+8,99) candidate
      where not candidate=any(v_used)
      order by random() limit 1;
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

\i supabase/migrations/20261107230000_variable_snakes_ladders_layout.sql

DO $test$
DECLARE
  v_room public.game_rooms;
  v_core public.game_rooms;
  v_snakes integer;
  v_ladders integer;
  v_i integer;
  v_wrapper text;
  v_core_source text;
BEGIN
  v_wrapper:=pg_catalog.pg_get_functiondef('public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure);
  v_core_source:=pg_catalog.pg_get_functiondef('public.engine_v3_apply_action_core(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure);
  IF pg_catalog.strpos(v_wrapper,'v_deck:=private.generate_snakes_board_layout()')=0
     OR pg_catalog.strpos(v_wrapper,'v_used:=array[1,100];')>0
     OR pg_catalog.strpos(v_core_source,'private.generate_snakes_board_layout()')=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: core and wrapper were not both patched';
  END IF;

  FOR v_i IN 1..100 LOOP
    v_core:=public.engine_v3_apply_action_core(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      'start','{}'::jsonb,pg_catalog.now()
    );
    v_snakes:=jsonb_array_length(v_core.game_state->'board'->'snakes');
    v_ladders:=jsonb_array_length(v_core.game_state->'board'->'ladders');
    IF v_snakes NOT BETWEEN 2 AND 5 OR v_ladders NOT BETWEEN 2 AND 5 OR v_snakes+v_ladders>9 THEN
      RAISE EXCEPTION 'SMOKE_FAIL: core layout count %, %',v_snakes,v_ladders;
    END IF;

    v_room:=public.engine_v3_apply_action(
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      'start','{}'::jsonb,pg_catalog.now()
    );
    v_snakes:=jsonb_array_length(v_room.game_state->'board'->'snakes');
    v_ladders:=jsonb_array_length(v_room.game_state->'board'->'ladders');
    IF v_snakes NOT BETWEEN 2 AND 5 OR v_ladders NOT BETWEEN 2 AND 5 OR v_snakes+v_ladders>9 THEN
      RAISE EXCEPTION 'SMOKE_FAIL: wrapper layout count %, %',v_snakes,v_ladders;
    END IF;
  END LOOP;
END;
$test$;

ROLLBACK;
