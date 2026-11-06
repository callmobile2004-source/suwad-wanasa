-- Private AI experiments room.
-- Messages are accessible only to the Edge Function service role.
create table if not exists public.private_ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists private_ai_messages_owner_created_idx
  on public.private_ai_messages (user_id, created_at desc);
alter table public.private_ai_messages enable row level security;
revoke all on table public.private_ai_messages from anon, authenticated;
grant all on table public.private_ai_messages to service_role;

alter table public.ai_request_usage
  drop constraint if exists ai_request_usage_request_kind_check;
alter table public.ai_request_usage
  add constraint ai_request_usage_request_kind_check
  check (request_kind = any (array['public_chat'::text, 'game_help'::text, 'private_chat'::text]));
