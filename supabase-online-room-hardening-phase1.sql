-- سَـوَاد وناسة: hardening phase 1 for legacy room protocol.
-- This migration preserves existing rooms and data. It does NOT claim to make
-- client-authored game state trustworthy; legacy XP awards are paused until a
-- server-authoritative engine (engine_version >= 2) validates outcomes.
begin;

alter table public.game_rooms
  add column if not exists engine_version smallint not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.game_rooms'::regclass
      and conname='game_rooms_engine_version_check'
  ) then
    alter table public.game_rooms
      add constraint game_rooms_engine_version_check
      check (engine_version in (1,2));
  end if;
end
$$;

-- Validate game-specific room capacities at the database boundary.
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
    p_max_players,'waiting',coalesce(p_game_state,'{}'::jsonb),
    case when p_game_key in ('number','most','quiz','yesno','liar') then 2 else 1 end
  )
  returning * into v_room;

  insert into public.game_room_players(room_id,user_id,display_name,seat)
  values(v_room.id,auth.uid(),v_name,0);

  return v_room;
end;
$function$;

-- Keep join validation consistent with the profile constraint and room state.
create or replace function public.join_game_room(
  p_room_code text,
  p_display_name text
)
returns public.game_rooms
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_room public.game_rooms;
  v_count integer;
  v_seat integer;
  v_existing uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'يلزم تسجيل الدخول.' using errcode='42501';
  end if;

  v_name := btrim(coalesce(p_display_name,''));
  if char_length(v_name) not between 2 and 24 then
    raise exception 'اسم اللاعب يجب أن يكون بين حرفين و٢٤ حرفاً.';
  end if;

  select * into v_room
  from public.game_rooms
  where room_code=upper(btrim(coalesce(p_room_code,'')))
  for update;

  if not found then raise exception 'ما لقينا غرفة بهالرمز.'; end if;

  select id into v_existing
  from public.game_room_players
  where room_id=v_room.id and user_id=auth.uid();

  if found then return v_room; end if;
  if v_room.status<>'waiting' then
    raise exception 'اللعبة بلشت أو الغرفة منتهية.';
  end if;

  select count(*)::integer into v_count
  from public.game_room_players
  where room_id=v_room.id;

  if v_count>=v_room.max_players then raise exception 'الغرفة مكتملة.'; end if;

  select seats.seat into v_seat
  from generate_series(0,15) as seats(seat)
  where not exists(
    select 1 from public.game_room_players p
    where p.room_id=v_room.id and p.seat=seats.seat
  )
  order by seats.seat
  limit 1;

  if v_seat is null then raise exception 'ماكو مقعد متاح.'; end if;

  insert into public.game_room_players(room_id,user_id,display_name,seat)
  values(v_room.id,auth.uid(),v_name,v_seat);

  return v_room;
end;
$function$;

-- Require optimistic concurrency on EVERY room-state write. Never permit
-- changing the selected game after room creation or reopening a finished room.
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
declare
  v_room public.game_rooms;
  v_min integer;
  v_max integer;
  v_count integer;
  v_target_game text;
begin
  if auth.uid() is null then
    raise exception 'يلزم تسجيل الدخول.' using errcode='42501';
  end if;
  if p_expected_updated_at is null then
    raise exception 'يلزم إرسال إصدار حالة الغرفة لمنع الكتابة فوق تحديث لاعب آخر.'
      using errcode='22023';
  end if;
  if p_game_state is null or jsonb_typeof(p_game_state) is distinct from 'object'
     or pg_catalog.pg_column_size(p_game_state) > 65536 then
    raise exception 'حالة اللعبة غير صالحة أو أكبر من الحد المسموح.';
  end if;

  select * into v_room
  from public.game_rooms
  where id=p_room_id
  for update;

  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if not public.is_game_room_member(p_room_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if v_room.engine_version >= 2 then
    raise exception 'هذه الغرفة تعمل بمحرك خادمي؛ نفّذ الحركة عبر أمر اللعبة المعتمد.'
      using errcode='42501';
  end if;
  if v_room.status='finished' then
    raise exception 'الغرفة منتهية ولا تقبل تحديثات جديدة.';
  end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.'
      using errcode='40001';
  end if;

  v_target_game := coalesce(p_game_key,v_room.game_key);

  -- The wheel's deliberate hand-off is the only legal game-key transition.
  if v_target_game is distinct from v_room.game_key then
    if v_room.game_key<>'wheel'
       or v_room.status<>'playing'
       or p_status is distinct from 'waiting'
       or v_room.host_id<>auth.uid() then
      raise exception 'لا يمكن تغيير اللعبة بهذه الحالة.' using errcode='42501';
    end if;

    case v_target_game
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
      else raise exception 'اللعبة المختارة من الدولاب غير صالحة.';
    end case;

    select count(*)::integer into v_count
    from public.game_room_players where room_id=p_room_id;
    if v_count not between v_min and v_max then
      raise exception 'عدد اللاعبين الحالي لا يناسب اللعبة المختارة.';
    end if;
  elsif p_status is not null and p_status is distinct from v_room.status then
    if v_room.host_id<>auth.uid() then
      raise exception 'بدء الجولة وإنهاؤها من صلاحية المضيف فقط.'
        using errcode='42501';
    end if;
    if not (
      (v_room.status='waiting' and p_status='playing')
      or (v_room.status='playing' and p_status='finished')
    ) then
      raise exception 'انتقال حالة الغرفة غير مسموح.';
    end if;
  elsif p_status is not null and p_status not in ('waiting','playing','finished') then
    raise exception 'حالة الغرفة غير صالحة.';
  end if;

  if p_status='playing' and v_room.status='waiting' then
    v_min:=case v_target_game when 'liar' then 3 else 2 end;
    if (select count(*) from public.game_room_players where room_id=p_room_id)<v_min then
      raise exception 'عدد اللاعبين غير كافٍ لبدء هذه اللعبة.';
    end if;
  end if;

  update public.game_rooms
  set game_state=p_game_state,
      status=coalesce(p_status,status),
      game_key=v_target_game,
      engine_version=case when v_target_game in ('number','most','quiz','yesno','liar') then 2 else engine_version end,
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id
  returning * into v_room;

  return v_room;
end;
$function$;

-- Legacy clients still author game_state. Therefore no XP/achievements may
-- be awarded from those untrusted outcomes. The trigger stays installed so a
-- future engine-v2 implementation can restore rewards after server validation.
create or replace function public.award_completed_room_progress()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.engine_version < 2 then
    return new;
  end if;

  -- Engine v2 must replace this guarded body with verified event-ledger
  -- settlement before any engine-v2 room is allowed to complete.
  return new;
end;
$function$;

revoke all on function public.create_game_room(text,text,text,integer,jsonb,text) from public;
revoke all on function public.join_game_room(text,text) from public;
revoke all on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz) from public;
revoke all on function public.award_completed_room_progress() from public,anon,authenticated;
grant execute on function public.create_game_room(text,text,text,integer,jsonb,text) to authenticated;
grant execute on function public.join_game_room(text,text) to authenticated;
grant execute on function public.update_game_room_state(uuid,jsonb,text,text,timestamptz) to authenticated;

commit;
