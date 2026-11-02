-- سَـوَاد وناسة: اعتماد محرك خادمي موحد لكل غرف اللعب.
-- يطبّق بعد ملفات محركات v2 السابقة. يحافظ على الغرف واللاعبين؛
-- يؤرشف حالة جولات v1 غير الموثوقة قبل إعادتها إلى الردهة.
begin;

alter table public.game_rooms
  add column if not exists engine_version smallint not null default 1;

create table if not exists public.game_room_private_state (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  secret_state jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);

create table if not exists public.game_room_engine_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  actor_id uuid not null,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);

create index if not exists game_room_engine_events_room_created_idx
  on public.game_room_engine_events(room_id,created_at,id);

create table if not exists public.game_room_engine_rate_limits (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  bucket_start timestamptz not null,
  action_count integer not null check(action_count > 0),
  primary key(room_id,actor_id,bucket_start)
);
create index if not exists game_room_engine_rate_limits_bucket_idx
  on public.game_room_engine_rate_limits(bucket_start);

alter table public.game_room_private_state enable row level security;
alter table public.game_room_engine_events enable row level security;
alter table public.game_room_engine_rate_limits enable row level security;
revoke all on public.game_room_private_state from public,anon,authenticated;
revoke all on public.game_room_engine_events from public,anon,authenticated;
revoke all on public.game_room_engine_rate_limits from public,anon,authenticated;
grant all on public.game_room_private_state to service_role;
grant all on public.game_room_engine_events to service_role;
grant all on public.game_room_engine_rate_limits to service_role;
grant usage,select on sequence public.game_room_engine_events_id_seq to service_role;

alter table public.game_room_engine_events
  drop constraint if exists game_room_engine_events_event_type_check;
alter table public.game_room_engine_events
  add constraint game_room_engine_events_event_type_check
  check(event_type in (
    'number_started','number_restarted','number_guess',
    'most_started','most_vote','most_question','most_finished','most_restarted','most_player_left',
    'quiz_started','quiz_answer','quiz_question','quiz_finished','quiz_restarted','quiz_player_left',
    'yesno_started','yesno_answer','yesno_question','yesno_finished','yesno_restarted','yesno_player_left',
    'liar_started','liar_hint','liar_vote','liar_finished','liar_restarted','liar_player_left',
    'snakes_started','snakes_roll','snakes_finished','snakes_restarted','snakes_player_left',
    'domino_started','domino_play','domino_draw','domino_pass','domino_finished','domino_restarted','domino_player_left',
    'who_started','who_guess','who_finished',
    'colors_started','colors_play','colors_draw','colors_pass','colors_finished',
    'tavla_started','tavla_roll','tavla_move','tavla_finished','tavla_restarted','tavla_player_left',
    'wheel_started','wheel_arena_entered','wheel_spun','wheel_restarted','wheel_returned','wheel_game_adopted',
    'legacy_state_archived'
  ));

-- Keep an archival copy of every untrusted v1 state before clearing it.
do $$
declare
  v_room record;
  v_count integer;
begin
  for v_room in
    select r.* from public.game_rooms r
    where coalesce(r.engine_version,1)<2
    order by r.created_at,r.id
    for update
  loop
    insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
    values(
      v_room.id,
      v_room.host_id,
      'legacy_state_archived',
      jsonb_build_object(
        'game_key',v_room.game_key,
        'old_status',v_room.status,
        'old_updated_at',v_room.updated_at,
        'old_game_state',v_room.game_state,
        'archived_at',pg_catalog.clock_timestamp()
      )
    );

    select count(*)::integer into v_count
    from public.game_room_players p where p.room_id=v_room.id;

    update public.game_rooms
    set engine_version=2,
        status=case when v_count>0 then 'waiting' else 'finished' end,
        game_started_at=null,
        game_state=jsonb_build_object(
          'phase',case when v_count>0 then 'lobby' else 'finished' end,
          'round',0,
          'turn',0,
          'scores','{}'::jsonb,
          'feed',jsonb_build_array(
            'تم تحديث حماية الغرفة. حُفظت الجولة السابقة في سجل الأرشيف؛ ابدأوا جولة جديدة.'
          ),
          'board',case when v_room.game_key='wheel'
            then jsonb_build_object('stage','landing','rotation',0,'result',null,'spins',0)
            else '{}'::jsonb end
        ),
        updated_at=pg_catalog.clock_timestamp()
    where id=v_room.id;
  end loop;
end
$$;

alter table public.game_rooms alter column engine_version set default 2;
alter table public.game_rooms alter column engine_version set not null;
do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.game_rooms'::regclass
      and conname='game_rooms_engine_version_check'
  ) then
    alter table public.game_rooms
      add constraint game_rooms_engine_version_check check(engine_version=2);
  else
    alter table public.game_rooms
      drop constraint game_rooms_engine_version_check;
    alter table public.game_rooms
      add constraint game_rooms_engine_version_check check(engine_version=2);
  end if;
end
$$;

-- A single guarded entry point is shared by all engine RPCs.
create or replace function public.engine_v2_guard_room(
  p_room_id uuid,
  p_actor_id uuid,
  p_expected_updated_at timestamptz,
  p_game_key text default null,
  p_require_host boolean default false,
  p_required_status text default null
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_expected_updated_at is null then
    raise exception 'Invalid engine actor or room version.' using errcode='22023';
  end if;

  select * into v_room
  from public.game_rooms
  where id=p_room_id
  for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.engine_version<>2 then
    raise exception 'الغرفة لم تُرقَّ إلى المحرك الخادمي.' using errcode='42501';
  end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة الغرفة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if p_require_host and v_room.host_id is distinct from p_actor_id then
    raise exception 'هذه العملية للمضيف فقط.' using errcode='42501';
  end if;
  if p_game_key is not null and v_room.game_key is distinct from p_game_key then
    raise exception 'نوع اللعبة لا يطابق محرك الحركة.' using errcode='42501';
  end if;
  if p_required_status is not null and v_room.status is distinct from p_required_status then
    raise exception 'حالة الغرفة لا تسمح بهذه الحركة.' using errcode='22023';
  end if;
  return v_room;
end;
$function$;

-- Apply a rolling per-account/per-room action cap. The gateway calls this
-- after JWT validation and before every mutating RPC.
create or replace function public.engine_v2_consume_action_slot(
  p_room_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_bucket timestamptz:=date_trunc('minute',pg_catalog.clock_timestamp());
  v_count integer;
  v_room_count integer;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
     or p_room_id is null or p_actor_id is null then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_room_id::text,0)
  );
  insert into public.game_room_engine_rate_limits(room_id,actor_id,bucket_start,action_count)
  values(p_room_id,p_actor_id,v_bucket,1)
  on conflict(room_id,actor_id,bucket_start)
  do update set action_count=public.game_room_engine_rate_limits.action_count+1
  returning action_count into v_count;

  select coalesce(sum(action_count),0)::integer into v_room_count
  from public.game_room_engine_rate_limits
  where room_id=p_room_id and bucket_start=v_bucket;
  if v_count>40 or v_room_count>240 then
    raise exception 'تم تجاوز عدد الحركات المسموح مؤقتاً.' using errcode='54000';
  end if;
  delete from public.game_room_engine_rate_limits
  where bucket_start < v_bucket-interval '1 day';
end;
$function$;

-- Stop the legacy arbitrary JSON write API completely. No client role may
-- submit a replacement board, phase, winner, score, or room game key.
create or replace function public.update_game_room_state(
  p_room_id uuid,
  p_game_state jsonb,
  p_status text default null,
  p_game_key text default null,
  p_expected_updated_at timestamptz default null
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
begin
  raise exception 'تم إيقاف التحديث العام لحالة الغرفة؛ استخدم أمر محرك اللعبة الخادمي.'
    using errcode='42501';
end;
$function$;
revoke all on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz)
  from public,anon,authenticated;

-- All new rooms start on the server engine, regardless of game type.
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
    raise exception 'رمز الغرفة غير صالح.' using errcode='22023';
  end if;
  if p_room_name is null or char_length(btrim(p_room_name)) not between 1 and 32 then
    raise exception 'اسم الغرفة غير صالح.' using errcode='22023';
  end if;
  v_name:=btrim(coalesce(p_display_name,''));
  if char_length(v_name) not between 2 and 24 then
    raise exception 'اسم اللاعب يجب أن يكون بين حرفين و٢٤ حرفاً.' using errcode='22023';
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
    else raise exception 'اللعبة المطلوبة غير معروفة.' using errcode='22023';
  end case;
  if p_max_players is null or p_max_players not between v_min and v_max then
    raise exception 'عدد اللاعبين لا يناسب اللعبة المختارة.' using errcode='22023';
  end if;

  insert into public.game_rooms(
    room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version
  )
  values(
    upper(p_room_code),btrim(p_room_name),p_game_key,auth.uid(),p_max_players,
    'waiting',
    jsonb_build_object('phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('الغرفة جاهزة؛ يبدأ المضيف اللعبة من المحرك الخادمي.'),
      'board',case when p_game_key='wheel'
        then jsonb_build_object('stage','landing','rotation',0,'result',null,'spins',0)
        else '{}'::jsonb end),
    2
  )
  returning * into v_room;

  insert into public.game_room_players(room_id,user_id,display_name,seat)
  values(v_room.id,auth.uid(),v_name,0);
  return v_room;
end;
$function$;

-- WHO: secret selection is made by the Edge Function using Web Crypto.
create or replace function public.engine_v2_start_who_game(
  p_room_id uuid,p_actor_id uuid,p_secret_word text,p_category text,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_total integer; v_order jsonb; v_scores jsonb; v_round integer;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'who',true,null);
  if v_room.status not in ('waiting','finished') then raise exception 'لا يمكن بدء أو إعادة اللعبة بهذه الحالة.' using errcode='22023'; end if;
  if p_secret_word is null or char_length(btrim(p_secret_word)) not between 2 and 60
     or p_category is null or char_length(btrim(p_category)) not between 2 and 40 then
    raise exception 'بيانات الشخصية السرية غير صالحة.' using errcode='22023';
  end if;
  select count(*)::integer,
         coalesce(jsonb_agg(p.user_id::text order by p.seat),'[]'::jsonb),
         coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
  into v_total,v_order,v_scores
  from public.game_room_players p where p.room_id=p_room_id;
  if v_total not between 2 and 12 or v_total>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب لعبة خمّن منو آني.' using errcode='22023';
  end if;
  v_round:=case when coalesce(v_room.game_state->>'round','0') ~ '^[0-9]{1,6}$'
    then (v_room.game_state->>'round')::integer+1 else 1 end;
  insert into public.game_room_private_state(room_id,secret_state)
  values(p_room_id,jsonb_build_object('word',btrim(p_secret_word),'category',btrim(p_category)))
  on conflict(room_id) do update set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();
  update public.game_rooms
  set status='playing',game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp(),
      game_state=jsonb_build_object('phase','playing','round',v_round,'turn',0,'scores',v_scores,
        'feed',jsonb_build_array('بدأت لعبة خمّن منو آني؟.'),
        'board',jsonb_build_object('phase','guessing','player_order',v_order,'current_player_id',v_order->>0,
          'guess_count',0,'category',btrim(p_category)))
  where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'who_started',jsonb_build_object('category',btrim(p_category),'players',v_total,'round',v_round));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_guess_who(
  p_room_id uuid,p_actor_id uuid,p_guess text,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_private jsonb; v_word text; v_category text;
  v_board jsonb; v_state jsonb; v_order jsonb; v_turn integer; v_count integer;
  v_next_id text; v_scores jsonb; v_correct boolean;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'who',false,'playing');
  if p_guess is null or char_length(btrim(p_guess)) not between 1 and 60 then
    raise exception 'اكتب تخميناً من حرف إلى ٦٠ حرفاً.' using errcode='22023';
  end if;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  v_order:=coalesce(v_board->'player_order','[]'::jsonb);
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_order->>v_turn is distinct from p_actor_id::text then
    raise exception 'مو دورك بالتخمين حالياً.' using errcode='42501';
  end if;
  select secret_state into v_private from public.game_room_private_state
  where room_id=p_room_id for update;
  if not found then raise exception 'بطاقة التخمين السرية غير متاحة.'; end if;
  v_word:=v_private->>'word';
  v_category:=v_private->>'category';
  v_correct:=lower(pg_catalog.btrim(p_guess))=lower(pg_catalog.btrim(v_word));
  v_count:=coalesce((v_board->>'guess_count')::integer,0)+1;
  v_scores:=coalesce(v_room.game_state->'scores','{}'::jsonb);
  if v_correct then
    v_scores:=v_scores||jsonb_build_object(p_actor_id::text,
      coalesce((v_scores->>p_actor_id::text)::integer,0)+10);
    v_board:=v_board||jsonb_build_object('phase','finished','winner_id',p_actor_id::text,
      'revealed_word',v_word,'category',v_category,'guess_count',v_count);
    v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',coalesce(v_room.game_state->'feed','[]'::jsonb)
      ||jsonb_build_array('أصاب '||(select p.display_name from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id)||' التخمين الصحيح.'),true);
  else
    v_turn:=(v_turn+1)%jsonb_array_length(v_order);
    v_next_id:=v_order->>v_turn;
    v_board:=jsonb_set(v_board,'{current_player_id}',to_jsonb(v_next_id),true);
    v_board:=jsonb_set(v_board,'{guess_count}',to_jsonb(v_count),true);
    v_state:=jsonb_set(v_room.game_state,'{turn}',to_jsonb(v_turn),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_room.game_state,'{feed}',
      coalesce(v_room.game_state->'feed','[]'::jsonb)||jsonb_build_array('تم تسجيل تخمين غير صحيح.'),true);
  end if;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,case when v_correct then 'who_finished' else 'who_guess' end,
    jsonb_build_object('round',v_room.game_state->>'round','guess',btrim(p_guess),'correct',v_correct,'count',v_count));
  update public.game_rooms set status=case when v_correct then 'finished' else status end,
    game_state=v_state,updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  if v_correct then delete from public.game_room_private_state where room_id=p_room_id; end if;
  return v_room;
end;
$function$;

-- COLORS: shuffled deck, hands and draw pile are private. Public state exposes
-- only the discard top and hand counts.
create or replace function public.engine_v2_start_colors_game(
  p_room_id uuid,p_actor_id uuid,p_deal jsonb,p_draw_pile jsonb,p_discard jsonb,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_total integer; v_player record; v_cards integer; v_bad integer;
  v_order jsonb; v_counts jsonb; v_private jsonb; v_state jsonb;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'colors',true,null);
  if v_room.status not in ('waiting','finished') then raise exception 'لا يمكن بدء أو إعادة كروت الألوان بهذه الحالة.' using errcode='22023'; end if;
  if jsonb_typeof(p_deal) is distinct from 'object' or jsonb_typeof(p_draw_pile) is distinct from 'array'
     or jsonb_typeof(p_discard) is distinct from 'object' then
    raise exception 'توزيع أوراق الألوان غير صالح.' using errcode='22023';
  end if;
  select count(*)::integer,coalesce(jsonb_agg(p.user_id::text order by p.seat),'[]'::jsonb)
    into v_total,v_order from public.game_room_players p where p.room_id=p_room_id;
  if v_total not between 2 and 8 or v_total>v_room.max_players then
    raise exception 'عدد اللاعبين لا يناسب كروت الألوان.' using errcode='22023';
  end if;
  for v_player in select p.user_id from public.game_room_players p where p.room_id=p_room_id loop
    if not (p_deal ? v_player.user_id::text)
       or jsonb_typeof(p_deal->v_player.user_id::text) is distinct from 'array'
       or jsonb_array_length(p_deal->v_player.user_id::text)<>7 then
      raise exception 'يجب توزيع سبع أوراق لكل لاعب.' using errcode='22023';
    end if;
  end loop;
  select count(*)::integer into v_cards from (
    select x.value as card from jsonb_each(p_deal) h cross join lateral jsonb_array_elements(h.value) x
    union all select x.value from jsonb_array_elements(p_draw_pile) x
    union all select p_discard
  ) c;
  if v_cards<>60 then raise exception 'عدد أوراق الرزمة غير صحيح.' using errcode='22023'; end if;
  select count(*)::integer into v_bad from (
    select card->>'c' as color,card->>'v' as value,count(*)::integer as copies
    from (
      select x.value as card from jsonb_each(p_deal) h cross join lateral jsonb_array_elements(h.value) x
      union all select x.value from jsonb_array_elements(p_draw_pile) x
      union all select p_discard
    ) all_cards
    group by card->>'c',card->>'v'
  ) groups
  where color not in ('أحمر','أزرق','أخضر','أصفر')
     or value not in ('١','٢','٣','٤','تخطي') or copies<>3;
  if v_bad<>0 then raise exception 'تكوين رزمة الألوان غير صالح.' using errcode='22023'; end if;
  select coalesce(jsonb_object_agg(player_id,7),'{}'::jsonb) into v_counts
  from jsonb_object_keys(p_deal) as keys(player_id);
  v_private:=jsonb_build_object('hands',p_deal,'draw_pile',p_draw_pile,'passes',0);
  v_state:=jsonb_build_object('phase','playing','round',1,'turn',0,'scores','{}'::jsonb,
    'feed',jsonb_build_array('بدأت لعبة كروت الألوان.'),
    'board',jsonb_build_object('phase','playing','player_order',v_order,'current_player_id',v_order->>0,
      'hand_counts',v_counts,'discard_top',p_discard,'draw_count',jsonb_array_length(p_draw_pile),'passes',0));
  insert into public.game_room_private_state(room_id,secret_state) values(p_room_id,v_private)
  on conflict(room_id) do update set secret_state=excluded.secret_state,updated_at=pg_catalog.clock_timestamp();
  update public.game_rooms set status='playing',game_started_at=pg_catalog.clock_timestamp(),
    game_state=v_state,updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'colors_started',jsonb_build_object('players',v_total));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_play_colors(
  p_room_id uuid,p_actor_id uuid,p_color text,p_value text,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_private jsonb; v_hands jsonb; v_hand jsonb;
  v_draw jsonb; v_idx bigint; v_new_hand jsonb; v_board jsonb; v_state jsonb;
  v_top jsonb; v_counts jsonb; v_order jsonb; v_turn integer; v_new_turn integer;
  v_name text; v_wins boolean;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'colors',false,'playing');
  if p_color not in ('أحمر','أزرق','أخضر','أصفر') or p_value not in ('١','٢','٣','٤','تخطي') then
    raise exception 'الورقة المختارة غير صالحة.' using errcode='22023';
  end if;
  v_board:=v_room.game_state->'board'; v_order:=v_board->'player_order';
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_order->>v_turn is distinct from p_actor_id::text then
    raise exception 'مو دورك بلعب الورقة.' using errcode='42501';
  end if;
  select secret_state into v_private from public.game_room_private_state where room_id=p_room_id for update;
  if not found then raise exception 'أوراق اللاعبين غير متاحة.'; end if;
  v_hands:=v_private->'hands'; v_hand:=v_hands->p_actor_id::text; v_draw:=v_private->'draw_pile';
  v_top:=v_board->'discard_top';
  if coalesce(v_top->>'c','')<>p_color and coalesce(v_top->>'v','')<>p_value then
    raise exception 'الورقة يجب أن تطابق اللون أو الرقم.' using errcode='22023';
  end if;
  select ordinality into v_idx from jsonb_array_elements(v_hand) with ordinality e(card,ordinality)
  where card->>'c'=p_color and card->>'v'=p_value limit 1;
  if v_idx is null then raise exception 'هذه الورقة ليست في يدك.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(card order by ordinality),'[]'::jsonb) into v_new_hand
  from jsonb_array_elements(v_hand) with ordinality e(card,ordinality) where ordinality<>v_idx;
  v_hands:=jsonb_set(v_hands,array[p_actor_id::text],v_new_hand,true);
  v_wins:=jsonb_array_length(v_new_hand)=0;
  v_counts:=jsonb_set(v_board->'hand_counts',array[p_actor_id::text],to_jsonb(jsonb_array_length(v_new_hand)),true);
  v_board:=jsonb_set(v_board,'{discard_top}',jsonb_build_object('c',p_color,'v',p_value),true);
  v_board:=jsonb_set(v_board,'{passes}',to_jsonb(0),true);
  v_board:=jsonb_set(v_board,'{hand_counts}',v_counts,true);
  v_board:=jsonb_set(v_board,'{draw_count}',to_jsonb(jsonb_array_length(v_draw)),true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  if v_wins then
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
    v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
  else
    v_new_turn:=(v_turn+1)%jsonb_array_length(v_order);
    v_board:=jsonb_set(v_board,'{current_player_id}',to_jsonb(v_order->>v_new_turn),true);
    v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_new_turn),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
  end if;
  v_name:=(select p.display_name from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id);
  v_state:=jsonb_set(v_state,'{feed}',coalesce(v_room.game_state->'feed','[]'::jsonb)||jsonb_build_array(v_name||' لعب ورقة من يده.'),true);
  update public.game_room_private_state set secret_state=jsonb_set(v_private,'{hands}',v_hands,true),
    updated_at=pg_catalog.clock_timestamp() where room_id=p_room_id;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,case when v_wins then 'colors_finished' else 'colors_play' end,
    jsonb_build_object('color',p_color,'value',p_value,'cards_left',jsonb_array_length(v_new_hand)));
  update public.game_rooms set status=case when v_wins then 'finished' else status end,
    game_state=v_state,updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  if v_wins then delete from public.game_room_private_state where room_id=p_room_id; end if;
  return v_room;
end;
$function$;

create or replace function public.engine_v2_get_colors_hand(
  p_room_id uuid,p_actor_id uuid
)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare v_private jsonb; v_hand jsonb;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  select secret_state into v_private from public.game_room_private_state where room_id=p_room_id;
  v_hand:=v_private->'hands'->p_actor_id::text;
  if v_hand is null then raise exception 'أوراقك غير متاحة لهذه الجولة.'; end if;
  return jsonb_build_object('tiles',v_hand,'count',jsonb_array_length(v_hand));
end;
$function$;

create or replace function public.engine_v2_draw_colors(
  p_room_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_private jsonb; v_hands jsonb; v_draw jsonb;
  v_hand jsonb; v_card jsonb; v_new_draw jsonb; v_board jsonb; v_state jsonb;
  v_top jsonb; v_turn integer; v_order jsonb;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'colors',false,'playing');
  v_board:=v_room.game_state->'board'; v_order:=v_board->'player_order';
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_order->>v_turn is distinct from p_actor_id::text then
    raise exception 'مو دورك بالسحب.' using errcode='42501';
  end if;
  select secret_state into v_private from public.game_room_private_state where room_id=p_room_id for update;
  if not found then raise exception 'رزمة الأوراق غير متاحة.'; end if;
  v_hands:=v_private->'hands'; v_hand:=v_hands->p_actor_id::text; v_draw:=v_private->'draw_pile';
  if jsonb_array_length(v_draw)=0 then raise exception 'خلصت رزمة السحب؛ مرّر الدور.'; end if;
  v_top:=v_board->'discard_top';
  if exists(select 1 from jsonb_array_elements(v_hand) c
    where c->>'c'=v_top->>'c' or c->>'v'=v_top->>'v') then
    raise exception 'عندك ورقة قابلة للعب؛ لازم تلعبها قبل السحب.' using errcode='22023';
  end if;
  v_card:=v_draw->0;
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_new_draw
  from jsonb_array_elements(v_draw) with ordinality e(value,ordinality) where ordinality>1;
  v_hand:=v_hand||jsonb_build_array(v_card);
  v_hands:=jsonb_set(v_hands,array[p_actor_id::text],v_hand,true);
  v_private:=jsonb_set(v_private,'{hands}',v_hands,true);
  v_private:=jsonb_set(v_private,'{draw_pile}',v_new_draw,true);
  v_board:=jsonb_set(v_board,'{hand_counts}',jsonb_set(v_board->'hand_counts',array[p_actor_id::text],to_jsonb(jsonb_array_length(v_hand)),true),true);
  v_board:=jsonb_set(v_board,'{passes}',to_jsonb(0),true);
  v_board:=jsonb_set(v_board,'{draw_count}',to_jsonb(jsonb_array_length(v_new_draw)),true);
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_room.game_state,'{feed}',coalesce(v_room.game_state->'feed','[]'::jsonb)||jsonb_build_array('سحب لاعب ورقة من الرزمة.'),true);
  update public.game_room_private_state set secret_state=v_private,updated_at=pg_catalog.clock_timestamp() where room_id=p_room_id;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'colors_draw',jsonb_build_object('hand_count',jsonb_array_length(v_hand)));
  update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  return v_room;
end;
$function$;

create or replace function public.engine_v2_pass_colors(
  p_room_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_private jsonb; v_hand jsonb; v_draw jsonb;
  v_top jsonb; v_board jsonb; v_order jsonb; v_turn integer; v_new_turn integer;
  v_passes integer; v_state jsonb;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'colors',false,'playing');
  v_board:=v_room.game_state->'board'; v_order:=v_board->'player_order';
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_order->>v_turn is distinct from p_actor_id::text then raise exception 'مو دورك بالتمرير.' using errcode='42501'; end if;
  select secret_state into v_private from public.game_room_private_state where room_id=p_room_id for update;
  v_hand:=v_private->'hands'->p_actor_id::text; v_draw:=v_private->'draw_pile'; v_top:=v_board->'discard_top';
  if exists(select 1 from jsonb_array_elements(v_hand) c
    where c->>'c'=v_top->>'c' or c->>'v'=v_top->>'v') then
    raise exception 'لا يمكن التمرير ما دامت لديك ورقة قابلة للعب.' using errcode='22023';
  end if;
  v_passes:=coalesce((v_board->>'passes')::integer,0)+1;
  v_new_turn:=(v_turn+1)%jsonb_array_length(v_order);
  v_board:=jsonb_set(v_board,'{passes}',to_jsonb(v_passes),true);
  v_board:=jsonb_set(v_board,'{current_player_id}',to_jsonb(v_order->>v_new_turn),true);
  if v_passes>=jsonb_array_length(v_order) then
    v_board:=jsonb_set(v_board,'{phase}',to_jsonb('finished'::text),true);
    v_board:=jsonb_set(v_board,'{finish_reason}',to_jsonb('blocked'::text),true);
  end if;
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  if v_passes>=jsonb_array_length(v_order) then v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true); end if;
  update public.game_room_private_state set secret_state=jsonb_set(secret_state,'{passes}',to_jsonb(v_passes),true),
    updated_at=pg_catalog.clock_timestamp() where room_id=p_room_id;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'colors_pass',jsonb_build_object('passes',v_passes));
  update public.game_rooms set status=case when v_passes>=jsonb_array_length(v_order) then 'finished' else status end,
    game_state=v_state,updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  if v_room.status='finished' then delete from public.game_room_private_state where room_id=p_room_id; end if;
  return v_room;
end;
$function$;

-- SIMPLIFIED TAVLA: server validates the existing 24-point race-board rules.
-- This intentionally does not claim full backgammon hit/bar/bearing-off rules.
create or replace function public.engine_v2_start_tavla_game(
  p_room_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_order jsonb; v_scores jsonb; v_p0 jsonb; v_p1 jsonb;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'tavla',true,'waiting');
  if (select count(*) from public.game_room_players p where p.room_id=p_room_id)<>2 then
    raise exception 'الطاولي المبسّطة تحتاج لاعبين اثنين.' using errcode='22023';
  end if;
  select jsonb_agg(p.user_id::text order by p.seat),
         coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
  into v_order,v_scores from public.game_room_players p where p.room_id=p_room_id;
  select jsonb_agg(jsonb_build_object('point',(array[0,11,16,18])[((n%4)+1)],'id',n))
  into v_p0 from generate_series(0,14) n;
  select jsonb_agg(jsonb_build_object('point',(array[23,12,7,5])[((n%4)+1)],'id',n))
  into v_p1 from generate_series(0,14) n;
  update public.game_rooms set status='playing',game_started_at=pg_catalog.clock_timestamp(),
    game_state=jsonb_build_object('phase','playing','round',coalesce((v_room.game_state->>'round')::integer,0)+1,
      'turn',0,'scores',v_scores,'feed',jsonb_build_array('بدأت الطاولي المبسّطة.'),
      'board',jsonb_build_object('player_order',v_order,'positions',jsonb_build_array(v_p0,v_p1),
        'dice','[]'::jsonb,'finished',null,'move_count',0,'selected',null)),
    updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'tavla_started',jsonb_build_object('players',2));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_roll_tavla(
  p_room_id uuid,p_actor_id uuid,p_die_one integer,p_die_two integer,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_board jsonb; v_order jsonb; v_turn integer;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'tavla',false,'playing');
  if p_die_one not between 1 and 6 or p_die_two not between 1 and 6 then
    raise exception 'قيمة النرد غير صالحة.' using errcode='22023';
  end if;
  v_board:=v_room.game_state->'board'; v_order:=v_board->'player_order';
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_order->>v_turn is distinct from p_actor_id::text then raise exception 'مو دورك برمي النرد.' using errcode='42501'; end if;
  if jsonb_array_length(coalesce(v_board->'dice','[]'::jsonb))<>0 then
    raise exception 'استخدم نتيجة النرد الحالية قبل رمية جديدة.' using errcode='22023';
  end if;
  v_board:=jsonb_set(v_board,'{dice}',jsonb_build_array(p_die_one,p_die_two),true);
  update public.game_rooms set game_state=jsonb_set(game_state,'{board}',v_board,true),
    updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'tavla_roll',jsonb_build_object('dice',jsonb_build_array(p_die_one,p_die_two)));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_move_tavla(
  p_room_id uuid,p_actor_id uuid,p_from_point integer,p_to_point integer,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_board jsonb; v_order jsonb; v_positions jsonb;
  v_pieces jsonb; v_dice jsonb; v_turn integer; v_die integer; v_idx bigint;
  v_direction integer; v_home integer; v_left jsonb; v_count integer; v_win boolean;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'tavla',false,'playing');
  if p_from_point not between 0 and 23 or p_to_point not between 0 and 23 then
    raise exception 'نقطة الحركة خارج اللوحة.' using errcode='22023';
  end if;
  v_board:=v_room.game_state->'board'; v_order:=v_board->'player_order';
  v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
  if v_order->>v_turn is distinct from p_actor_id::text then raise exception 'مو دورك بتحريك القطع.' using errcode='42501'; end if;
  v_dice:=coalesce(v_board->'dice','[]'::jsonb);
  v_direction:=case when v_turn=0 then 1 else -1 end;
  v_home:=case when v_turn=0 then 23 else 0 end;
  v_die:=abs(p_to_point-p_from_point);
  if v_die=0 or not exists(select 1 from jsonb_array_elements_text(v_dice) d(value) where d.value=v_die::text)
     or p_to_point<>p_from_point+(v_direction*v_die) then
    raise exception 'الحركة لا تطابق إحدى قيم النرد.' using errcode='22023';
  end if;
  v_positions:=v_board->'positions'; v_pieces:=v_positions->v_turn;
  select ordinality into v_idx
  from jsonb_array_elements(v_pieces) with ordinality e(piece,ordinality)
  where (piece->>'point')::integer=p_from_point
  order by ordinality limit 1;
  if v_idx is null then raise exception 'ما عندك قطعة في نقطة البداية.' using errcode='42501'; end if;
  v_pieces:=jsonb_set(v_pieces,array[(v_idx-1)::text,'point'],to_jsonb(p_to_point),false);
  v_positions:=jsonb_set(v_positions,array[v_turn::text],v_pieces,true);
  select coalesce(jsonb_agg(value order by ordinality),'[]'::jsonb) into v_left
  from jsonb_array_elements(v_dice) with ordinality e(value,ordinality)
  where ordinality<>(select min(ordinality) from jsonb_array_elements(v_dice) with ordinality x(value,ordinality) where x.value::text=v_die::text);
  v_win:=not exists(select 1 from jsonb_array_elements(v_pieces) piece where (piece->>'point')::integer<>v_home);
  v_board:=jsonb_set(v_board,'{positions}',v_positions,true);
  v_board:=jsonb_set(v_board,'{dice}',v_left,true);
  v_board:=jsonb_set(v_board,'{move_count}',to_jsonb(coalesce((v_board->>'move_count')::integer,0)+1),true);
  if v_win then v_board:=jsonb_set(v_board,'{finished}',to_jsonb(v_turn),true); end if;
  v_count:=jsonb_array_length(v_left);
  if v_count=0 and not v_win then
    update public.game_rooms set game_state=jsonb_set(
      jsonb_set(v_room.game_state,'{board}',v_board,true),'{turn}',
      to_jsonb((v_turn+1)%2),true),updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
  else
    update public.game_rooms set status=case when v_win then 'finished' else status end,
      game_state=jsonb_set(
        jsonb_set(v_room.game_state,'{board}',v_board,true),
        '{phase}',case when v_win then to_jsonb('finished'::text) else coalesce(game_state->'phase',to_jsonb('playing'::text)) end,true),
      updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
  end if;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,case when v_win then 'tavla_finished' else 'tavla_move' end,
    jsonb_build_object('from',p_from_point,'to',p_to_point,'die',v_die,'winner',case when v_win then p_actor_id else null end));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_restart_tavla(
  p_room_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'tavla',true,'finished');
  update public.game_rooms set status='waiting',game_state=jsonb_build_object('phase','lobby','round',0,'turn',0,
    'scores','{}'::jsonb,'feed',jsonb_build_array('الطاولي جاهزة لجولة جديدة.'),'board','{}'::jsonb),
    game_started_at=null,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  return v_room;
end;
$function$;

-- WHEEL: the server chooses the result in the Edge Function and validates
-- every stage transition in the database. Game adoption never writes client JSON.
create or replace function public.engine_v2_start_wheel(
  p_room_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'wheel',true,'waiting');
  update public.game_rooms set status='playing',game_started_at=pg_catalog.clock_timestamp(),
    game_state=jsonb_build_object('phase','playing','round',1,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('بدأ دولاب الوناسة.'),
      'board',jsonb_build_object('stage','landing','rotation',0,'result',null,'spins',0,'spinning',false)),
    updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'wheel_started','{}'::jsonb);
  return v_room;
end;
$function$;

create or replace function public.engine_v2_wheel_stage(
  p_room_id uuid,p_actor_id uuid,p_stage text,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_board jsonb;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'wheel',true,'playing');
  v_board:=v_room.game_state->'board';
  if p_stage='arena' and v_board->>'stage' in ('landing','result') then
    v_board:=jsonb_set(v_board,'{stage}',to_jsonb('arena'::text),true);
    v_board:=jsonb_set(v_board,'{result}','null'::jsonb,true);
  elsif p_stage='landing' and v_board->>'stage'='arena' then
    v_board:=jsonb_set(v_board,'{stage}',to_jsonb('landing'::text),true);
    v_board:=jsonb_set(v_board,'{result}','null'::jsonb,true);
  else
    raise exception 'انتقال الدولاب غير صالح.' using errcode='22023';
  end if;
  update public.game_rooms set game_state=jsonb_set(game_state,'{board}',v_board,true),
    updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,case when p_stage='arena' then 'wheel_arena_entered' else 'wheel_returned' end,'{}'::jsonb);
  return v_room;
end;
$function$;

create or replace function public.engine_v2_spin_wheel(
  p_room_id uuid,p_actor_id uuid,p_result text,p_rotation integer,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_board jsonb; v_count integer; v_min integer; v_max integer; v_spins integer;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'wheel',true,'playing');
  v_board:=v_room.game_state->'board';
  if v_board->>'stage' is distinct from 'arena' then raise exception 'افتح ساحة الدولاب قبل اللف.' using errcode='22023'; end if;
  select count(*)::integer into v_count from public.game_room_players p where p.room_id=p_room_id;
  case p_result
    when 'who' then v_min:=2;v_max:=12;
    when 'number' then v_min:=2;v_max:=8;
    when 'liar' then v_min:=3;v_max:=16;
    when 'most' then v_min:=2;v_max:=12;
    when 'yesno' then v_min:=2;v_max:=12;
    when 'snakes' then v_min:=2;v_max:=6;
    when 'domino' then v_min:=2;v_max:=4;
    when 'tavla' then v_min:=2;v_max:=2;
    when 'colors' then v_min:=2;v_max:=8;
    when 'quiz' then v_min:=2;v_max:=12;
    else raise exception 'نتيجة الدولاب غير صالحة.' using errcode='22023';
  end case;
  if v_count not between v_min and v_max or v_rotation<0 or v_rotation>3600000 then
    raise exception 'اللعبة المختارة لا تناسب عدد اللاعبين.' using errcode='22023';
  end if;
  v_spins:=coalesce((v_board->>'spins')::integer,0)+1;
  v_board:=v_board||jsonb_build_object('result',p_result,'rotation',p_rotation,'spins',v_spins,
    'stage','result','spinning',false);
  update public.game_rooms set game_state=jsonb_set(game_state,'{board}',v_board,true),
    updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'wheel_spun',jsonb_build_object('result',p_result,'rotation',p_rotation,'spins',v_spins));
  return v_room;
end;
$function$;

create or replace function public.engine_v2_adopt_wheel_result(
  p_room_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz
)
returns public.game_rooms
language plpgsql security definer set search_path=''
as $function$
declare v_room public.game_rooms; v_result text; v_count integer; v_min integer; v_max integer;
begin
  v_room:=public.engine_v2_guard_room(p_room_id,p_actor_id,p_expected_updated_at,'wheel',true,'playing');
  v_result:=v_room.game_state#>>'{board,result}';
  select count(*)::integer into v_count from public.game_room_players p where p.room_id=p_room_id;
  case v_result
    when 'who' then v_min:=2;v_max:=12;
    when 'number' then v_min:=2;v_max:=8;
    when 'liar' then v_min:=3;v_max:=16;
    when 'most' then v_min:=2;v_max:=12;
    when 'yesno' then v_min:=2;v_max:=12;
    when 'snakes' then v_min:=2;v_max:=6;
    when 'domino' then v_min:=2;v_max:=4;
    when 'tavla' then v_min:=2;v_max:=2;
    when 'colors' then v_min:=2;v_max:=8;
    when 'quiz' then v_min:=2;v_max:=12;
    else raise exception 'لا توجد نتيجة صالحة لاعتمادها.' using errcode='22023';
  end case;
  if v_count not between v_min and v_max then raise exception 'تغيّر عدد اللاعبين؛ أعد لف الدولاب.' using errcode='22023'; end if;
  update public.game_rooms set game_key=v_result,status='waiting',game_started_at=null,
    game_state=jsonb_build_object('phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('اعتمد المضيف لعبة '||v_result||' من الدولاب.'),
      'board',case when v_result='wheel' then jsonb_build_object('stage','landing') else '{}'::jsonb end),
    updated_at=pg_catalog.clock_timestamp() where id=p_room_id returning * into v_room;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'wheel_game_adopted',jsonb_build_object('game_key',v_result,'engine_version',2));
  return v_room;
end;
$function$;

-- Leaving during a private-turn game ends that round. This avoids stale
-- turn indexes and prevents a departed player from blocking a room forever.
create or replace function public.engine_v2_reconcile_new_game_player_leave()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_room public.game_rooms; v_board jsonb; v_state jsonb; v_event text;
begin
  select * into v_room from public.game_rooms where id=old.room_id for update;
  if not found or v_room.engine_version<>2 or v_room.status<>'playing'
     or v_room.game_key not in ('who','colors','tavla') then
    return old;
  end if;
  v_event:=case v_room.game_key when 'who' then 'who_finished'
    when 'colors' then 'colors_finished' else 'tavla_player_left' end;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb)
    ||jsonb_build_object('phase','finished','finish_reason','player_left');
  v_state:=jsonb_set(v_room.game_state,'{phase}',to_jsonb('finished'::text),true);
  v_state:=jsonb_set(v_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',coalesce(v_room.game_state->'feed','[]'::jsonb)
    ||jsonb_build_array('انتهت الجولة لأن لاعباً غادر الغرفة.'),true);
  update public.game_rooms set status='finished',game_state=v_state,
    updated_at=pg_catalog.clock_timestamp() where id=old.room_id;
  delete from public.game_room_private_state where room_id=old.room_id;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(old.room_id,old.user_id,v_event,jsonb_build_object('reason','player_left'));
  return old;
end;
$function$;

drop trigger if exists game_room_players_reconcile_new_games on public.game_room_players;
create trigger game_room_players_reconcile_new_games
after delete on public.game_room_players
for each row execute function public.engine_v2_reconcile_new_game_player_leave();
revoke all on function public.engine_v2_reconcile_new_game_player_leave() from public,anon,authenticated;

-- No engine function is directly callable by clients. The Edge Function uses
-- its service_role key only after validating the user's JWT and room membership.
revoke all on function public.engine_v2_reconcile_new_game_player_leave() from public,anon,authenticated;
revoke all on function public.engine_v2_guard_room(uuid,uuid,timestamptz,text,boolean,text) from public,anon,authenticated;
revoke all on function public.engine_v2_consume_action_slot(uuid,uuid) from public,anon,authenticated;
revoke all on function public.engine_v2_start_who_game(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_guess_who(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_start_colors_game(uuid,uuid,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_play_colors(uuid,uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_get_colors_hand(uuid,uuid) from public,anon,authenticated;
revoke all on function public.engine_v2_draw_colors(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_pass_colors(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_start_tavla_game(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_roll_tavla(uuid,uuid,integer,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_move_tavla(uuid,uuid,integer,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_restart_tavla(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_start_wheel(uuid,uuid,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_wheel_stage(uuid,uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_spin_wheel(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.engine_v2_adopt_wheel_result(uuid,uuid,timestamptz) from public,anon,authenticated;

grant execute on function public.engine_v2_guard_room(uuid,uuid,timestamptz,text,boolean,text) to service_role;
grant execute on function public.engine_v2_consume_action_slot(uuid,uuid) to service_role;
grant execute on function public.engine_v2_start_who_game(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.engine_v2_guess_who(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.engine_v2_start_colors_game(uuid,uuid,jsonb,jsonb,jsonb,timestamptz) to service_role;
grant execute on function public.engine_v2_play_colors(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.engine_v2_get_colors_hand(uuid,uuid) to service_role;
grant execute on function public.engine_v2_draw_colors(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_pass_colors(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_start_tavla_game(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_roll_tavla(uuid,uuid,integer,integer,timestamptz) to service_role;
grant execute on function public.engine_v2_move_tavla(uuid,uuid,integer,integer,timestamptz) to service_role;
grant execute on function public.engine_v2_restart_tavla(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_start_wheel(uuid,uuid,timestamptz) to service_role;
grant execute on function public.engine_v2_wheel_stage(uuid,uuid,text,timestamptz) to service_role;
grant execute on function public.engine_v2_spin_wheel(uuid,uuid,text,integer,timestamptz) to service_role;
grant execute on function public.engine_v2_adopt_wheel_result(uuid,uuid,timestamptz) to service_role;

commit;
