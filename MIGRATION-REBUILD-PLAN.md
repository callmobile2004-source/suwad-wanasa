# Migration Rebuild Plan — Suwad Wanasa

Audit update: 2026-11-09 (UTC)
Repository: `callmobile2004-source/suwad-wanasa`
Audited branch: `feat/all-games-deliberate-motion`
Production Supabase project: `nswalgakanjtfvluuola`
Production PostgreSQL: 17.11.0.011 (major 17)

## 1. Current verified inventory

A fresh read of the production migration ledger returned **54 applied versions**. There are no duplicate version IDs. The migration name `restrict_client_table_admin_privileges` occurs twice, at `20261109002744` and `20261109003703`; both records are retained and must not be edited or deleted.

The audited Git branch contains **15 timestamped SQL files**:
- **11** have a version matching a production ledger entry.
- **4** are not yet applied to production: `20261107190000_domino_choose_chain_end`, `20261107230000_variable_snakes_ladders_layout`, `20261108100000_authoritative_room_engine_wrapper_reconciled`, and `20261108130000_restrict_private_helper_execute_acl`.
- **43** production ledger versions do not have a timestamp-matched migration file in this branch.

A matching timestamped filename is not, by itself, proof that the contents are byte-for-byte identical to the SQL that was applied in production.

## 2. Source provenance for the 43 versions without matching timestamped files

The following commits establish that useful SQL source candidates exist in Git history. They do **not** prove that a present-day root-level snapshot is the exact SQL text submitted for each individual production migration. Where one root file contains multiple changes or a later cumulative function body, it is a candidate, not an original historical migration.

| Production version group / recorded names | Git source candidate(s) | Provenance evidence | Classification |
|---|---|---|---|
| `20261102053601` player_progression_system; `20261102053800` player_achievements_lookup_index; `20261102053956` harden_progression_result_validation | `supabase-progression-migration.sql`; `supabase-progression-hardening-migration.sql` | Commits `4c9b9086a28be8f0623a8becd347c0c380f1f4a2`, `c91ac747679a6f1266f43e146513c279bc75130e`, `5afc73be7a04a1106082a3aafc43995deacbf59a` | Candidate sources; files evolved across commits and are not proven exact per-version exports. |
| `20261102065010` database_security_performance_hardening | No uniquely attributable source found | No one historical file/commit has been established as its original SQL. | **Unresolved.** |
| `20261102195301` room_engine_preflight_archive | No uniquely attributable source found | No original preflight/archive SQL source has been established. | **Unresolved.** |
| `20261102195320` online_room_hardening_phase1 | `supabase-room-security-migration.sql` | Related commits include `c6b380bd`, `0fdb5cc5`, `a26b950f`, `fd58b238`, `f17054e9`, and `d011a4ac`. | Related history exists, but the root file is a later accumulated version. |
| `20261102195344` online_engine_v2_number; `20261102204417` authoritative_number_engine_hardening | `supabase-authoritative-number-engine-migration.sql` | Commit `14e604d78924554edb0e7a612961af1d9904545e` | Candidate source; not an independently preserved copy of each applied migration. |
| `20261102211009` authoritative_room_engines_v3; `20261102211101` authoritative_room_engines_v3_progress_acl; `20261102211654` authoritative_room_engines_v3_corrective | `supabase-authoritative-room-engines-v3-migration.sql`; `supabase-authoritative-room-engines-v3-hardening-migration.sql`; `supabase-authoritative-room-engines-v3-corrective-migration.sql` | Commit `41b77976b1e93fe9ec140ba6895ef2a56c397a37` includes the v3 source/test and related engine updates. | Candidate source family; the corrective snapshot is not evidence of the exact earlier v3 SQL. |
| `20261106130310` wheel_player_count_eligibility; `20261106130416` real_player_profiles_and_free_titles; `20261106130530` avatar_storage_owner_read_policy; `20261106130618` profile_equipped_title_index; `20261106130702` message_policy_and_room_fk_performance; `20261106130852` leaderboard_profile_presentation_fields; `20261106130935` disable_legacy_client_room_state_rpc; `20261106131029` wheel_rotation_legacy_ui_compatibility | `supabase-wheel-player-eligibility-migration.sql`; `supabase-real-player-profiles-migration.sql`; `supabase-avatar-storage-read-policy.sql`; `supabase-profile-title-index.sql`; `supabase-message-policy-performance-migration.sql`; `supabase-player-leaderboard-profile-fields.sql`; `supabase-disable-legacy-client-room-writes.sql`; `supabase-wheel-legacy-ui-compatibility.sql` | Commit `2cb2d420f152b455d1fb842bfa04f23a3cd62733` introduced several related profile/wheel assets together. | Related source family; several files were committed together after the recorded migration timestamps. |
| `20261106132303` social_message_edits_notifications_invites_presence; `20261106132305` ai_public_chat_replies_and_usage_limits; `20261106132525` social_notification_and_invite_fk_indexes; `20261106132537` atomic_ai_hourly_rate_limit | `supabase-social-notifications-edits-migration.sql`; `supabase-ai-assistant-migration.sql`; `supabase-ai-usage-and-private-typing-migration.sql` | Commit `c3293b5add809771f3e0e512d7da727a67c5e6f0`; usage/typing changes also appear in `126b1222a80fc3e3236213900991df57faa5c424` and `03431acef8b79da9c3aa9d2848368374247cc011`. | Candidate source family; multi-feature files may overlap several remote versions. |
| `20261106135628` add_sender_message_delete_policies | `supabase-message-delete-for-everyone-migration.sql` | Commit `07d5b626f9428738d1d1c1891be30ee5252f6ab4` | Strong feature match; exact applied SQL still not independently proven. |
| `20261106190357` multiplayer_party_features_foundation; `20261106190624` fix_tournament_rls_and_secure_party_feature_rpcs; `20261106190657` party_features_authoritative_actions; `20261106190712` enable_room_reaction_realtime_and_finish_feature_indexes; `20261106190743` tighten_party_feature_rpc_privileges_and_indexes; `20261106190802` tournament_round_lifecycle_and_scoring; `20261106190807` tournament_round_start_authorization; `20261106190827` tournament_score_winner_fallback_and_validation; `20261106190919` realtime_tournament_updates_and_surprise_turn_effect; `20261106190936` apply_double_points_surprise_to_scoring; `20261106190946` clear_round_surprise_on_next_round; `20261106192011` friend_room_tournaments; `20261106192018` table_flip_and_secret_missions; `20261106192023` private_room_reactions; `20261106192030` custom_room_rules_and_timers; `20261106192201` revoke_tournament_table_mutation_privileges | `supabase-tournaments-migration.sql`; `supabase-reactions-migration.sql`; `supabase-table-flip-migration.sql`; `supabase-custom-rules-migration.sql`; `supabase-tournament-read-only-grants-migration.sql` | Commits `04dc1ed98198c001c6a8dc3c083f90782914a682`, `25f96fdbfb83849613b40e390d89d105d926ee1a`, and `1b80facd1cd41db676f04d6a567ae5108d8bd869`. | Related source family; large RPC snapshots are cumulative and replace shared function bodies. |
| `20261106220846` add_private_member_presence_controls; `20261106220951` backfill_member_presence_preferences | `supabase-member-presence-migration.sql`; `supabase-member-presence-privacy-hardening.sql` | Commit `8be149ce7db15ac2ead83af5d9ae5797b1bea37d` | Candidate source family; exact per-version SQL is not separately preserved. |
| `20261106231613` realistic_snakes_domino_uno_rules_v1 | `supabase-realistic-snakes-domino-uno-migration.sql` | Commit `e9ecd78b5d65b3036d6602c02266c8db8b25baff` | Strong feature match; large function snapshot is not proven byte-identical to the executed version. |

### Source conclusion

- Two missing-source problems are specifically unresolved: `20261102065010` and `20261102195301`.
- The other entries have candidate SQL files and relevant Git provenance, but the repository does not currently preserve an independently verified exact SQL artifact for every production version.
- The original `20261107162000` and `20261107162004` migration files were restored from immutable PR #50 head `728edac9fa05a6ce7ccfc4b0220d408a9ae9dd44`, preserving their original blob IDs. These are stronger provenance than the later root-level candidates.
- The source for `20261107162001` had deployed function bodies checked against production; this does not certify every statement of every historical migration.

## 3. Why the existing schema file cannot be the baseline

The current `supabase-schema.sql` is a useful early application bootstrap, not a complete production schema snapshot.

Read-only comparison on 2026-11-09:
- Production has **33 public tables**.
- `supabase-schema.sql` creates only **6** of those tables.
- **27 production tables are absent** from that file, including progression, private engine state, profile titles, notifications, AI, party/tournament, and presence tables.
- Production catalog inventory across application schemas `public` and `private`: **59 functions, 42 RLS policies, 96 indexes, 15 non-internal triggers, and 1 view**.
- All 33 production public tables have RLS enabled.

Therefore, do not run `supabase-schema.sql` alone and call that a clean rebuild. Do not fill the missing objects with guessed placeholder migrations.

## 4. Approved-safe alternative: a production schema-only baseline

Use a **read-only schema-only export of production** as a new bootstrap reference, instead of trying to reconstruct the unavailable historical SQL one migration at a time.

Baseline requirements:
1. Export DDL only from the live production database at a recorded UTC cutoff. Include application-owned `public` and `private` objects, their tables, constraints, indexes, views, functions, triggers, RLS policies, grants, and required extension declarations. Capture the app-owned Storage policy separately if the dump tool excludes Supabase-managed `storage` objects.
2. Exclude all row data: Auth users/sessions/tokens, messages, rooms, scores, AI usage, secrets, and user uploads. Never include a service-role key, database password, JWT secret, or Vault secret.
3. Store the export as a **bootstrap snapshot outside the historical migration directory**, with its SHA-256, export time, production project ref, PostgreSQL version, and a human-readable object manifest. Preserve all current migration ledger rows unchanged.
4. Verify the snapshot manifest against production's read-only counts above, plus key table columns, constraints, RLS policy definitions, and function signatures/definitions. A count-only check is necessary but not sufficient.
5. Load that snapshot into a disposable PostgreSQL 17.11/Supabase-compatible environment. The current GitHub Actions PostgreSQL 17 container can host SQL smoke tests, but Supabase Auth/Storage/Realtime dependencies must be supplied by a local Supabase stack or explicit test fixtures; a plain empty PostgreSQL container is not an equivalent Supabase environment.
6. Apply only the four branch migrations not present in production, in timestamp order:
   - `20261107190000_domino_choose_chain_end.sql`
   - `20261107230000_variable_snakes_ladders_layout.sql`
   - `20261108100000_authoritative_room_engine_wrapper_reconciled.sql`
   - `20261108130000_restrict_private_helper_execute_acl.sql`
7. Do **not** re-apply `20261109002744` or `20261109003703` on top of this baseline; both ACL actions are already represented in the production snapshot. Do not delete, rewrite, or repair the live migration ledger.
8. Run the complete `scripts/test-authoritative-room-engines.sql`, the private-function ACL test, the client-table ACL test, and the local game-rule tests against the disposable rebuilt environment. Then compare the resulting schema and permissions to the expected post-migration manifest.
9. Only after these tests pass, proceed to two-device online play, then real-phone/PWA update and offline-cache checks. Those are separate acceptance gates, not implied by SQL/CI success.

This approach reproduces the **current production schema plus the pending branch delta**. It does not claim to recreate the exact historical execution of all 54 migrations; unavailable historical source files remain archived as a provenance gap.

## 5. Current gates and non-actions

- CI #1166 passed on commit `6545ffbbb012cfb946029ede4796561abafb23e2`. Its PostgreSQL migration-chain step is a selected synthetic chain, not a replay of all 54 production ledger entries.
- PR #54 and PR #55 remain open drafts; neither is merged.
- No production migration, schema, table data, RLS policy, Auth setting, Edge Function, or deployment was changed as part of this audit update.
- No Supabase development branch was created for this work. The baseline export has not yet been produced, so the full clean-room baseline replay and full engine smoke test are **not yet run**.
- The next hard blocker is obtaining the schema-only DDL export through an authorized database-dump path. The available Supabase connector exposes read-only catalog/query operations, but it does not expose a `pg_dump`/schema-export action or the production database password. Do not attempt to extract files from the database server via SQL, and do not put credentials in GitHub code or chat.

## 6. Final release rule

No `db push`, migration repair, production replay, PR merge, or public deployment until the schema-only baseline has been captured, rebuilt in a disposable environment, and passed the complete engine and ACL tests. Two-device and physical-device/PWA testing must follow before release.
