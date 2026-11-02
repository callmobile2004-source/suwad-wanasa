-- Apply once in Supabase SQL Editor.
-- Preserves remaining players, stops a shared wheel spin, and transfers room ownership when the host leaves.
create or replace function public.leave_game_room(p_room_id uuid)
returns void
language plpgsql security definer
set search_path=''
as $wheel_exit$
declare
 v_room public.game_rooms;
 v_next_host uuid;
begin
 if auth.uid() is null then raise exception 'يلزم تسجيل الدخول.' using errcode='42501'; end if;
 select * into v_room from public.game_rooms where id=p_room_id for update;
 if not found then return; end if;
 if not public.is_game_room_member(p_room_id) then raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501'; end if;

 if v_room.host_id=auth.uid() then
   -- Keep remaining players in the room and transfer host ownership to the next seated player.
   select user_id into v_next_host
   from public.game_room_players
   where room_id=p_room_id and user_id<>auth.uid()
   order by seat asc
   limit 1;

   update public.game_rooms
   set host_id=coalesce(v_next_host,host_id),
       status=case when v_next_host is null then 'finished' else status end,
       game_state=case
         when game_key='wheel' then
           jsonb_set(
             jsonb_set(
               jsonb_set(
                 jsonb_set(coalesce(game_state,'{}'::jsonb),'{board,spinning}','false'::jsonb,true),
                 '{board,result}','null'::jsonb,true),
               '{board,stage}','"arena"'::jsonb,true),
             '{board,rotation}',coalesce(game_state#>'{board,startRotation}',game_state#>'{board,rotation}','0'::jsonb),true)
         else game_state
       end,
       updated_at=pg_catalog.now()
   where id=p_room_id;
 end if;

 delete from public.game_room_players
 where room_id=p_room_id and user_id=auth.uid();
end;
$wheel_exit$;
