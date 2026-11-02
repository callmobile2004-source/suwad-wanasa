-- Server-authoritative progression for every supported v2 room engine.
-- Apply only after supabase-online-engine-v2-all-games.sql.
-- Awards are sourced exclusively from service-role event records written before
-- the finishing room UPDATE. Player-authored state can never mint XP.
begin;

create or replace function public.award_completed_room_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_player record;
  v_games integer;
  v_inserted integer;
  v_board jsonb;
  v_event record;
  v_secret text;
  v_private jsonb;
  v_completed_questions integer;
  v_player_count integer;
  v_round_start_id bigint;
  v_finish_index integer;
  v_home integer;
begin
  if old.status is distinct from 'playing'
     or new.status is distinct from 'finished'
     or new.engine_version<>2
     or new.game_state->>'phase' is distinct from 'finished'
     or new.game_started_at is null then
    return new;
  end if;

  v_board:=new.game_state->'board';
  if jsonb_typeof(v_board) is distinct from 'object' then
    return new;
  end if;

  select count(*)::integer into v_player_count
  from public.game_room_players p where p.room_id=new.id;
  if v_player_count not between 2 and 16 then
    return new;
  end if;

  -- Restrict all event checks to the current game round. Older completed rounds
  -- in the same room must not make a later abandoned round look completed.
  select coalesce(max(e.id),0)::bigint into v_round_start_id
  from public.game_room_engine_events e
  where e.room_id=new.id
    and e.event_type=any(
      case new.game_key
        when 'number' then array['number_started','number_restarted']
        when 'most' then array['most_started','most_restarted']
        when 'quiz' then array['quiz_started','quiz_restarted']
        when 'yesno' then array['yesno_started','yesno_restarted']
        when 'liar' then array['liar_started','liar_restarted']
        when 'snakes' then array['snakes_started','snakes_restarted']
        when 'domino' then array['domino_started','domino_restarted']
        when 'who' then array['who_started']
        when 'colors' then array['colors_started']
        when 'tavla' then array['tavla_started','tavla_restarted']
        else array[]::text[]
      end
    );
  if v_round_start_id=0 then
    return new;
  end if;

  if new.game_key='number' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='number_guess'
    order by e.id desc limit 1;
    if not found
       or v_event.event_payload->>'result' is distinct from 'correct'
       or v_event.actor_id::text is distinct from v_board->>'winner_id'
       or v_event.event_payload->>'guess' is distinct from v_board->>'revealed_number' then
      return new;
    end if;
    select s.secret_state->>'number' into v_secret
    from public.game_room_private_state s where s.room_id=new.id;
    if v_secret is null or v_secret is distinct from v_board->>'revealed_number'
       or not exists(
         select 1 from public.game_room_players p
         where p.room_id=new.id and p.user_id=v_event.actor_id
       ) then
      return new;
    end if;

  elsif new.game_key='most' then
    if not exists(
      select 1 from public.game_room_engine_events e
      where e.room_id=new.id and e.id>v_round_start_id
        and e.event_type='most_finished' and e.event_payload->>'question'='5'
    ) then
      return new;
    end if;
    select count(distinct
      case
        when e.event_payload->>'question' ~ '^[0-5]$'
         and e.event_payload->>'vote_count'=e.event_payload->>'vote_total'
         and e.event_payload->>'vote_total' ~ '^(?:[2-9]|1[0-2])$'
        then (e.event_payload->>'question')::integer
        else null
      end
    )::integer into v_completed_questions
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id
      and e.event_type in ('most_vote','most_player_left');
    if coalesce(v_completed_questions,0)<>6 then
      return new;
    end if;

  elsif new.game_key='quiz' then
    if not exists(
      select 1 from public.game_room_engine_events e
      where e.room_id=new.id and e.id>v_round_start_id
        and e.event_type='quiz_finished' and e.event_payload->>'question'='2'
    ) then
      return new;
    end if;
    select count(distinct
      case
        when e.event_payload->>'question' ~ '^[0-2]$'
         and e.event_payload->>'answer_count'=e.event_payload->>'answer_total'
         and e.event_payload->>'answer_total' ~ '^(?:[2-9]|1[0-2])$'
        then (e.event_payload->>'question')::integer
        else null
      end
    )::integer into v_completed_questions
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id
      and e.event_type in ('quiz_answer','quiz_player_left');
    if coalesce(v_completed_questions,0)<>3 then
      return new;
    end if;

  elsif new.game_key='yesno' then
    if not exists(
      select 1 from public.game_room_engine_events e
      where e.room_id=new.id and e.id>v_round_start_id
        and e.event_type='yesno_finished' and e.event_payload->>'question'='2'
    ) then
      return new;
    end if;
    select count(distinct
      case
        when e.event_payload->>'question' ~ '^[0-2]$'
         and e.event_payload->>'answer_count'=e.event_payload->>'answer_total'
         and e.event_payload->>'answer_total' ~ '^(?:[2-9]|1[0-2])$'
        then (e.event_payload->>'question')::integer
        else null
      end
    )::integer into v_completed_questions
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id
      and e.event_type in ('yesno_answer','yesno_player_left');
    if coalesce(v_completed_questions,0)<>3 then
      return new;
    end if;

  elsif new.game_key='liar' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='liar_finished'
    order by e.id desc limit 1;
    if not found
       or v_board->>'finish_reason' is distinct from 'votes_completed'
       or v_board->>'vote_count' !~ '^[0-9]+$'
       or v_board->>'vote_total' !~ '^[0-9]+$'
       or v_board->>'vote_count' is distinct from v_board->>'vote_total'
       or v_event.event_payload->>'votes' is distinct from v_board->>'vote_count'
       or v_event.event_payload->>'outsider_caught' is distinct from v_board->>'outsider_caught'
       or v_board->>'vote_total'::integer is distinct from v_player_count
       or not exists(
         select 1 from public.game_room_players p
         where p.room_id=new.id and p.user_id=v_event.actor_id
       ) then
      return new;
    end if;
    select s.secret_state into v_private
    from public.game_room_private_state s where s.room_id=new.id;
    if v_private is null
       or v_private->>'secret_word' is distinct from v_board->>'secret_word'
       or v_private->>'outsider_id' is distinct from v_board->>'outsider_id' then
      return new;
    end if;

  elsif new.game_key='snakes' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='snakes_finished'
    order by e.id desc limit 1;
    if not found
       or v_board->>'finish_reason' is distinct from 'winner'
       or v_board->>'finished' !~ '^(0|[1-9]|1[0-5])$'
       or v_event.event_payload->>'finished' is distinct from 'true'
       or v_event.event_payload->>'to' is distinct from '100'
       or v_event.event_payload->>'dice' !~ '^[1-6]$' then
      return new;
    end if;
    v_finish_index:=(v_board->>'finished')::integer;
    if jsonb_typeof(v_board->'positions') is distinct from 'array'
       or jsonb_typeof(v_board->'player_order') is distinct from 'array'
       or jsonb_array_length(v_board->'positions')<>v_player_count
       or jsonb_array_length(v_board->'player_order')<>v_player_count
       or v_board->'positions'->>v_finish_index is distinct from '100'
       or v_board->'player_order'->>v_finish_index is distinct from v_event.actor_id::text
       or v_board->>'last_player_id' is distinct from v_event.actor_id::text then
      return new;
    end if;

  elsif new.game_key='domino' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='domino_finished'
    order by e.id desc limit 1;
    if not found or v_event.event_payload->>'finished' is distinct from 'true'
       or not exists(
         select 1 from public.game_room_players p
         where p.room_id=new.id and p.user_id=v_event.actor_id
       ) then
      return new;
    end if;
    if v_board->>'finish_reason'='empty_hand' then
      if v_event.event_payload->>'hand_count' is distinct from '0'
         or not (coalesce(v_board->'winner_ids','[]'::jsonb) ? v_event.actor_id::text) then
        return new;
      end if;
      select s.secret_state into v_private
      from public.game_room_private_state s where s.room_id=new.id;
      if v_private is null or v_private->>'game' is distinct from 'domino'
         or jsonb_typeof(v_private->'hands'->v_event.actor_id::text) is distinct from 'array'
         or jsonb_array_length(v_private->'hands'->v_event.actor_id::text)<>0 then
        return new;
      end if;
    elsif v_board->>'finish_reason'='blocked' then
      if v_event.event_payload->>'consecutive_passes' !~ '^[0-9]+$'
         or (v_event.event_payload->>'consecutive_passes')::integer<>v_player_count
         or v_board->>'pass_count' is distinct from v_player_count::text
         or v_board->>'current_player_id' is not null
         or jsonb_typeof(v_board->'winner_ids') is distinct from 'array'
         or jsonb_array_length(v_board->'winner_ids')<1
         or jsonb_typeof(v_board->'pip_totals') is distinct from 'object'
         or (select count(*) from jsonb_object_keys(v_board->'pip_totals'))<>v_player_count then
        return new;
      end if;
      select s.secret_state into v_private
      from public.game_room_private_state s where s.room_id=new.id;
      if v_private is null
         or jsonb_typeof(v_private->'boneyard') is distinct from 'array'
         or jsonb_array_length(v_private->'boneyard')<>0 then
        return new;
      end if;
    else
      return new;
    end if;

  elsif new.game_key='who' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='who_finished'
    order by e.id desc limit 1;
    if not found
       or v_event.event_payload->>'correct' is distinct from 'true'
       or v_board->>'winner_id' is distinct from v_event.actor_id::text
       or not exists(
         select 1 from public.game_room_players p
         where p.room_id=new.id and p.user_id=v_event.actor_id
       ) then
      return new;
    end if;
    select s.secret_state into v_private
    from public.game_room_private_state s where s.room_id=new.id;
    if v_private is null or v_private->>'word' is distinct from v_board->>'revealed_word'
       or regexp_replace(
         translate(lower(pg_catalog.btrim(coalesce(v_event.event_payload->>'guess',''))),'أإآٱىة','اااايه'),
         '[ًٌٍَُِّْٰـ]','','g'
       ) is distinct from regexp_replace(
         translate(lower(pg_catalog.btrim(v_private->>'word')),'أإآٱىة','اااايه'),
         '[ًٌٍَُِّْٰـ]','','g'
       ) then
      return new;
    end if;

  elsif new.game_key='colors' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='colors_finished'
    order by e.id desc limit 1;
    if not found then
      return new;
    end if;
    if v_event.event_payload->>'reason'='blocked' then
      if v_board->>'finish_reason' is distinct from 'blocked'
         or v_board->>'passes' is distinct from v_player_count::text
         or v_event.event_payload->>'passes' is distinct from v_player_count::text then
        return new;
      end if;
    else
      if v_event.event_payload->>'cards_left' is distinct from '0'
         or v_board->>'winner_id' is distinct from v_event.actor_id::text
         or v_board->'hand_counts'->>v_event.actor_id::text is distinct from '0' then
        return new;
      end if;
      select s.secret_state into v_private
      from public.game_room_private_state s where s.room_id=new.id;
      if v_private is null
         or jsonb_typeof(v_private->'hands'->v_event.actor_id::text) is distinct from 'array'
         or jsonb_array_length(v_private->'hands'->v_event.actor_id::text)<>0 then
        return new;
      end if;
    end if;
    if not exists(
      select 1 from public.game_room_players p
      where p.room_id=new.id and p.user_id=v_event.actor_id
    ) then
      return new;
    end if;

  elsif new.game_key='tavla' then
    select e.actor_id,e.event_payload into v_event
    from public.game_room_engine_events e
    where e.room_id=new.id and e.id>v_round_start_id and e.event_type='tavla_finished'
    order by e.id desc limit 1;
    if not found
       or v_board->>'finished' !~ '^[01]$'
       or v_event.event_payload->>'winner' is distinct from v_event.actor_id::text then
      return new;
    end if;
    v_finish_index:=(v_board->>'finished')::integer;
    v_home:=case when v_finish_index=0 then 23 else 0 end;
    if jsonb_typeof(v_board->'player_order') is distinct from 'array'
       or jsonb_typeof(v_board->'positions') is distinct from 'array'
       or jsonb_array_length(v_board->'player_order')<>2
       or jsonb_array_length(v_board->'positions')<>2
       or v_board->'player_order'->>v_finish_index is distinct from v_event.actor_id::text
       or jsonb_typeof(v_board->'positions'->v_finish_index) is distinct from 'array'
       or jsonb_array_length(v_board->'positions'->v_finish_index)<>15
       or exists(
         select 1 from jsonb_array_elements(v_board->'positions'->v_finish_index) e(piece)
         where case
           when (e.piece->>'point') ~ '^(0|[1-9]|1[0-9]|2[0-3])$'
             then (e.piece->>'point')::integer<>v_home
           else true
         end
       ) then
      return new;
    end if;

  else
    -- Wheel is a game picker, not a completed competitive round.
    return new;
  end if;

  -- One participation award per player per room, regardless of retries.
  for v_player in
    select p.user_id from public.game_room_players p where p.room_id=new.id
  loop
    insert into public.player_game_history(room_id,user_id,game_key,xp_awarded)
    values(new.id,v_player.user_id,new.game_key,10)
    on conflict(room_id,user_id) do nothing;

    get diagnostics v_inserted=row_count;
    if v_inserted=1 then
      insert into public.player_progress(user_id,xp,games_completed,updated_at)
      values(v_player.user_id,10,1,pg_catalog.now())
      on conflict(user_id) do update
        set xp=public.player_progress.xp+10,
            games_completed=public.player_progress.games_completed+1,
            updated_at=pg_catalog.now()
      returning games_completed into v_games;

      insert into public.player_achievements(user_id,achievement_id)
      select v_player.user_id,a.id from public.achievements a
      where a.requirement_games<=v_games
      on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;

  return new;
end;
$function$;

revoke all on function public.award_completed_room_progress()
  from public,anon,authenticated;

commit;
