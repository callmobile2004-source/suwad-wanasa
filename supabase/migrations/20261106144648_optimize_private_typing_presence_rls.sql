
drop policy if exists "friends can publish private chat typing presence" on realtime.messages;
create policy "friends can publish private chat typing presence"
on realtime.messages
for insert
to authenticated
with check (
  extension = 'presence'
  and split_part(realtime.topic(), ':', 1) = 'dm-typing'
  and (select auth.uid())::text = any(array[
    split_part(realtime.topic(), ':', 2),
    split_part(realtime.topic(), ':', 3)
  ])
  and case
    when split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
     and split_part(realtime.topic(), ':', 3) ~* '^[0-9a-f-]{36}$'
    then private.are_friends(
      (select auth.uid()),
      case
        when (select auth.uid())::text = split_part(realtime.topic(), ':', 2)
          then split_part(realtime.topic(), ':', 3)::uuid
        else split_part(realtime.topic(), ':', 2)::uuid
      end
    )
    else false
  end
);

drop policy if exists "friends can receive private chat typing presence" on realtime.messages;
create policy "friends can receive private chat typing presence"
on realtime.messages
for select
to authenticated
using (
  extension = 'presence'
  and split_part(realtime.topic(), ':', 1) = 'dm-typing'
  and (select auth.uid())::text = any(array[
    split_part(realtime.topic(), ':', 2),
    split_part(realtime.topic(), ':', 3)
  ])
  and case
    when split_part(realtime.topic(), ':', 2) ~* '^[0-9a-f-]{36}$'
     and split_part(realtime.topic(), ':', 3) ~* '^[0-9a-f-]{36}$'
    then private.are_friends(
      (select auth.uid()),
      case
        when (select auth.uid())::text = split_part(realtime.topic(), ':', 2)
          then split_part(realtime.topic(), ':', 3)::uuid
        else split_part(realtime.topic(), ':', 2)::uuid
      end
    )
    else false
  end
);
