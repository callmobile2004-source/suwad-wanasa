-- Friend-room tournament support. Writes are server-only; room members can read standings.
CREATE TABLE IF NOT EXISTS public.game_room_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL UNIQUE REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  total_rounds integer NOT NULL DEFAULT 5 CHECK (total_rounds BETWEEN 2 AND 10),
  current_round integer NOT NULL DEFAULT 1 CHECK (current_round BETWEEN 1 AND 11),
  points_per_win integer NOT NULL DEFAULT 3 CHECK (points_per_win BETWEEN 1 AND 10),
  champion_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.game_room_tournament_scores (
  room_id uuid NOT NULL REFERENCES public.game_room_tournaments(room_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  draws integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
  rounds_played integer NOT NULL DEFAULT 0 CHECK (rounds_played >= 0),
  PRIMARY KEY (room_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.game_room_tournament_rounds (
  room_id uuid NOT NULL REFERENCES public.game_room_tournaments(room_id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number BETWEEN 1 AND 10),
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result_type text NOT NULL CHECK (result_type IN ('win','draw')),
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  final_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id,round_number)
);

CREATE INDEX IF NOT EXISTS game_room_tournament_scores_rank_idx
  ON public.game_room_tournament_scores(room_id,points DESC,wins DESC,draws ASC);

ALTER TABLE public.game_room_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_tournament_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_room_tournament_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_room_tournaments_read_members ON public.game_room_tournaments;
CREATE POLICY game_room_tournaments_read_members ON public.game_room_tournaments
  FOR SELECT TO authenticated USING (private.is_game_room_member(room_id));
DROP POLICY IF EXISTS game_room_tournament_scores_read_members ON public.game_room_tournament_scores;
CREATE POLICY game_room_tournament_scores_read_members ON public.game_room_tournament_scores
  FOR SELECT TO authenticated USING (private.is_game_room_member(room_id));
DROP POLICY IF EXISTS game_room_tournament_rounds_read_members ON public.game_room_tournament_rounds;
CREATE POLICY game_room_tournament_rounds_read_members ON public.game_room_tournament_rounds
  FOR SELECT TO authenticated USING (private.is_game_room_member(room_id));

REVOKE ALL ON public.game_room_tournaments,public.game_room_tournament_scores,public.game_room_tournament_rounds FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.game_room_tournaments,public.game_room_tournament_scores,public.game_room_tournament_rounds FROM authenticated;
GRANT SELECT ON public.game_room_tournaments,public.game_room_tournament_scores,public.game_room_tournament_rounds TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.game_room_tournaments,public.game_room_tournament_scores,public.game_room_tournament_rounds TO service_role;

CREATE OR REPLACE FUNCTION public.engine_create_room_tournament(
  p_room_id uuid,p_actor_id uuid,p_total_rounds integer DEFAULT 5,p_points_per_win integer DEFAULT 3
)
RETURNS public.game_room_tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_tournament public.game_room_tournaments;
  v_player_count integer;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Engine gateway only.' USING errcode='42501';
  END IF;
  IF p_room_id IS NULL OR p_actor_id IS NULL OR p_total_rounds NOT BETWEEN 2 AND 10
     OR p_points_per_win NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'إعدادات البطولة غير صالحة.' USING errcode='22023';
  END IF;
  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الغرفة غير موجودة.'; END IF;
  IF v_room.host_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'إنشاء البطولة من صلاحية الهوست فقط.' USING errcode='42501';
  END IF;
  IF v_room.status<>'waiting' THEN
    RAISE EXCEPTION 'أنشئ البطولة قبل بدء اللعب.' USING errcode='55000';
  END IF;
  SELECT count(*)::integer INTO v_player_count FROM public.game_room_players WHERE room_id=p_room_id;
  IF v_player_count<2 THEN RAISE EXCEPTION 'تحتاج البطولة لاعبين اثنين على الأقل.' USING errcode='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.game_room_tournaments WHERE room_id=p_room_id) THEN
    RAISE EXCEPTION 'هذه الغرفة لديها بطولة بالفعل.' USING errcode='23505';
  END IF;

  INSERT INTO public.game_room_tournaments(room_id,host_id,total_rounds,current_round,points_per_win)
  VALUES(p_room_id,p_actor_id,p_total_rounds,1,p_points_per_win)
  RETURNING * INTO v_tournament;

  INSERT INTO public.game_room_tournament_scores(room_id,user_id)
  SELECT p_room_id,user_id FROM public.game_room_players WHERE room_id=p_room_id
  ON CONFLICT(room_id,user_id) DO NOTHING;
  RETURN v_tournament;
END;
$function$;

REVOKE ALL ON FUNCTION public.engine_create_room_tournament(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.engine_create_room_tournament(uuid,uuid,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION private.sync_tournament_player_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS(SELECT 1 FROM public.game_room_tournaments WHERE room_id=NEW.room_id AND status='active') THEN
    INSERT INTO public.game_room_tournament_scores(room_id,user_id)
    VALUES(NEW.room_id,NEW.user_id)
    ON CONFLICT(room_id,user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS game_room_tournament_player_joined ON public.game_room_players;
CREATE TRIGGER game_room_tournament_player_joined
AFTER INSERT ON public.game_room_players
FOR EACH ROW EXECUTE FUNCTION private.sync_tournament_player_score();

CREATE OR REPLACE FUNCTION private.record_room_tournament_round()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tournament public.game_room_tournaments;
  v_winner uuid;
  v_winners uuid[];
  v_max_score integer;
  v_champion uuid;
  v_result text;
  v_points integer;
BEGIN
  IF OLD.status IS DISTINCT FROM 'playing' OR NEW.status IS DISTINCT FROM 'finished' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_tournament
  FROM public.game_room_tournaments
  WHERE room_id=NEW.id AND status='active'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.game_room_tournament_rounds
    WHERE room_id=NEW.id AND round_number=v_tournament.current_round) THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_winner:=nullif(NEW.game_state->'board'->>'winner_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_winner:=NULL;
  END;
  IF v_winner IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.game_room_tournament_scores WHERE room_id=NEW.id AND user_id=v_winner
  ) THEN
    v_winners:=ARRAY[v_winner];
  ELSE
    SELECT max(value::integer) INTO v_max_score
    FROM jsonb_each_text(coalesce(NEW.game_state->'scores','{}'::jsonb))
    WHERE value ~ '^-?[0-9]+$';
    IF v_max_score IS NOT NULL AND v_max_score>0 THEN
      SELECT array_agg(key::uuid ORDER BY key) INTO v_winners
      FROM jsonb_each_text(coalesce(NEW.game_state->'scores','{}'::jsonb))
      WHERE value ~ '^-?[0-9]+$' AND value::integer=v_max_score
        AND EXISTS(SELECT 1 FROM public.game_room_tournament_scores s
          WHERE s.room_id=NEW.id AND s.user_id=key::uuid);
    ELSE
      SELECT array_agg(user_id ORDER BY user_id) INTO v_winners
      FROM public.game_room_tournament_scores WHERE room_id=NEW.id;
    END IF;
  END IF;
  IF coalesce(cardinality(v_winners),0)=0 THEN RETURN NEW; END IF;

  v_result:=CASE WHEN cardinality(v_winners)=1 THEN 'win' ELSE 'draw' END;
  v_points:=CASE WHEN v_result='win' THEN v_tournament.points_per_win ELSE 1 END;
  INSERT INTO public.game_room_tournament_rounds(
    room_id,round_number,winner_id,result_type,points_awarded,final_scores
  ) VALUES(
    NEW.id,v_tournament.current_round,
    CASE WHEN v_result='win' THEN v_winners[1] ELSE NULL END,
    v_result,v_points,coalesce(NEW.game_state->'scores','{}'::jsonb)
  );

  UPDATE public.game_room_tournament_scores
  SET rounds_played=rounds_played+1,
      points=points+CASE WHEN user_id=ANY(v_winners) THEN v_points ELSE 0 END,
      wins=wins+CASE WHEN v_result='win' AND user_id=v_winners[1] THEN 1 ELSE 0 END,
      draws=draws+CASE WHEN v_result='draw' AND user_id=ANY(v_winners) THEN 1 ELSE 0 END
  WHERE room_id=NEW.id;

  IF v_tournament.current_round>=v_tournament.total_rounds THEN
    SELECT user_id INTO v_champion
    FROM public.game_room_tournament_scores
    WHERE room_id=NEW.id
    ORDER BY points DESC,wins DESC,draws ASC,rounds_played DESC,user_id
    LIMIT 1;
    UPDATE public.game_room_tournaments
    SET status='completed',champion_id=v_champion,completed_at=pg_catalog.clock_timestamp(),
        updated_at=pg_catalog.clock_timestamp()
    WHERE room_id=NEW.id;
  ELSE
    UPDATE public.game_room_tournaments
    SET current_round=current_round+1,updated_at=pg_catalog.clock_timestamp()
    WHERE room_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS game_room_tournament_round_after_finish ON public.game_rooms;
CREATE TRIGGER game_room_tournament_round_after_finish
AFTER UPDATE OF status ON public.game_rooms
FOR EACH ROW EXECUTE FUNCTION private.record_room_tournament_round();
