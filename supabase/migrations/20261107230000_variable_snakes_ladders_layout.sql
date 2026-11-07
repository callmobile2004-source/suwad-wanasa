-- Generate a fresh, variable-count snakes/ladders map for every authoritative online round.
-- The board is persisted in game_state so rendering and server movement use identical links.
CREATE OR REPLACE FUNCTION private.generate_snakes_board_layout()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = ''
AS $function$
DECLARE
  v_snakes jsonb := '[]'::jsonb;
  v_ladders jsonb := '[]'::jsonb;
  v_used integer[] := ARRAY[1,100];
  v_snake_count integer := 3 + floor(random()*4)::integer;
  v_ladder_count integer := 2 + floor(random()*5)::integer;
  v_from integer;
  v_to integer;
  v_attempt integer;
  v_i integer;
BEGIN
  IF v_snake_count = v_ladder_count THEN
    v_ladder_count := CASE WHEN v_ladder_count = 6 THEN 2 ELSE v_ladder_count + 1 END;
  END IF;

  FOR v_i IN 1..v_snake_count LOOP
    v_from := NULL;
    v_to := NULL;
    FOR v_attempt IN 1..500 LOOP
      v_from := 18 + floor(random()*81)::integer;
      v_to := 2 + floor(random() * greatest(1, v_from-10))::integer;
      IF v_from <= 98 AND v_to <= v_from-9
         AND NOT (v_from = ANY(v_used)) AND NOT (v_to = ANY(v_used)) THEN
        EXIT;
      END IF;
      v_from := NULL;
      v_to := NULL;
    END LOOP;
    IF v_from IS NULL OR v_to IS NULL THEN
      RAISE EXCEPTION 'تعذّر إنشاء توزيع آمن للأفاعي.' USING ERRCODE='55000';
    END IF;
    v_used := array_append(array_append(v_used,v_from),v_to);
    v_snakes := v_snakes || jsonb_build_array(jsonb_build_object('from',v_from,'to',v_to));
  END LOOP;

  FOR v_i IN 1..v_ladder_count LOOP
    v_from := NULL;
    v_to := NULL;
    FOR v_attempt IN 1..500 LOOP
      v_from := 2 + floor(random()*88)::integer;
      v_to := v_from + 9 + floor(random()*greatest(1,100-v_from-9))::integer;
      IF v_to <= 99
         AND NOT (v_from = ANY(v_used)) AND NOT (v_to = ANY(v_used)) THEN
        EXIT;
      END IF;
      v_from := NULL;
      v_to := NULL;
    END LOOP;
    IF v_from IS NULL OR v_to IS NULL THEN
      RAISE EXCEPTION 'تعذّر إنشاء توزيع آمن للسلالم.' USING ERRCODE='55000';
    END IF;
    v_used := array_append(array_append(v_used,v_from),v_to);
    v_ladders := v_ladders || jsonb_build_array(jsonb_build_object('from',v_from,'to',v_to));
  END LOOP;

  RETURN jsonb_build_object('snakes',v_snakes,'ladders',v_ladders);
END;
$function$;

-- Patch only the known board-initialization statement; abort if the live definition differs.
DO $migration$
DECLARE
  v_definition text;
  v_old text := 'v_board:=jsonb_build_object(''positions'',v_positions,''dice'',null,''finished'',null);';
  v_new text := 'v_board:=jsonb_build_object(''positions'',v_positions,''dice'',null,''finished'',null) || private.generate_snakes_board_layout();';
BEGIN
  v_definition := pg_catalog.pg_get_functiondef(
    'public.engine_v3_apply_action_core(uuid,uuid,text,jsonb,timestamp with time zone)'::regprocedure
  );
  IF pg_catalog.strpos(v_definition,v_old)=0 THEN
    RAISE EXCEPTION 'محرك حيّة ودرج تغيّر؛ أُلغيت الهجرة دون تعديل المحرك.';
  END IF;
  v_definition := pg_catalog.replace(v_definition,v_old,v_new);
  EXECUTE v_definition;
END;
$migration$;
