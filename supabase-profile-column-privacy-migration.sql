-- Privacy hardening for player profile discovery.
-- Friend discovery continues to expose only the fields used by social.js.
-- last_seen_at remains available through the privacy-aware get_member_presence RPC.
-- No rows, accounts, friendship records, or guest-auth settings are changed.

revoke select on table public.profiles from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  friend_code,
  created_at,
  avatar_url,
  equipped_title_id
) on table public.profiles to authenticated;
