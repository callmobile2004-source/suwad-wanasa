#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -z "\${SUPABASE_DB_URL:-}" ]]; then
  echo "::error::Missing GitHub Actions secret SUPABASE_DB_URL. Add a read-capable PostgreSQL URI in repository Settings > Secrets and variables > Actions." >&2
  exit 1
fi
if [[ -z "\${LOCAL_DB_URL:-}" ]]; then
  echo "::error::LOCAL_DB_URL was not supplied by the local Supabase stack." >&2
  exit 1
fi

command -v supabase >/dev/null
command -v psql >/dev/null
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

source_schema="$tmpdir/production-schema.sql"
storage_policies="$tmpdir/storage-policies.sql"
source_manifest="$tmpdir/source.manifest"
local_manifest="$tmpdir/local.manifest"

echo "Exporting schema-only DDL from production public/private schemas."
supabase db dump --db-url "$SUPABASE_DB_URL" --schema public,private -f "$source_schema"
test -s "$source_schema"

echo "Exporting Storage policy definitions only; no Storage rows or files."
psql "$SUPABASE_DB_URL" -X -A -t -v ON_ERROR_STOP=1 -f scripts/export-storage-policies.sql > "$storage_policies"

echo "Restoring schema-only baseline into the disposable local Supabase database."
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$source_schema"
if [[ -s "$storage_policies" ]]; then
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$storage_policies"
fi

echo "Comparing relation, column, constraint, index, function, trigger, policy, enum, view, sequence and ACL manifests."
psql "$SUPABASE_DB_URL" -X -A -t -F '|' -v ON_ERROR_STOP=1 -f scripts/schema-baseline-manifest.sql > "$source_manifest"
psql "$LOCAL_DB_URL" -X -A -t -F '|' -v ON_ERROR_STOP=1 -f scripts/schema-baseline-manifest.sql > "$local_manifest"
if ! cmp -s "$source_manifest" "$local_manifest"; then
  diff -u "$source_manifest" "$local_manifest" > "$tmpdir/manifest.diff" || true
  echo "::error::The restored schema manifest differs from production. No engine tests were run."
  sed -n '1,160p' "$tmpdir/manifest.diff"
  exit 1
fi

echo "Verified schema baseline SHA-256:"
sha256sum "$source_schema"
echo "Production schema baseline and disposable restore match."

echo "Applying only the four branch migrations not present in production."
for migration in \
  supabase/migrations/20261107190000_domino_choose_chain_end.sql \
  supabase/migrations/20261107230000_variable_snakes_ladders_layout.sql \
  supabase/migrations/20261108100000_authoritative_room_engine_wrapper_reconciled.sql \
  supabase/migrations/20261108130000_restrict_private_helper_execute_acl.sql
do
  echo "Applying $migration"
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$migration"
done

echo "Running complete authoritative room-engine lifecycle/security regression."
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f scripts/test-authoritative-room-engines.sql

echo "Checking the final private-helper and client-table administrative ACL invariants."
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
DO $assertions$
DECLARE
  v_table record;
  v_privilege text;
BEGIN
  IF to_regprocedure('private.apply_game_room_surprise_effect()') IS NOT NULL
     AND (has_function_privilege('anon','private.apply_game_room_surprise_effect()','EXECUTE')
       OR has_function_privilege('authenticated','private.apply_game_room_surprise_effect()','EXECUTE')
       OR NOT has_function_privilege('service_role','private.apply_game_room_surprise_effect()','EXECUTE')) THEN
    RAISE EXCEPTION 'SMOKE_FAIL: private trigger helper ACL is not hardened';
  END IF;
  IF to_regprocedure('private.t_player(uuid)') IS NOT NULL
     AND (has_function_privilege('anon','private.t_player(uuid)','EXECUTE')
       OR NOT has_function_privilege('authenticated','private.t_player(uuid)','EXECUTE')
       OR NOT has_function_privilege('service_role','private.t_player(uuid)','EXECUTE')) THEN
    RAISE EXCEPTION 'SMOKE_FAIL: tournament helper ACL compatibility changed';
  END IF;
  FOR v_table IN
    SELECT c.oid::regclass AS relation
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
  LOOP
    FOREACH v_privilege IN ARRAY ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
      IF has_table_privilege('anon',v_table.relation,v_privilege)
         OR has_table_privilege('authenticated',v_table.relation,v_privilege) THEN
        RAISE EXCEPTION 'SMOKE_FAIL: client role retains % on %',v_privilege,v_table.relation;
      END IF;
    END LOOP;
  END LOOP;
END;
$assertions$;
SQL

echo "PASS: production schema rebuilt, verified, four pending migrations applied, and authoritative engine tests passed."
