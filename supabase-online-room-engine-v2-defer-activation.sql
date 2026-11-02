-- Temporary activation guard for staged rollouts.
-- Keep newly created rooms on legacy engine v1 until all v2 RPCs and the
-- room-engine-v2 Edge Function are deployed. The final all-games migration
-- replaces this function and activates engine_version=2 for every game.
begin;

create or replace function public.create_game_room(
  p_room_code text,
  p_room_name text,
  p_game_key text,
  p_max_players integer,
  p_game_state jsonb,
  p_display_name text
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_min integer;
  v_max integer;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'يلزم تسجيل الدخول.' using errcode='42501';
  end if;

  if p_room_code is null or p_room_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'رمز الغرفة غير صالح.';
  end if;
  if p_room_name is null or char_length(btrim(p_room_name)) not between 1 and 32 then
    raise exception 'اسم الغرفة غير صالح.';
  end if;
  v_name := btrim(coalesce(p_display_name,''));
  if char_length(v_name) not between 2 and 24 then
    raise exception 'اسم اللاعب يجب أن يكون بين حرفين و٢٤ حرفاً.';
  end if;
  if jsonb_typeof(coalesce(p_game_state,'{}'::jsonb)) is distinct from 'object'
     or pg_catalog.pg_column_size(coalesce(p_game_state,'{}'::jsonb)) > 16384 then
    raise exception 'بيانات بداية الغرفة غير صالحة.';
  end if;

  case p_game_key
    when 'who' then v_min:=2; v_max:=12;
    when 'number' then v_min:=2; v_max:=8;
    when 'liar' then v_min:=3; v_max:=16;
    when 'most' then v_min:=2; v_max:=12;
    when 'yesno' then v_min:=2; v_max:=12;
    when 'snakes' then v_min:=2; v_max:=6;
    when 'domino' then v_min:=2; v_max:=4;
    when 'tavla' then v_min:=2; v_max:=2;
    when 'colors' then v_min:=2; v_max:=8;
    when 'quiz' then v_min:=2; v_max:=12;
    when 'wheel' then v_min:=2; v_max:=16;
    else raise exception 'اللعبة المطلوبة غير معروفة.';
  end case;

  if p_max_players is null or p_max_players not between v_min and v_max then
    raise exception 'عدد اللاعبين لا يناسب اللعبة المختارة.';
  end if;

  insert into public.game_rooms(
    room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version
  )
  values(
    upper(p_room_code),btrim(p_room_name),p_game_key,auth.uid(),
    p_max_players,'waiting',coalesce(p_game_state,'{}'::jsonb),1
  )
  returning * into v_room;

  insert into public.game_room_players(room_id,user_id,display_name,seat)
  values(v_room.id,auth.uid(),v_name,0);

  return v_room;
end;
$function$;

revoke all on function public.create_game_room(text,text,text,integer,jsonb,text) from public;
grant execute on function public.create_game_room(text,text,text,integer,jsonb,text) to authenticated;

commit;
