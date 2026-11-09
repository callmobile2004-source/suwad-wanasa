# Migration History Audit — Suwad Wanasa

Audit date: 2026-11-09 (UTC). Scope: production Supabase project `nswalgakanjtfvluuola`, repository branch `feat/all-games-deliberate-motion`.

## Executive result

- Production records **53 applied migrations**. The pre-audit count was 52; the new client-table ACL migration was applied as `20261109002744`, bringing the total to 53.
- The branch contains **14 timestamped SQL files** under `supabase/migrations`; **10** have a matching applied remote version.
- **43 applied remote versions do not have a matching timestamped migration file** in the branch.
- The branch also contains **33 root-level SQL snapshots**. Several are strong semantic candidates for old changes, but many are cumulative/later snapshots and overlap several remote versions. They are not treated as byte-for-byte historical sources.
- **A clean from-zero replay of the complete 53-migration history is not yet proven.** The full sequence must remain blocked until every missing version has an exact source or a separately reviewed, tested baseline/reconciliation plan.

## Safe decisions

1. Do not invent placeholder migrations or duplicate a later snapshot under multiple historical timestamps.
2. Do not run `supabase db push`, `migration repair`, or reapply historical SQL against production as a way to silence drift.
3. Keep the four unapplied branch migrations separate from the production history:
   - `20261107190000_domino_choose_chain_end.sql`
   - `20261107230000_variable_snakes_ladders_layout.sql`
   - `20261108100000_authoritative_room_engine_wrapper_reconciled.sql`
   - `20261108130000_restrict_private_helper_execute_acl.sql`
4. Use a disposable PostgreSQL 17 database for replay tests. A Supabase production branch was not created; branch creation can incur cost and was not necessary for the ACL fix.

## Source-provenance notes

- The original `20261107162000` and `20261107162004` files were restored from immutable PR #50 head `728edac9fa05a6ce7ccfc4b0220d408a9ae9dd44` with their original blob IDs preserved.
- The deployed Tavla function implementations corresponding to `20261107162001` were checked against the recovered source; this does not prove every historical statement in every earlier migration.
- Root-level files such as `supabase-authoritative-number-engine-migration.sql`, `supabase-authoritative-room-engines-v3-migration.sql`, `supabase-social-notifications-edits-migration.sql`, and `supabase-tournaments-migration.sql` are useful source candidates. Git commit dates and content do not by themselves prove that their present contents are identical to the SQL executed under a particular remote version.
- `supabase-schema.sql` is a baseline/setup snapshot, not a substitute for each individual historical migration.
- Versions `20261102065010` and `20261102195301` remain specifically unresolved: no unique source file has been established.

## Production migration inventory

| Version | Recorded remote name | Audit status | Source / provenance |
|---|---|---|---|
| `20261102053601` | `player_progression_system` | no matching timestamped file | supabase-progression-migration.sql — progression tables/functions (candidate; not independently exact) |
| `20261102053800` | `player_achievements_lookup_index` | no matching timestamped file | supabase-progression-migration.sql — achievement lookup indexes (candidate) |
| `20261102053956` | `harden_progression_result_validation` | no matching timestamped file | supabase-progression-hardening-migration.sql — progression award hardening (candidate) |
| `20261102065010` | `database_security_performance_hardening` | no matching timestamped file | UNRESOLVED — no uniquely attributable source among the root snapshots; supabase-schema.sql is a baseline, not a timestamped migration |
| `20261102195301` | `room_engine_preflight_archive` | no matching timestamped file | UNRESOLVED — original room-engine preflight/archive migration source not found |
| `20261102195320` | `online_room_hardening_phase1` | no matching timestamped file | supabase-room-security-migration.sql — room/friend RPC and RLS hardening (candidate; commit history differs from remote timestamp) |
| `20261102195344` | `online_engine_v2_number` | no matching timestamped file | supabase-authoritative-number-engine-migration.sql — number-engine v2 (candidate) |
| `20261102204417` | `authoritative_number_engine_hardening` | no matching timestamped file | supabase-authoritative-number-engine-migration.sql — number-engine hardening (candidate; may overlap preceding migration) |
| `20261102211009` | `authoritative_room_engines_v3` | no matching timestamped file | supabase-authoritative-room-engines-v3-migration.sql — authoritative v3 engine (candidate; later snapshot) |
| `20261102211101` | `authoritative_room_engines_v3_progress_acl` | no matching timestamped file | supabase-authoritative-room-engines-v3-hardening-migration.sql — progress function ACL (candidate) |
| `20261102211654` | `authoritative_room_engines_v3_corrective` | no matching timestamped file | supabase-authoritative-room-engines-v3-corrective-migration.sql — corrective v3 wrapper (candidate) |
| `20261106130310` | `wheel_player_count_eligibility` | no matching timestamped file | supabase-wheel-player-eligibility-migration.sql — player-count eligibility (candidate) |
| `20261106130416` | `real_player_profiles_and_free_titles` | no matching timestamped file | supabase-real-player-profiles-migration.sql — real profiles and free titles (candidate) |
| `20261106130530` | `avatar_storage_owner_read_policy` | no matching timestamped file | supabase-avatar-storage-read-policy.sql — avatar read policy (candidate) |
| `20261106130618` | `profile_equipped_title_index` | no matching timestamped file | supabase-profile-title-index.sql — profile equipped-title index (candidate) |
| `20261106130702` | `message_policy_and_room_fk_performance` | no matching timestamped file | supabase-message-policy-performance-migration.sql — message policies and FK indexes (candidate) |
| `20261106130852` | `leaderboard_profile_presentation_fields` | no matching timestamped file | supabase-player-leaderboard-profile-fields.sql — leaderboard presentation fields (candidate) |
| `20261106130935` | `disable_legacy_client_room_state_rpc` | no matching timestamped file | supabase-disable-legacy-client-room-writes.sql — disable legacy room-state RPC (candidate) |
| `20261106131029` | `wheel_rotation_legacy_ui_compatibility` | no matching timestamped file | supabase-wheel-legacy-ui-compatibility.sql — legacy wheel geometry/contract (candidate) |
| `20261106132303` | `social_message_edits_notifications_invites_presence` | no matching timestamped file | supabase-social-notifications-edits-migration.sql — social edits, notifications, invites, presence (candidate) |
| `20261106132305` | `ai_public_chat_replies_and_usage_limits` | no matching timestamped file | supabase-ai-assistant-migration.sql — public-chat AI replies and usage control (candidate) |
| `20261106132525` | `social_notification_and_invite_fk_indexes` | no matching timestamped file | supabase-social-notifications-edits-migration.sql — notification/invite indexes (candidate) |
| `20261106132537` | `atomic_ai_hourly_rate_limit` | no matching timestamped file | supabase-ai-assistant-migration.sql and supabase-ai-usage-and-private-typing-migration.sql — AI rate limit/grants (candidate bundle) |
| `20261106135628` | `add_sender_message_delete_policies` | no matching timestamped file | supabase-message-delete-for-everyone-migration.sql — sender delete policies (candidate) |
| `20261106144222` | `secure_social_game_completion_and_xp` | timestamped path exists; remote version is applied | supabase/migrations/20261106144222_secure_social_game_completion_and_xp.sql (source file present; whole-file equivalence to production not assumed) |
| `20261106144405` | `require_earned_title_to_equip` | timestamped path exists; remote version is applied | supabase/migrations/20261106144405_require_earned_title_to_equip.sql (source file present; whole-file equivalence to production not assumed) |
| `20261106144648` | `optimize_private_typing_presence_rls` | timestamped path exists; remote version is applied | supabase/migrations/20261106144648_optimize_private_typing_presence_rls.sql (source file present; whole-file equivalence to production not assumed) |
| `20261106190357` | `multiplayer_party_features_foundation` | no matching timestamped file | supabase-schema.sql + supabase-tournaments-migration.sql + supabase-reactions-migration.sql — party foundation candidates; exact source unresolved |
| `20261106190624` | `fix_tournament_rls_and_secure_party_feature_rpcs` | no matching timestamped file | supabase-tournaments-migration.sql + supabase-tournament-read-only-grants-migration.sql — tournament RLS/RPC permissions (candidate bundle) |
| `20261106190657` | `party_features_authoritative_actions` | no matching timestamped file | supabase-custom-rules-migration.sql + supabase-table-flip-migration.sql — authoritative party actions (candidate bundle) |
| `20261106190712` | `enable_room_reaction_realtime_and_finish_feature_indexes` | no matching timestamped file | supabase-reactions-migration.sql — private room reaction policies (candidate) |
| `20261106190743` | `tighten_party_feature_rpc_privileges_and_indexes` | no matching timestamped file | supabase-tournament-read-only-grants-migration.sql + supabase-custom-rules-migration.sql — party RPC grants/indexes (candidate bundle) |
| `20261106190802` | `tournament_round_lifecycle_and_scoring` | no matching timestamped file | supabase-tournaments-migration.sql — tournament lifecycle/scoring (candidate; later snapshot) |
| `20261106190807` | `tournament_round_start_authorization` | no matching timestamped file | supabase-tournaments-migration.sql — round-start authorization (candidate) |
| `20261106190827` | `tournament_score_winner_fallback_and_validation` | no matching timestamped file | supabase-tournaments-migration.sql — winner/score validation (candidate) |
| `20261106190919` | `realtime_tournament_updates_and_surprise_turn_effect` | no matching timestamped file | supabase-tournaments-migration.sql + supabase-custom-rules-migration.sql — realtime/surprise effects (candidate bundle) |
| `20261106190936` | `apply_double_points_surprise_to_scoring` | no matching timestamped file | supabase-custom-rules-migration.sql — double-points surprise scoring (candidate) |
| `20261106190946` | `clear_round_surprise_on_next_round` | no matching timestamped file | supabase-custom-rules-migration.sql — clear surprise on next round (candidate) |
| `20261106192011` | `friend_room_tournaments` | no matching timestamped file | supabase-tournaments-migration.sql — friend-room tournaments (candidate) |
| `20261106192018` | `table_flip_and_secret_missions` | no matching timestamped file | supabase-table-flip-migration.sql — table-flip and secret missions (candidate) |
| `20261106192023` | `private_room_reactions` | no matching timestamped file | supabase-reactions-migration.sql — private room reactions (candidate) |
| `20261106192030` | `custom_room_rules_and_timers` | no matching timestamped file | supabase-custom-rules-migration.sql — custom room rules/timers (candidate; later snapshot) |
| `20261106192127` | `index_tournament_foreign_key_columns` | timestamped path exists; remote version is applied | supabase/migrations/20261106192127_index_tournament_foreign_key_columns.sql (source file present; whole-file equivalence to production not assumed) |
| `20261106192201` | `revoke_tournament_table_mutation_privileges` | no matching timestamped file | supabase-tournament-read-only-grants-migration.sql — tournament read-only grants (candidate) |
| `20261106220846` | `add_private_member_presence_controls` | no matching timestamped file | supabase-member-presence-migration.sql — privacy-aware presence controls (candidate) |
| `20261106220951` | `backfill_member_presence_preferences` | no matching timestamped file | supabase-member-presence-migration.sql + supabase-member-presence-privacy-hardening.sql — presence preference backfill/privacy (candidate bundle) |
| `20261106231613` | `realistic_snakes_domino_uno_rules_v1` | no matching timestamped file | supabase-realistic-snakes-domino-uno-migration.sql — realistic Snakes/Domino/UNO rules (candidate; later snapshot) |
| `20261107162000` | `snakes_and_ladders_rules_v2` | timestamped path exists; remote version is applied | supabase/migrations/20261107162000_snakes_and_ladders_rules_v2.sql — recovered from immutable PR #50 head; blob 21ab56f34d571ad11d5258298de74c71f874ba90 |
| `20261107162001` | `tavla_maximum_dice_rules` | timestamped path exists; remote version is applied | supabase/migrations/20261107162001_tavla_maximum_dice_rules.sql — deployed Tavla function bodies verified against production |
| `20261107162004` | `domino_opening_draw_pass_rules` | timestamped path exists; remote version is applied | supabase/migrations/20261107162004_domino_opening_draw_pass_rules.sql — recovered from immutable PR #50 head; blob 727239852492dd39ba8a9da0451a5a309d21698a |
| `20261107162006` | `authoritative_chess_engine` | timestamped path exists; remote version is applied | supabase/migrations/20261107162006_authoritative_chess_engine.sql (source file present; whole-file equivalence to production not assumed) |
| `20261107165746` | `restrict_profile_discovery_columns` | timestamped path exists; remote version is applied | supabase/migrations/20261107165746_restrict_profile_discovery_columns.sql (source file present; whole-file equivalence to production not assumed) |
| `20261109002744` | `restrict_client_table_admin_privileges` | timestamped path exists; remote version is applied | supabase/migrations/20261109002744_restrict_client_table_admin_privileges.sql — applied to production; blob 3a2c2292226b120aaa2e39424f7512b595e3c70f |

## Root-level SQL inventory (not timestamped migration files)

- `supabase-ai-assistant-migration.sql`
- `supabase-ai-usage-and-private-typing-migration.sql`
- `supabase-authoritative-number-engine-migration.sql`
- `supabase-authoritative-room-engines-v3-corrective-migration.sql`
- `supabase-authoritative-room-engines-v3-hardening-migration.sql`
- `supabase-authoritative-room-engines-v3-migration.sql`
- `supabase-avatar-storage-read-policy.sql`
- `supabase-custom-rules-migration.sql`
- `supabase-disable-legacy-client-room-writes.sql`
- `supabase-member-presence-migration.sql`
- `supabase-member-presence-privacy-hardening.sql`
- `supabase-message-delete-for-everyone-migration.sql`
- `supabase-message-policy-performance-migration.sql`
- `supabase-player-leaderboard-profile-fields.sql`
- `supabase-private-ai-lab-migration.sql`
- `supabase-profile-name-migration.sql`
- `supabase-profile-title-index.sql`
- `supabase-progression-hardening-migration.sql`
- `supabase-progression-migration.sql`
- `supabase-public-chat-migration.sql`
- `supabase-reactions-migration.sql`
- `supabase-real-player-profiles-migration.sql`
- `supabase-realistic-snakes-domino-uno-migration.sql`
- `supabase-room-security-migration.sql`
- `supabase-schema.sql`
- `supabase-social-notifications-edits-migration.sql`
- `supabase-table-flip-migration.sql`
- `supabase-tournament-read-only-grants-migration.sql`
- `supabase-tournaments-migration.sql`
- `supabase-wheel-legacy-ui-compatibility.sql`
- `supabase-wheel-migration.sql`
- `supabase-wheel-owner-exit-migration.sql`
- `supabase-wheel-player-eligibility-migration.sql`

## Replay/test status

- GitHub Actions #1164 passed all current PR validation jobs, including the disposable PostgreSQL 17 ACL tests, room migration-chain test, JavaScript validator, Deno type-check, local rules tests, and motion tests.
- The room migration-chain test is a **selected synthetic chain**, not a replay of all 53 production migration versions.
- The full authoritative-room-engine smoke script still has a known environment mismatch against production (old 6/6 Snakes layout vs branch 2–5 layout). It must pass on a disposable database loaded from the complete reviewed migration source set before release.
- Two-device online test, physical-phone test, and offline-cache asset verification remain outstanding.

## Status of table administrative ACL remediation

Applied to production as migration `20261109002744_restrict_client_table_admin_privileges`.

Post-apply read-only checks confirmed:
- `anon`: zero effective `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `MAINTAIN` table privileges across public tables.
- `authenticated`: zero effective privileges of those four administrative types across public tables.
- `service_role`: retained its four administrative privileges on all 33 public tables.
- `authenticated` ordinary SELECT/INSERT/UPDATE/DELETE privileges on the previously affected 13 tables matched their pre-migration state.
- Default privileges for future postgres-owned public tables no longer grant these four administrative privileges to `anon` or `authenticated`.
- RLS remains enabled on all 33 public tables; no table rows, application policies, or Auth settings were changed by this ACL migration.

This ACL remediation is complete and independently verified; the broader historical migration-chain reconstruction remains open.
