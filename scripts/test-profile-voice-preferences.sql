\set ON_ERROR_STOP on
BEGIN;
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END; $roles$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $function$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid; $function$;
CREATE TABLE public.profile_voice_preferences(
 user_id uuid PRIMARY KEY,voice_style text NOT NULL DEFAULT 'default'
 CHECK(voice_style IN ('default','male','female')),created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profile_voice_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_voice_preferences FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profile_voice_preferences TO authenticated;
CREATE POLICY voice_pref_select_own ON public.profile_voice_preferences FOR SELECT TO authenticated USING((SELECT auth.uid())=user_id);
CREATE POLICY voice_pref_insert_own ON public.profile_voice_preferences FOR INSERT TO authenticated WITH CHECK((SELECT auth.uid())=user_id);
CREATE POLICY voice_pref_update_own ON public.profile_voice_preferences FOR UPDATE TO authenticated USING((SELECT auth.uid())=user_id) WITH CHECK((SELECT auth.uid())=user_id);
INSERT INTO public.profile_voice_preferences(user_id,voice_style) VALUES
 ('11111111-1111-4111-8111-111111111111','default'),
 ('22222222-2222-4222-8222-222222222222','male');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $own$ DECLARE n integer;s text;changed integer; BEGIN
 SELECT count(*) INTO n FROM public.profile_voice_preferences;IF n<>1 THEN RAISE EXCEPTION 'A must see own row only';END IF;
 SELECT voice_style INTO s FROM public.profile_voice_preferences WHERE user_id='11111111-1111-4111-8111-111111111111';
 IF s<>'default' THEN RAISE EXCEPTION 'default row missing';END IF;
 UPDATE public.profile_voice_preferences SET voice_style='female',updated_at=now() WHERE user_id='11111111-1111-4111-8111-111111111111';
 GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'A cannot update own row';END IF;
 UPDATE public.profile_voice_preferences SET voice_style='female' WHERE user_id='22222222-2222-4222-8222-222222222222';
 GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>0 THEN RAISE EXCEPTION 'A updated B row';END IF;
END;$own$;
DO $forge$ BEGIN
 BEGIN
  INSERT INTO public.profile_voice_preferences(user_id,voice_style) VALUES('22222222-2222-4222-8222-222222222222','female');
  RAISE EXCEPTION 'cross-user insert unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;$forge$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $b$ DECLARE n integer;s text;BEGIN
 SELECT count(*) INTO n FROM public.profile_voice_preferences;
 SELECT voice_style INTO s FROM public.profile_voice_preferences WHERE user_id='22222222-2222-4222-8222-222222222222';
 IF n<>1 OR s<>'male' THEN RAISE EXCEPTION 'B preference exposed or modified';END IF;
END;$b$;
RESET ROLE;
ROLLBACK;
