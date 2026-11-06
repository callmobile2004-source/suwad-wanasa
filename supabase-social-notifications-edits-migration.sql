-- Additive social features for Suwad Wanasa.
-- Safe to apply after the existing profile/chat/room migrations.
-- No existing rows are deleted or rewritten.

begin;

alter table public.public_messages
  add column if not exists edited_at timestamptz;

alter table public.messages
  add column if not exists edited_at timestamptz;

create or replace function private.stamp_social_message_edit()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := clock_timestamp();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

drop trigger if exists public_messages_stamp_edit on public.public_messages;
create trigger public_messages_stamp_edit
before update of body on public.public_messages
for each row execute function private.stamp_social_message_edit();

drop trigger if exists messages_stamp_edit on public.messages;
create trigger messages_stamp_edit
before update of body on public.messages
for each row execute function private.stamp_social_message_edit();

-- Column-level grants prevent clients from changing sender/recipient/timestamps.
revoke update on public.public_messages from anon, authenticated;
grant update (body) on public.public_messages to authenticated;

drop policy if exists "public message sender edits own" on public.public_messages;
create policy "public message sender edits own"
on public.public_messages for update to authenticated
using ((select auth.uid()) = sender_id)
with check ((select auth.uid()) = sender_id);

revoke update on public.messages from anon, authenticated;
grant update (body) on public.messages to authenticated;

drop policy if exists "friends edit own private messages" on public.messages;
create policy "friends edit own private messages"
on public.messages for update to authenticated
using (
  (select auth.uid()) = sender_id
  and private.are_friends(sender_id, receiver_id)
)
with check (
  (select auth.uid()) = sender_id
  and private.are_friends(sender_id, receiver_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null
    check (notification_type in ('friend_request', 'game_invite')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 240),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

create index if not exists notifications_recipient_recent_idx
  on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "players read own notifications" on public.notifications;
create policy "players read own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = recipient_id);

drop policy if exists "players mark own notifications read" on public.notifications;
create policy "players mark own notifications read"
on public.notifications for update to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create table if not exists public.game_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint game_invites_not_self check (sender_id <> receiver_id)
);

create unique index if not exists game_invites_one_pending_per_room_player
  on public.game_invites (room_id, receiver_id)
  where status = 'pending';

create index if not exists game_invites_receiver_recent_idx
  on public.game_invites (receiver_id, created_at desc);

alter table public.game_invites enable row level security;
revoke all on public.game_invites from anon, authenticated;
grant select, insert on public.game_invites to authenticated;
grant update (status, responded_at) on public.game_invites to authenticated;

drop policy if exists "invite participants read invites" on public.game_invites;
create policy "invite participants read invites"
on public.game_invites for select to authenticated
using ((select auth.uid()) in (sender_id, receiver_id));

drop policy if exists "friends invite players to rooms" on public.game_invites;
create policy "friends invite players to rooms"
on public.game_invites for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and private.are_friends(sender_id, receiver_id)
  and exists (
    select 1 from public.game_room_players p
    where p.room_id = game_invites.room_id
      and p.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.game_rooms r
    where r.id = game_invites.room_id
      and r.status in ('waiting', 'playing')
  )
);

drop policy if exists "invite receiver responds" on public.game_invites;
create policy "invite receiver responds"
on public.game_invites for update to authenticated
using ((select auth.uid()) = receiver_id and status = 'pending')
with check (
  (select auth.uid()) = receiver_id
  and status in ('accepted', 'declined')
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) <= 256),
  auth text not null check (char_length(auth) <= 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "players manage own push subscriptions" on public.push_subscriptions;
create policy "players manage own push subscriptions"
on public.push_subscriptions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Trigger-only function: callers cannot invoke it as an RPC.
create or replace function private.create_social_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'friend_requests' then
    insert into public.notifications
      (recipient_id, actor_id, notification_type, title, body, payload)
    values
      (new.receiver_id, new.sender_id, 'friend_request',
       'طلب صداقة جديد', 'وصلك طلب صداقة جديد في سَـوَاد وناسة',
       jsonb_build_object('friend_request_id', new.id));
  elsif tg_table_name = 'game_invites' then
    insert into public.notifications
      (recipient_id, actor_id, notification_type, title, body, payload)
    values
      (new.receiver_id, new.sender_id, 'game_invite',
       'دعوة للعب', 'أحد أصدقائك دعاك للانضمام إلى غرفة لعب',
       jsonb_build_object('game_invite_id', new.id, 'room_id', new.room_id));
  end if;
  return new;
end;
$$;

revoke all on function private.create_social_notification() from public, anon, authenticated;

drop trigger if exists friend_request_notification on public.friend_requests;
create trigger friend_request_notification
after insert on public.friend_requests
for each row execute function private.create_social_notification();

drop trigger if exists game_invite_notification on public.game_invites;
create trigger game_invite_notification
after insert on public.game_invites
for each row execute function private.create_social_notification();

-- Keep notification/invite rows available to Realtime clients.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_invites'
  ) then
    alter publication supabase_realtime add table public.game_invites;
  end if;
end
$$;

commit;
