-- Allow a sender to remove their own message for all participants.
-- RLS ensures that neither chat can be used to delete another member's message.
grant delete on table public.public_messages to authenticated;
grant delete on table public.messages to authenticated;

drop policy if exists "public message sender deletes own" on public.public_messages;
create policy "public message sender deletes own"
on public.public_messages
for delete
to authenticated
using ((select auth.uid()) = sender_id);

drop policy if exists "friends delete own private messages" on public.messages;
create policy "friends delete own private messages"
on public.messages
for delete
to authenticated
using (
  (select auth.uid()) = sender_id
  and private.are_friends(sender_id, receiver_id)
);
