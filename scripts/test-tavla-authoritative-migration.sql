-- PostgreSQL integration test for the authoritative online Tavla migration.
-- Uses a disposable schema-compatible harness and rolls back every object.
BEGIN;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA private;

CREATE TABLE public.game_rooms (
  id uuid PRIMARY KEY,
  game_key text NOT NULL,
  engine_version integer NOT NULL,
  host_id uuid NOT NULL,
  status text NOT NULL,
  updated_at timestamptz NOT NULL,
  game_started_at timestamptz,
  game_state jsonb NOT NULL
);
CREATE TABLE public.game_room_players (
  room_id uuid NOT NULL,
  user_id uuid NOT NULL,
  seat integer NOT NULL,
  display_name text NOT NULL,
  PRIMARY KEY(room_id,user_id),
  UNIQUE(room_id,seat)
);
CREATE TABLE public.game_room_action_events (
  room_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  game_key text NOT NULL,
  action text NOT NULL,
  event_payload jsonb NOT NULL
);

INSERT INTO public.game_rooms(id,game_key,engine_version,host_id,status,updated_at,game_state)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'tavla',3,
  '00000000-0000-0000-0000-000000000002',
  'waiting',pg_catalog.clock_timestamp(),'{}'::jsonb
);
INSERT INTO public.game_room_players(room_id,user_id,seat,display_name) VALUES
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',0,'Host'),
('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1,'Guest');

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
  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.game_room_players p WHERE p.room_id=p_room_id AND p.user_id=p_actor_id) THEN
    RAISE EXCEPTION 'not a member' USING errcode='42501';
  END IF;
  -- A snake move is finalized only after the server-defined animation window.
  RETURN v_room;
END;
$function$;

\i supabase/migrations/20261107162001_tavla_maximum_dice_rules.sql

DO $test$
DECLARE
  v_room public.game_rooms;
  v_points jsonb;
  v_bar jsonb;
  v_off jsonb;
  v_dice jsonb;
  v_preview jsonb;
  v_remaining jsonb;
  v_wrapper text;
  v_turn integer;
  v_roll0 integer;
  v_roll1 integer;
  v_actor uuid;
  v_host uuid:='00000000-0000-0000-0000-000000000002';
  v_guest uuid:='00000000-0000-0000-0000-000000000003';
  v_room_id uuid:='00000000-0000-0000-0000-000000000001';
  v_p0_count integer;
  v_p1_count integer;
  v_max integer;
  v_after integer;
  v_candidate_die integer;
  v_candidate_source integer;
  v_move_die integer;
  v_move_from integer;
  v_found boolean;
  v_raised boolean;
  v_event_count integer;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  v_wrapper:=pg_catalog.pg_get_functiondef('public.engine_v3_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure);
  IF pg_catalog.strpos(v_wrapper,'private.tavla_apply_action(p_room_id,p_actor_id,p_action')=0 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: public wrapper does not route Tavla actions to the private rules engine';
  END IF;
  IF pg_catalog.has_function_privilege('authenticated','private.tavla_apply_action(uuid,uuid,text,jsonb,timestamp with time zone)','EXECUTE') THEN
    RAISE EXCEPTION 'SMOKE_FAIL: authenticated can execute the private Tavla action function directly';
  END IF;

  -- Start: 24 points, 15 checkers per player, opening roll determines first player.
  SELECT * INTO v_room FROM public.game_rooms WHERE id=v_room_id;
  v_room:=public.engine_v3_apply_action(v_room_id,v_host,'start','{}'::jsonb,v_room.updated_at);
  v_points:=v_room.game_state->'board'->'points';
  IF jsonb_array_length(v_points)<>24
     OR v_room.game_state->'board'->'bar'<>'[0,0]'::jsonb
     OR v_room.game_state->'board'->'off'<>'[0,0]'::jsonb
     OR jsonb_array_length(v_room.game_state->'board'->'dice')<>2
     OR jsonb_array_length(v_room.game_state->'board'->'openingRolls')<>2
     OR v_room.status<>'playing' THEN
    RAISE EXCEPTION 'SMOKE_FAIL: classic Tavla opening state is incomplete';
  END IF;
  SELECT COALESCE(sum((value->>'count')::integer),0) INTO v_p0_count
  FROM jsonb_array_elements(v_points) WHERE value->>'owner'='0';
  SELECT COALESCE(sum((value->>'count')::integer),0) INTO v_p1_count
  FROM jsonb_array_elements(v_points) WHERE value->>'owner'='1';
  IF v_p0_count<>15 OR v_p1_count<>15 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: initial checker count is %, %',v_p0_count,v_p1_count;
  END IF;
  v_roll0:=(v_room.game_state->'board'->'openingRolls'->0->>'roll')::integer;
  v_roll1:=(v_room.game_state->'board'->'openingRolls'->1->>'roll')::integer;
  IF (v_room.game_state->>'turn')::integer <> (CASE WHEN v_roll0>v_roll1 THEN 0 ELSE 1 END) THEN
    RAISE EXCEPTION 'SMOKE_FAIL: opening roll did not determine the first player';
  END IF;

  -- The non-active player cannot move.
  v_turn:=(v_room.game_state->>'turn')::integer;
  v_actor:=CASE WHEN v_turn=0 THEN v_guest ELSE v_host END;
  v_raised:=false;
  BEGIN
    PERFORM public.engine_v3_apply_action(v_room_id,v_actor,'move-tavla',
      jsonb_build_object('from',0,'die',(v_room.game_state->'board'->'dice'->>0)::integer),v_room.updated_at);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'SMOKE_FAIL: wrong-turn Tavla move was accepted'; END IF;

  -- Find a move that preserves the maximum number of usable dice, then execute it through the public wrapper.
  v_actor:=CASE WHEN v_turn=0 THEN v_host ELSE v_guest END;
  v_dice:=v_room.game_state->'board'->'dice';
  v_bar:=v_room.game_state->'board'->'bar';
  v_off:=v_room.game_state->'board'->'off';
  v_max:=private.tavla_max_usable_dice(v_points,v_bar,v_off,v_turn,v_dice);
  v_found:=false;
  <<die_loop>>
  FOR v_candidate_die IN
    SELECT DISTINCT (value#>>'{}')::integer
    FROM jsonb_array_elements(v_dice)
    ORDER BY 1 DESC
  LOOP
    IF COALESCE((v_bar->>v_turn)::integer,0)>0 THEN
      v_candidate_source:=-1;
      IF private.tavla_can_move_from(v_points,v_bar,v_turn,-1,v_candidate_die) THEN
        v_preview:=private.tavla_preview_move(v_points,v_bar,v_off,v_turn,-1,v_candidate_die);
        SELECT COALESCE(jsonb_agg(q.value ORDER BY q.ord),'[]'::jsonb) INTO v_remaining
        FROM jsonb_array_elements(v_dice) WITH ORDINALITY q(value,ord)
        WHERE q.ord<>(SELECT min(z.ord) FROM jsonb_array_elements(v_dice) WITH ORDINALITY z(value,ord)
                      WHERE (z.value#>>'{}')::integer=v_candidate_die);
        v_after:=private.tavla_max_usable_dice(v_preview->'points',v_preview->'bar',v_preview->'off',v_turn,v_remaining);
        IF 1+v_after=v_max THEN
          v_move_from:=v_candidate_source; v_move_die:=v_candidate_die; v_found:=true; EXIT die_loop;
        END IF;
      END IF;
    ELSE
      FOR v_candidate_source IN 0..23 LOOP
        IF private.tavla_can_move_from(v_points,v_bar,v_turn,v_candidate_source,v_candidate_die) THEN
          v_preview:=private.tavla_preview_move(v_points,v_bar,v_off,v_turn,v_candidate_source,v_candidate_die);
          SELECT COALESCE(jsonb_agg(q.value ORDER BY q.ord),'[]'::jsonb) INTO v_remaining
          FROM jsonb_array_elements(v_dice) WITH ORDINALITY q(value,ord)
          WHERE q.ord<>(SELECT min(z.ord) FROM jsonb_array_elements(v_dice) WITH ORDINALITY z(value,ord)
                        WHERE (z.value#>>'{}')::integer=v_candidate_die);
          v_after:=private.tavla_max_usable_dice(v_preview->'points',v_preview->'bar',v_preview->'off',v_turn,v_remaining);
          IF 1+v_after=v_max THEN
            v_move_from:=v_candidate_source; v_move_die:=v_candidate_die; v_found:=true; EXIT die_loop;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END LOOP die_loop;
  IF NOT v_found THEN RAISE EXCEPTION 'SMOKE_FAIL: no maximum-use opening move found'; END IF;
  v_room:=public.engine_v3_apply_action(v_room_id,v_actor,'move-tavla',
    jsonb_build_object('from',v_move_from,'die',v_move_die),v_room.updated_at);
  IF v_room.game_state->'board'->'lastMove' IS NULL
     OR (v_room.game_state->'board'->'lastMove'->>'die')::integer<>v_move_die THEN
    RAISE EXCEPTION 'SMOKE_FAIL: valid classic Tavla move was not committed';
  END IF;

  -- Bar priority and legal re-entry.
  SELECT jsonb_agg(jsonb_build_object('owner',null,'count',0) ORDER BY i) INTO v_points
  FROM generate_series(0,23) AS g(i);
  v_bar:='[1,0]'::jsonb;
  IF private.tavla_can_move_from(v_points,v_bar,0,5,3)
     OR NOT private.tavla_can_move_from(v_points,v_bar,0,-1,3) THEN
    RAISE EXCEPTION 'SMOKE_FAIL: bar priority or re-entry validation is incorrect';
  END IF;

  -- A blot is hit and moved to the opponent bar.
  v_points:=jsonb_set(v_points,'{5}',jsonb_build_object('owner',0,'count',1),true);
  v_points:=jsonb_set(v_points,'{2}',jsonb_build_object('owner',1,'count',1),true);
  v_preview:=private.tavla_preview_move(v_points,'[0,0]'::jsonb,'[0,0]'::jsonb,0,5,3);
  IF (v_preview->'bar'->>1)::integer<>1
     OR v_preview->'points'->2->>'owner'<>'0'
     OR (v_preview->'points'->2->>'count')::integer<>1 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: hitting an opposing blot did not update the board and bar';
  END IF;

  -- Two opposing checkers block a point.
  v_points:=jsonb_set(v_points,'{2}',jsonb_build_object('owner',1,'count',2),true);
  IF private.tavla_can_move_from(v_points,'[0,0]'::jsonb,0,5,3) THEN
    RAISE EXCEPTION 'SMOKE_FAIL: a blocked point was accepted as a legal destination';
  END IF;

  -- Bear-off is allowed only when all remaining checkers are home.
  SELECT jsonb_agg(jsonb_build_object('owner',null,'count',0) ORDER BY i) INTO v_points
  FROM generate_series(0,23) AS g(i);
  v_points:=jsonb_set(v_points,'{5}',jsonb_build_object('owner',0,'count',1),true);
  v_preview:=private.tavla_preview_move(v_points,'[0,0]'::jsonb,'[14,0]'::jsonb,0,5,6);
  IF (v_preview->'off'->>0)::integer<>15 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: legal bear-off was not counted';
  END IF;
  v_points:=jsonb_set(v_points,'{2}',jsonb_build_object('owner',0,'count',1),true);
  v_points:=jsonb_set(v_points,'{5}',jsonb_build_object('owner',0,'count',1),true);
  v_raised:=false;
  BEGIN
    PERFORM private.tavla_preview_move(v_points,'[0,0]'::jsonb,'[13,0]'::jsonb,0,2,4);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'SMOKE_FAIL: oversized die ignored a farther checker'; END IF;

  -- Doubles expose four dice and the solver must maximize their use.
  SELECT jsonb_agg(jsonb_build_object('owner',null,'count',0) ORDER BY i) INTO v_points
  FROM generate_series(0,23) AS g(i);
  v_points:=jsonb_set(v_points,'{10}',jsonb_build_object('owner',0,'count',15),true);
  IF private.tavla_max_usable_dice(v_points,'[0,0]'::jsonb,'[0,0]'::jsonb,0,'[2,2,2,2]'::jsonb)<>4 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: four doubles were not treated as four usable dice';
  END IF;

  -- A move that prevents using the maximum number of dice is rejected.
  SELECT jsonb_agg(jsonb_build_object('owner',null,'count',0) ORDER BY i) INTO v_points
  FROM generate_series(0,23) AS g(i);
  v_points:=jsonb_set(v_points,'{10}',jsonb_build_object('owner',0,'count',2),true);
  v_points:=jsonb_set(v_points,'{17}',jsonb_build_object('owner',0,'count',1),true);
  v_points:=jsonb_set(v_points,'{1}',jsonb_build_object('owner',1,'count',3),true);
  v_points:=jsonb_set(v_points,'{6}',jsonb_build_object('owner',1,'count',2),true);
  v_points:=jsonb_set(v_points,'{7}',jsonb_build_object('owner',1,'count',2),true);
  v_points:=jsonb_set(v_points,'{22}',jsonb_build_object('owner',1,'count',2),true);
  v_points:=jsonb_set(v_points,'{20}',jsonb_build_object('owner',1,'count',6),true);
  v_dice:='[6,4]'::jsonb;
  v_off:='[12,0]'::jsonb;
  IF private.tavla_max_usable_dice(v_points,'[0,0]'::jsonb,v_off,0,v_dice)<>2 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: expected two usable dice in maximum-use scenario';
  END IF;
  UPDATE public.game_rooms SET status='playing',updated_at=pg_catalog.clock_timestamp(),
    game_state=jsonb_build_object('phase','playing','turn',0,'scores','{}'::jsonb,'feed','[]'::jsonb,
      'board',jsonb_build_object('points',v_points,'bar','[0,0]'::jsonb,'off',v_off,'dice',v_dice))
  WHERE id=v_room_id RETURNING * INTO v_room;
  v_raised:=false;
  BEGIN
    PERFORM public.engine_v3_apply_action(v_room_id,v_host,'move-tavla',
      jsonb_build_object('from',17,'die',6),v_room.updated_at);
  EXCEPTION WHEN SQLSTATE '55000' THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'SMOKE_FAIL: move that wastes a usable die was accepted'; END IF;

  -- If only one of two dice is playable, the higher playable die is mandatory.
  SELECT jsonb_agg(jsonb_build_object('owner',null,'count',0) ORDER BY i) INTO v_points
  FROM generate_series(0,23) AS g(i);
  v_points:=jsonb_set(v_points,'{10}',jsonb_build_object('owner',0,'count',15),true);
  v_points:=jsonb_set(v_points,'{9}',jsonb_build_object('owner',1,'count',2),true);
  v_points:=jsonb_set(v_points,'{7}',jsonb_build_object('owner',1,'count',2),true);
  v_points:=jsonb_set(v_points,'{20}',jsonb_build_object('owner',1,'count',11),true);
  v_dice:='[2,1]'::jsonb;
  UPDATE public.game_rooms SET status='playing',updated_at=pg_catalog.clock_timestamp(),
    game_state=jsonb_build_object('phase','playing','turn',0,'scores','{}'::jsonb,'feed','[]'::jsonb,
      'board',jsonb_build_object('points',v_points,'bar','[0,0]'::jsonb,'off','[0,0]'::jsonb,'dice',v_dice))
  WHERE id=v_room_id RETURNING * INTO v_room;
  v_raised:=false;
  BEGIN
    PERFORM public.engine_v3_apply_action(v_room_id,v_host,'move-tavla',
      jsonb_build_object('from',10,'die',1),v_room.updated_at);
  EXCEPTION WHEN SQLSTATE '55000' THEN v_raised:=true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'SMOKE_FAIL: lower die was accepted while the higher die was playable'; END IF;

  -- A winning bear-off commits the winner and authoritative progression event atomically.
  SELECT jsonb_agg(jsonb_build_object('owner',null,'count',0) ORDER BY i) INTO v_points
  FROM generate_series(0,23) AS g(i);
  v_points:=jsonb_set(v_points,'{5}',jsonb_build_object('owner',0,'count',1),true);
  v_points:=jsonb_set(v_points,'{18}',jsonb_build_object('owner',1,'count',15),true);
  v_dice:='[6]'::jsonb;
  UPDATE public.game_rooms SET status='playing',updated_at=pg_catalog.clock_timestamp(),
    game_state=jsonb_build_object('phase','playing','turn',0,'scores','{}'::jsonb,'feed','[]'::jsonb,
      'board',jsonb_build_object('points',v_points,'bar','[0,0]'::jsonb,'off','[14,0]'::jsonb,'dice',v_dice))
  WHERE id=v_room_id RETURNING * INTO v_room;
  v_room:=public.engine_v3_apply_action(v_room_id,v_host,'move-tavla',
    jsonb_build_object('from',5,'die',6),v_room.updated_at);
  SELECT count(*) INTO v_event_count FROM public.game_room_action_events
  WHERE room_id=v_room_id AND actor_id=v_host AND game_key='tavla'
    AND action='game-finished' AND event_payload->>'reason'='all_checkers_borne_off';
  IF v_room.status<>'finished' OR v_room.game_state->>'winnerId'<>v_host::text OR v_event_count<>1 THEN
    RAISE EXCEPTION 'SMOKE_FAIL: winning bear-off did not atomically finish and emit progression event';
  END IF;
END;
$test$;

ROLLBACK;
