-- Hardening follow-up for the progression award trigger.
-- Apply after supabase-progression-migration.sql.
create or replace function public.award_completed_room_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_player record;
  v_games integer;
  v_inserted integer;
  v_board jsonb;
  v_winner text;
begin
  if old.status <> 'playing' or new.status <> 'finished' then
    return new;
  end if;
  if new.game_started_at is null
     or new.game_started_at > pg_catalog.clock_timestamp() - interval '15 seconds'
     or new.game_state->>'phase' is distinct from 'finished' then
    return new;
  end if;

  v_board := new.game_state->'board';

  if new.game_key='snakes' then
    v_winner := v_board->>'finished';
    if v_winner is null or v_winner !~ '^(0|[1-9]|1[0-5])$'
       or jsonb_typeof(v_board->'positions') is distinct from 'array'
       or (v_board->'positions'->>v_winner::integer) is distinct from '100' then
      return new;
    end if;
  elsif new.game_key in ('domino','colors') then
    if jsonb_typeof(v_board->'hands') is distinct from 'object'
       or not exists (
         select 1 from jsonb_each(v_board->'hands') as h(player_id,hand)
         where case when jsonb_typeof(h.hand)='array' then jsonb_array_length(h.hand)=0 else false end
       ) then
      return new;
    end if;
  else
    return new;
  end if;

  for v_player in select p.user_id from public.game_room_players p where p.room_id=new.id
  loop
    insert into public.player_game_history(room_id,user_id,game_key,xp_awarded)
    values(new.id,v_player.user_id,new.game_key,10)
    on conflict(room_id,user_id) do nothing;
    get diagnostics v_inserted = row_count;
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
      where a.requirement_games <= v_games
      on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.award_completed_room_progress() from public, anon, authenticated;
