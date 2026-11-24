-- Private per-user voice preference. No demographic attribute is stored.
CREATE TABLE IF NOT EXISTS public.profile_voice_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_style text NOT NULL DEFAULT 'default'
    CHECK (voice_style IN ('default', 'male', 'female')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_voice_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_voice_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profile_voice_preferences TO authenticated;
DROP POLICY IF EXISTS "users read their own voice preference" ON public.profile_voice_preferences;
CREATE POLICY "users read their own voice preference"
  ON public.profile_voice_preferences FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "users create their own voice preference" ON public.profile_voice_preferences;
CREATE POLICY "users create their own voice preference"
  ON public.profile_voice_preferences FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "users update their own voice preference" ON public.profile_voice_preferences;
CREATE POLICY "users update their own voice preference"
  ON public.profile_voice_preferences FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
COMMENT ON TABLE public.profile_voice_preferences IS
  'Private voice presentation preference only; no inferred user gender is stored.';
