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
  v_columns integer[];
  v_snake_count integer := 2 + floor(random()*4)::integer;
  v_ladder_count integer := 2 + floor(random()*4)::integer;
  v_col integer;
  v_high_row integer;
  v_low_row integer;
  v_from integer;
  v_to integer;
  v_i integer;
BEGIN
  IF v_snake_count = v_ladder_count THEN
    v_ladder_count := CASE WHEN v_ladder_count = 5 THEN 2 ELSE v_ladder_count + 1 END;
  END IF;
  IF v_snake_count + v_ladder_count > 9 THEN
    v_ladder_count := 9 - v_snake_count;
  END IF;

  SELECT array_agg(column_number ORDER BY random())
  INTO v_columns
  FROM generate_series(1,9) AS column_number;

  -- Each link occupies its own vertical board lane. Since lanes are distinct,
  -- the artwork cannot cross or overlap another snake/ladder path.
  FOR v_i IN 1..v_snake_count LOOP
    v_col := v_columns[v_i];
    v_high_row := 3 + floor(random()*6)::integer;
    v_low_row := floor(random()*(v_high_row-1))::integer;
    v_from := v_high_row*10 + CASE WHEN mod(v_high_row,2)=0 THEN v_col ELSE 9-v_col END + 1;
    v_to := v_low_row*10 + CASE WHEN mod(v_low_row,2)=0 THEN v_col ELSE 9-v_col END + 1;
    v_snakes := v_snakes || jsonb_build_array(jsonb_build_object('from',v_from,'to',v_to));
  END LOOP;

  FOR v_i IN 1..v_ladder_count LOOP
    v_col := v_columns[v_snake_count+v_i];
    v_low_row := floor(random()*7)::integer;
    v_high_row := v_low_row + 2 + floor(random()*(7-v_low_row))::integer;
    v_from := v_low_row*10 + CASE WHEN mod(v_low_row,2)=0 THEN v_col ELSE 9-v_col END + 1;
    v_to := v_high_row*10 + CASE WHEN mod(v_high_row,2)=0 THEN v_col ELSE 9-v_col END + 1;
    v_ladders := v_ladders || jsonb_build_array(jsonb_build_object('from',v_from,'to',v_to));
  END LOOP;

  RETURN jsonb_build_object('snakes',v_snakes,'ladders',v_ladders);
END;
$function$;

REVOKE ALL ON FUNCTION private.generate_snakes_board_layout() FROM PUBLIC, anon, authenticated;

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
