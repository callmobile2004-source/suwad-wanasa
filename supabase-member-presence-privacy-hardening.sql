-- Run ONLY after the frontend in PR #46 is deployed.
-- The updated frontend no longer selects or writes profiles.last_seen_at.
-- The authoritative privacy-aware presence API is public.member_presence + its RPCs.

revoke select on table public.profiles from authenticated;
revoke select (last_seen_at) on table public.profiles from authenticated;
grant select (
  id,
  username,
  display_name,
  friend_code,
  created_at,
  avatar_url,
  equipped_title_id
) on table public.profiles to authenticated;

revoke update (last_seen_at) on table public.profiles from authenticated;
