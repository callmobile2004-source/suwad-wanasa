-- Private Broadcast authorization for transient in-room reactions.
-- Existing direct-message typing Presence policies are intentionally untouched.
DROP POLICY IF EXISTS suwad_room_reactions_receive ON realtime.messages;
CREATE POLICY suwad_room_reactions_receive
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension='broadcast'
  AND CASE
    WHEN coalesce(realtime.topic(),'') ~ '^suwad-room-reactions:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    THEN private.is_game_room_member(split_part(realtime.topic(),':',2)::uuid)
    ELSE false
  END
);

DROP POLICY IF EXISTS suwad_room_reactions_send ON realtime.messages;
CREATE POLICY suwad_room_reactions_send
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension='broadcast'
  AND CASE
    WHEN coalesce(realtime.topic(),'') ~ '^suwad-room-reactions:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    THEN private.is_game_room_member(split_part(realtime.topic(),':',2)::uuid)
    ELSE false
  END
);
