-- Legacy client-authored state RPC is no longer needed: all active rooms use server engines,
-- and remaining V1 rooms are waiting/finished and upgrade through the room-engine gateway.
revoke all on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz)
  from public,anon,authenticated;
