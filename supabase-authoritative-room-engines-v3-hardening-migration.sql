-- Restrict the trigger-only progression function from direct RPC execution.
revoke all on function public.award_authoritative_v3_progress() from public,anon,authenticated;
