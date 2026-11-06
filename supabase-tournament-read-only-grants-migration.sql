-- Tournament standings are readable by room members, but all writes remain service-role only.
REVOKE ALL ON TABLE
  public.game_room_tournaments,
  public.game_room_tournament_scores,
  public.game_room_tournament_rounds
FROM anon, authenticated;

GRANT SELECT ON TABLE
  public.game_room_tournaments,
  public.game_room_tournament_scores,
  public.game_room_tournament_rounds
TO authenticated;
