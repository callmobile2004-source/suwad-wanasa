CREATE OR REPLACE FUNCTION public.award_authoritative_v3_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event record; v_player record; v_inserted integer; v_games integer;
  v_winner uuid; v_hand jsonb; v_player_count integer;
  v_valid_count integer; v_key_count integer; v_board jsonb; v_answer_key text;
begin
  if old.status is distinct from 'playing' or new.status is distinct from 'finished'
     or new.engine_version<>3 or new.game_state->>'phase' is distinct from 'finished' then return new; end if;
  select e.actor_id,e.event_payload into v_event from public.game_room_action_events e
  where e.room_id=new.id and e.action='game-finished' order by e.id desc limit 1;
  if not found then return new; end if;
  v_board:=new.game_state->'board';
  v_winner:=nullif(v_event.event_payload->>'winner_id','')::uuid;
  if new.game_key='snakes' then
    if v_winner is null or v_winner::text is distinct from v_board->>'winner_id'
       or coalesce((v_board->'positions'->(v_board->>'finished')::integer)::text,'')<>'100' then return new; end if;
  elsif new.game_key='tavla' then
    if v_winner is null or v_winner::text is distinct from v_board->>'winner_id'
       or not exists(select 1 from public.game_room_players p where p.room_id=new.id
         and p.user_id=v_winner and coalesce((v_board->'off'->>p.seat)::integer,0)>=15) then return new; end if;
  elsif new.game_key in ('domino','colors') then
    if v_winner is null or v_winner::text is distinct from v_board->>'winner_id' then return new; end if;
    select ps.private_state->'hand' into v_hand from public.game_room_player_private_state ps
    where ps.room_id=new.id and ps.user_id=v_winner;
    if v_hand is null or jsonb_typeof(v_hand)<>'array' or jsonb_array_length(v_hand)<>0 then return new; end if;
  elsif new.game_key='quiz' then
    if v_event.event_payload->>'completed' is distinct from 'true' then return new; end if;
  elsif new.game_key in ('who','most','yesno','liar') then
    if v_event.event_payload->>'completed' is distinct from 'true' or v_event.actor_id is distinct from new.host_id then return new; end if;
    select count(*)::integer into v_player_count from public.game_room_players p where p.room_id=new.id;
    if v_player_count<2 or coalesce((v_event.event_payload->>'participant_count')::integer,-1)<>v_player_count then return new; end if;
    if new.game_key='who' then v_answer_key:='guesses';
    elsif new.game_key='most' then v_answer_key:='votes';
    elsif new.game_key='yesno' then v_answer_key:='answers';
    else
      if v_board->>'stage' is distinct from 'votes' then return new; end if;
      select count(*)::integer into v_valid_count from public.game_room_players p
      where p.room_id=new.id and coalesce(v_board->'hints','{}'::jsonb) ? p.user_id::text;
      select count(*)::integer into v_key_count from jsonb_object_keys(coalesce(v_board->'hints','{}'::jsonb));
      if v_valid_count<>v_player_count or v_key_count<>v_player_count then return new; end if;
      v_answer_key:='votes';
    end if;
    select count(*)::integer into v_valid_count from public.game_room_players p
    where p.room_id=new.id and coalesce(v_board->v_answer_key,'{}'::jsonb) ? p.user_id::text;
    select count(*)::integer into v_key_count from jsonb_object_keys(coalesce(v_board->v_answer_key,'{}'::jsonb));
    if v_valid_count<>v_player_count or v_key_count<>v_player_count then return new; end if;
  else return new;
  end if;
  for v_player in select p.user_id from public.game_room_players p where p.room_id=new.id loop
    insert into public.player_game_history(room_id,user_id,game_key,xp_awarded)
    values(new.id,v_player.user_id,new.game_key,10) on conflict(room_id,user_id) do nothing;
    get diagnostics v_inserted=row_count;
    if v_inserted=1 then
      insert into public.player_progress(user_id,xp,games_completed,updated_at) values(v_player.user_id,10,1,pg_catalog.now())
      on conflict(user_id) do update set xp=public.player_progress.xp+10,
        games_completed=public.player_progress.games_completed+1,updated_at=pg_catalog.now()
      returning games_completed into v_games;
      insert into public.player_achievements(user_id,achievement_id)
      select v_player.user_id,a.id from public.achievements a where a.requirement_games<=v_games
      on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;
  return new;
end;
$function$


CREATE OR REPLACE FUNCTION public.engine_v3_finish_social_game(p_room_id uuid, p_actor_id uuid, p_expected_updated_at timestamp with time zone)
 RETURNS game_rooms
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_room public.game_rooms; v_state jsonb; v_board jsonb; v_game text;
  v_player_count integer; v_valid_count integer; v_key_count integer;
  v_answer_key text; v_event_payload jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_room_id is null or p_actor_id is null or p_expected_updated_at is null then
    raise exception 'بيانات إنهاء اللعبة غير صالحة.' using errcode='22023';
  end if;
  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if v_room.host_id is distinct from p_actor_id then
    raise exception 'إنهاء المباراة من صلاحية المضيف فقط.' using errcode='42501';
  end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>3 or v_room.status<>'playing' or v_room.game_state->>'phase' is distinct from 'playing' then
    raise exception 'حالة اللعبة لا تسمح بإنهائها حالياً.' using errcode='55000';
  end if;
  v_game:=v_room.game_key;
  if v_game not in ('who','most','yesno','liar') then
    raise exception 'هذه اللعبة لا تستخدم مسار الإنهاء الاجتماعي.' using errcode='22023';
  end if;
  select count(*)::integer into v_player_count from public.game_room_players p where p.room_id=p_room_id;
  if v_player_count < (case when v_game='liar' then 3 else 2 end) then
    raise exception 'عدد اللاعبين غير كافٍ لإكمال المباراة.' using errcode='55000';
  end if;
  v_state:=v_room.game_state; v_board:=coalesce(v_state->'board','{}'::jsonb);
  if v_game='who' then v_answer_key:='guesses';
  elsif v_game='most' then v_answer_key:='votes';
  elsif v_game='yesno' then v_answer_key:='answers';
  else
    if v_board->>'stage' is distinct from 'votes' then
      raise exception 'لازم تكتمل التلميحات وتبدأ مرحلة التصويت أولاً.' using errcode='55000';
    end if;
    select count(*)::integer into v_valid_count from public.game_room_players p
    where p.room_id=p_room_id and coalesce(v_board->'hints','{}'::jsonb) ? p.user_id::text;
    select count(*)::integer into v_key_count from jsonb_object_keys(coalesce(v_board->'hints','{}'::jsonb));
    if v_valid_count<>v_player_count or v_key_count<>v_player_count then
      raise exception 'ما اكتملت تلميحات جميع اللاعبين.' using errcode='55000';
    end if;
    v_answer_key:='votes';
  end if;
  select count(*)::integer into v_valid_count from public.game_room_players p
  where p.room_id=p_room_id and coalesce(v_board->v_answer_key,'{}'::jsonb) ? p.user_id::text;
  select count(*)::integer into v_key_count from jsonb_object_keys(coalesce(v_board->v_answer_key,'{}'::jsonb));
  if v_valid_count<>v_player_count or v_key_count<>v_player_count then
    raise exception 'ما اكتملت إجابات أو تصويت جميع اللاعبين.' using errcode='55000';
  end if;
  v_event_payload:=jsonb_build_object('completed',true,'participant_count',v_player_count,'reason','all_players_submitted');
  insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
  values(p_room_id,p_actor_id,v_game,'game-finished',v_event_payload);
  v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
  v_state:=jsonb_set(v_state,'{feed}',coalesce(v_state->'feed','[]'::jsonb)||
    jsonb_build_array('انتهت المباراة بعد مشاركة جميع اللاعبين.'),true);
  update public.game_rooms set game_state=v_state,status='finished',updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  return v_room;
end;
$function$


revoke all on function public.engine_v3_finish_social_game(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.engine_v3_finish_social_game(uuid,uuid,timestamptz) to service_role;
