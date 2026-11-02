-- Database hardening: restrict trigger-only functions and optimize indexes/RLS.
-- Safe additive changes: no table or row deletion; application behavior is preserved.
begin;

-- These functions are invoked by PostgreSQL triggers/event triggers only.
-- They must not be exposed as callable PostgREST RPC endpoints.
revoke all on function public.enforce_public_chat_rate_limit() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_duplicate_friend_pair() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Cover the foreign keys identified by Supabase's performance advisor.
create index if not exists friend_requests_receiver_id_idx
  on public.friend_requests(receiver_id);
create index if not exists game_room_players_user_id_idx
  on public.game_room_players(user_id);
create index if not exists game_rooms_host_id_idx
  on public.game_rooms(host_id);
create index if not exists messages_sender_id_idx
  on public.messages(sender_id);
create index if not exists messages_receiver_id_idx
  on public.messages(receiver_id);

-- Evaluate auth.uid() once per statement instead of once per candidate row.
drop policy if exists "request sender creates" on public.friend_requests;
create policy "request sender creates" on public.friend_requests
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and sender_id <> receiver_id);

drop policy if exists "request participants read" on public.friend_requests;
create policy "request participants read" on public.friend_requests
  for select to authenticated
  using ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id);

drop policy if exists "receiver responds" on public.friend_requests;
create policy "receiver responds" on public.friend_requests
  for update to authenticated
  using ((select auth.uid()) = receiver_id and status = 'pending')
  with check ((select auth.uid()) = receiver_id and status in ('accepted','declined'));

drop policy if exists "friends read messages" on public.messages;
create policy "friends read messages" on public.messages
  for select to authenticated
  using (
    ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id)
    and public.are_friends(sender_id,receiver_id)
  );

drop policy if exists "friends send messages" on public.messages;
create policy "friends send messages" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id and public.are_friends(sender_id,receiver_id));

drop policy if exists "profile owner updates own" on public.profiles;
create policy "profile owner updates own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "players read own game history" on public.player_game_history;
create policy "players read own game history" on public.player_game_history
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "members send public chat as self" on public.public_messages;
create policy "members send public chat as self" on public.public_messages
  for insert to authenticated
  with check ((select auth.uid()) = sender_id);

commit;
