-- Add indexes for tournament foreign keys to keep joins and referential
-- actions efficient as the tournament tables grow.
CREATE INDEX IF NOT EXISTS game_room_tournament_rounds_winner_id_idx
  ON public.game_room_tournament_rounds (winner_id);

CREATE INDEX IF NOT EXISTS game_room_tournament_scores_user_id_idx
  ON public.game_room_tournament_scores (user_id);

CREATE INDEX IF NOT EXISTS game_room_tournaments_champion_id_idx
  ON public.game_room_tournaments (champion_id);

CREATE INDEX IF NOT EXISTS game_room_tournaments_host_id_idx
  ON public.game_room_tournaments (host_id);
