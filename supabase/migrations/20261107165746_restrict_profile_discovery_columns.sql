-- Restrict profile discovery to the small set of fields used by friend search and public cards.
-- Keep table-level DML revoked; authenticated users receive only the required column grants.
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles FROM anon, authenticated, service_role;

GRANT SELECT (id, username, display_name, friend_code, created_at, avatar_url, equipped_title_id)
ON TABLE public.profiles TO authenticated;

GRANT UPDATE (username, display_name, avatar_url, equipped_title_id, last_seen_at)
ON TABLE public.profiles TO authenticated;
