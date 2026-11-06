-- Targeted query-plan improvements; preserve the existing friendship authorization rules.
begin;

drop policy if exists "friends read messages" on public.messages;
create policy "friends read messages"
on public.messages for select to authenticated
using (
  ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id)
  and private.are_friends(sender_id,receiver_id)
);

drop policy if exists "friends send messages" on public.messages;
create policy "friends send messages"
on public.messages for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and private.are_friends(sender_id,receiver_id)
);

create index if not exists game_room_action_events_actor_id_idx
  on public.game_room_action_events(actor_id);
create index if not exists game_room_player_private_state_user_id_idx
  on public.game_room_player_private_state(user_id);

commit;
