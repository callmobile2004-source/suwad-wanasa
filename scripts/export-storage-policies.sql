-- Export only app-defined Storage policies; no buckets, objects, or file data.
SELECT
  'DROP POLICY IF EXISTS '||quote_ident(policyname)||' ON '||quote_ident(schemaname)||'.'||quote_ident(tablename)||';'||E'\n'||
  'CREATE POLICY '||quote_ident(policyname)||' ON '||quote_ident(schemaname)||'.'||quote_ident(tablename)||
  ' AS '||upper(permissive)||' FOR '||upper(cmd)||' TO '||
  (SELECT string_agg(CASE WHEN role_name='public' THEN 'PUBLIC' ELSE quote_ident(role_name) END,', ' ORDER BY role_name)
   FROM unnest(roles) AS r(role_name))||
  CASE WHEN qual IS NOT NULL THEN ' USING ('||qual||')' ELSE '' END||
  CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK ('||with_check||')' ELSE '' END||';'
FROM pg_catalog.pg_policies
WHERE schemaname='storage'
ORDER BY tablename,policyname;
