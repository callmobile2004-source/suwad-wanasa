-- Extend the existing leaderboard view with public profile presentation fields.
-- security_invoker ensures underlying table RLS remains enforced for the caller.
create or replace view public.player_leaderboard
with (security_invoker=true)
as
select
  p.id as user_id,
  p.display_name,
  p.username,
  coalesce(pp.xp,0) as xp,
  coalesce(pp.games_completed,0) as games_completed,
  (select count(*)::integer from public.player_achievements pa where pa.user_id=p.id) as achievement_count,
  ((1::numeric + floor(coalesce(pp.xp,0)::numeric / 100::numeric)))::integer as level,
  p.avatar_url,
  p.equipped_title_id
from public.profiles p
left join public.player_progress pp on pp.user_id=p.id;

grant select on public.player_leaderboard to authenticated;
