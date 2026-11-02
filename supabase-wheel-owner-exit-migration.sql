-- Apply once in Supabase SQL Editor.
-- When a room owner leaves, preserve the room and remaining players by handing host ownership to the next seated player.
create or replace function public.leave_game_room(p_room_id uuid)
returns void
language plpgsql security definer
set search_path=''
as $$
declare
 v_room public.game_rooms;
 v_next_host uuid;
begin
 if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
 select * into v_room from public.game_rooms where id=p_room_id for update;
 if not found then return; end if;
 if not public.is_game_room_member(p_room_id) then raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501'; end if;

 if v_room.host_id=auth.uid() then
   -- Keep the room and its remaining players alive; transfer ownership to the next seated player.
   select user_id into v_next_host
   from public.game_room_players
   where room_id=p_room_id and user_id<>auth.uid()
   order by seat asc
   limit 1;

   if v_next_host is not null then
     update public.game_rooms
     set host_id=v_next_host,
         status=case when status='finished' then 'waiting' else status end,
         updated_at=pg_catalog.now()
     where id=p_room_id;
   else
     update public.game_rooms set status='finished',updated_at=pg_catalog.now() where id=p_room_id;
   end if;
 end if;

 delete from public.game_room_players
 where room_id=p_room_id and user_id=auth.uid();
end;
$$;
