-- Suwad Wanasa: persistent player progression (safe additive migration)
begin;

alter table public.game_rooms
  add column if not exists game_started_at timestamptz;

create table if not exists public.player_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  games_completed integer not null default 0 check (games_completed >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id text primary key,
  title text not null,
  description text not null,
  icon text not null,
  requirement_games integer not null check (requirement_games > 0)
);

insert into public.achievements(id,title,description,icon,requirement_games) values
 ('first-game','أول خطوة','أكمل أول لعبة أونلاين','🎮',1),
 ('five-games','صاحب اللمة','أكمل خمس ألعاب أونلاين','🤝',5),
 ('ten-games','لاعب مثابر','أكمل عشر ألعاب أونلاين','🔥',10),
 ('twenty-five-games','نجم الوناسة','أكمل خمساً وعشرين لعبة','⭐',25),
 ('fifty-games','أسطورة اللمة','أكمل خمسين لعبة أونلاين','🏆',50)
on conflict (id) do nothing;

create table if not exists public.player_achievements (
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key(user_id,achievement_id)
);

create table if not exists public.player_game_history (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_key text not null,
  xp_awarded integer not null default 10 check (xp_awarded between 0 and 10),
  completed_at timestamptz not null default now(),
  primary key(room_id,user_id)
);

create index if not exists player_progress_xp_idx on public.player_progress(xp desc, updated_at desc);
create index if not exists player_game_history_user_idx on public.player_game_history(user_id,completed_at desc);
create index if not exists player_achievements_user_idx on public.player_achievements(user_id,unlocked_at desc);

alter table public.player_progress enable row level security;
alter table public.achievements enable row level security;
alter table public.player_achievements enable row level security;
alter table public.player_game_history enable row level security;

drop policy if exists "authenticated read player progress" on public.player_progress;
create policy "authenticated read player progress" on public.player_progress
 for select to authenticated using (true);

drop policy if exists "authenticated read achievements" on public.achievements;
create policy "authenticated read achievements" on public.achievements
 for select to authenticated using (true);

drop policy if exists "authenticated read unlocked achievements" on public.player_achievements;
create policy "authenticated read unlocked achievements" on public.player_achievements
 for select to authenticated using (true);

drop policy if exists "players read own game history" on public.player_game_history;
create policy "players read own game history" on public.player_game_history
 for select to authenticated using (auth.uid() = user_id);

revoke all on public.player_progress, public.achievements, public.player_achievements, public.player_game_history from anon, authenticated;
grant select on public.player_progress, public.achievements, public.player_achievements, public.player_game_history to authenticated;

-- Record a server timestamp when a room actually enters the playing state.
create or replace function public.track_game_started_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='playing' and old.status is distinct from 'playing' then
    new.game_started_at := pg_catalog.clock_timestamp();
  elsif new.status='waiting' then
    new.game_started_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists game_rooms_track_started_at on public.game_rooms;
create trigger game_rooms_track_started_at
before update of status on public.game_rooms
for each row execute function public.track_game_started_at();

-- Only award participation for completed, supported board games.
-- Winner bonuses are intentionally omitted: game state is still client-authored.
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
     or new.game_state->>'phase' <> 'finished' then
    return new;
  end if;

  v_board := new.game_state->'board';

  if new.game_key='snakes' then
    v_winner := v_board->>'finished';
    if v_winner is null or v_winner !~ '^[0-9]+$'
       or jsonb_typeof(v_board->'positions') <> 'array'
       or (v_board->'positions'->>v_winner) <> '100' then
      return new;
    end if;
  elsif new.game_key in ('domino','colors') then
    if jsonb_typeof(v_board->'hands') <> 'object'
       or not exists (
         select 1
         from jsonb_each(v_board->'hands') as h(player_id,hand)
         where jsonb_typeof(h.hand)='array'
           and jsonb_array_length(h.hand)=0
       ) then
      return new;
    end if;
  else
    return new;
  end if;

  for v_player in
    select p.user_id
    from public.game_room_players p
    where p.room_id=new.id
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
      select v_player.user_id,a.id
      from public.achievements a
      where a.requirement_games <= v_games
      on conflict(user_id,achievement_id) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.award_completed_room_progress() from public, anon, authenticated;
revoke all on function public.track_game_started_at() from public, anon, authenticated;

drop trigger if exists game_rooms_award_progress on public.game_rooms;
create trigger game_rooms_award_progress
after update of status,game_state on public.game_rooms
for each row execute function public.award_completed_room_progress();

create or replace view public.player_leaderboard
with (security_invoker=true)
as
select
  p.id as user_id,
  p.display_name,
  p.username,
  coalesce(pp.xp,0)::integer as xp,
  coalesce(pp.games_completed,0)::integer as games_completed,
  (select count(*)::integer from public.player_achievements pa where pa.user_id=p.id) as achievement_count,
  (1 + floor(coalesce(pp.xp,0)::numeric / 100))::integer as level
from public.profiles p
left join public.player_progress pp on pp.user_id=p.id;

grant select on public.player_leaderboard to authenticated;

commit;
