CREATE OR REPLACE FUNCTION private.maybe_apply_table_flip(
  p_room_id uuid,
  p_actor_id uuid,
  p_game_key text,
  p_action text,
  p_state jsonb,
  p_engine_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_count integer:=0;
  v_player_count integer:=0;
  v_turn integer:=0;
  v_pick integer:=0;
  v_type text;
  v_title text;
  v_message text;
  v_target uuid;
  v_target_name text;
  v_challenge text;
  v_table jsonb;
  v_event jsonb;
  v_scores jsonb;
  v_feed jsonb;
BEGIN
  IF p_state->>'phase' IS DISTINCT FROM 'playing'
     OR coalesce((p_state->'tableFlip'->>'enabled')::boolean,true) IS NOT TRUE
     OR p_state->'tableFlip'->'activeChallenge'->>'status'='pending' THEN
    RETURN p_state;
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id;
  IF NOT FOUND OR v_room.game_started_at IS NULL THEN RETURN p_state; END IF;

  IF p_engine_version=2 THEN
    SELECT count(*)::integer INTO v_count
    FROM public.game_room_engine_events
    WHERE room_id=p_room_id AND event_type='number_guess'
      AND created_at>=v_room.game_started_at;
  ELSE
    SELECT count(*)::integer INTO v_count
    FROM public.game_room_action_events
    WHERE room_id=p_room_id AND created_at>=v_room.game_started_at
      AND action NOT IN ('start','upgrade','game-finished','wheel-enter','wheel-spin',
        'wheel-finish','wheel-back','wheel-again','wheel-select',
        'claim-table-flip-challenge','confirm-table-flip-challenge');
    v_count:=v_count+1;
  END IF;

  IF v_count=0 OR mod(v_count,4)<>0 THEN RETURN p_state; END IF;

  SELECT count(*)::integer INTO v_player_count
  FROM public.game_room_players WHERE room_id=p_room_id;
  IF v_player_count<2 THEN RETURN p_state; END IF;

  v_table:=coalesce(p_state->'tableFlip','{}'::jsonb);
  IF coalesce((v_table->>'doubleNext')::boolean,false) THEN RETURN p_state; END IF;

  IF p_game_key IN ('snakes','domino','tavla','colors') THEN
    v_pick:=get_byte(uuid_send(gen_random_uuid()),0)%2;
  ELSIF p_game_key IN ('quiz','yesno','number') THEN
    v_pick:=get_byte(uuid_send(gen_random_uuid()),0)%2;
  ELSE
    v_pick:=get_byte(uuid_send(gen_random_uuid()),0)%2;
  END IF;

  IF p_game_key IN ('snakes','domino','tavla','colors') AND v_pick=0 THEN
    v_turn:=coalesce((p_state->>'turn')::integer,0);
    v_turn:=mod(v_turn+1,v_player_count);
    p_state:=jsonb_set(p_state,'{turn}',to_jsonb(v_turn),true);
    v_type:='swap-turn';
    v_title:='قلبنا ترتيب الدور!';
    v_message:='مفاجأة! تخطّينا لاعب، والدور انتقل للاعب التالي. ركّزوا وياي!';
  ELSIF p_game_key IN ('quiz','yesno','number') AND v_pick=0 THEN
    v_type:='double-points';
    v_title:='النقاط الجاية مضاعفة!';
    v_message:='ضاعفنا النقاط! أول نقاط تنحسب بعد هالمفاجأة تصير ×٢.';
    v_table:=jsonb_set(v_table,'{doubleNext}','true'::jsonb,true);
  ELSIF p_game_key NOT IN ('snakes','domino','tavla','colors','quiz','yesno','number') AND v_pick=0 THEN
    SELECT user_id,display_name INTO v_target,v_target_name
    FROM public.game_room_players WHERE room_id=p_room_id
    ORDER BY gen_random_uuid() LIMIT 1;
    v_scores:=coalesce(p_state->'scores','{}'::jsonb);
    v_scores:=v_scores||jsonb_build_object(v_target::text,coalesce((v_scores->>v_target::text)::integer,0)+2);
    p_state:=jsonb_set(p_state,'{scores}',v_scores,true);
    v_type:='bonus-points';
    v_title:='نقاط مفاجئة!';
    v_message:='مفاجأة! '||coalesce(v_target_name,'لاعب')||' حصل على نقطتين إضافيتين.';
  ELSE
    SELECT user_id,display_name INTO v_target,v_target_name
    FROM public.game_room_players
    WHERE room_id=p_room_id
    ORDER BY gen_random_uuid()
    LIMIT 1;
    v_challenge:=(ARRAY[
      'اذكر خمس مدن عراقية خلال عشر ثواني.',
      'قلّد صوت مذيع رياضي لمدة خمس ثواني.',
      'اذكر ثلاث أكلات تبدأ بالحرف نفسه.',
      'احچي جملة من دون ما تستخدم حرف الألف.',
      'سمّ خمسة أشياء موجودة بالبيت بسرعة.'
    ])[1+(get_byte(uuid_send(gen_random_uuid()),1)%5)];
    v_type:='challenge';
    v_title:='تحدّي مفاجئ!';
    v_message:='التحدّي على '||coalesce(v_target_name,'لاعب')||': '||v_challenge;
    v_table:=jsonb_set(v_table,'{activeChallenge}',jsonb_build_object(
      'targetId',v_target::text,'targetName',v_target_name,'text',v_challenge,
      'bonus',2,'status','pending','claimedBy',null,'claimed',false
    ),true);
  END IF;

  v_event:=jsonb_build_object(
    'type',v_type,'title',v_title,'message',v_message,
    'actionNumber',v_count,'createdAt',pg_catalog.clock_timestamp()
  );
  v_table:=v_table||jsonb_build_object('enabled',true,'lastEvent',v_event,'actionCount',v_count);
  p_state:=jsonb_set(p_state,'{tableFlip}',v_table,true);
  v_feed:=coalesce(p_state->'feed','[]'::jsonb)||jsonb_build_array(v_message);
  p_state:=jsonb_set(p_state,'{feed}',v_feed,true);
  RETURN p_state;
END;
$function$;

REVOKE ALL ON FUNCTION private.maybe_apply_table_flip(uuid,uuid,text,text,jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.maybe_apply_table_flip(uuid,uuid,text,text,jsonb,smallint) TO service_role;

CREATE OR REPLACE FUNCTION public.engine_resolve_table_flip_challenge(
  p_room_id uuid,
  p_actor_id uuid,
  p_action text,
  p_expected_updated_at timestamptz
)
RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_state jsonb;
  v_table jsonb;
  v_challenge jsonb;
  v_scores jsonb;
  v_target uuid;
  v_name text;
  v_bonus integer;
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Engine gateway only.' USING errcode='42501';
  END IF;
  IF p_action NOT IN ('claim-table-flip-challenge','confirm-table-flip-challenge')
     OR p_room_id IS NULL OR p_actor_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'بيانات التحدي غير صالحة.' USING errcode='22023';
  END IF;
  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الغرفة غير موجودة.'; END IF;
  IF v_room.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' USING errcode='40001';
  END IF;
  IF v_room.engine_version NOT IN (2,3) OR v_room.status<>'playing'
     OR v_room.game_state->>'phase'<>'playing' THEN
    RAISE EXCEPTION 'التحدي غير متاح بهذه الحالة.' USING errcode='55000';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.game_room_players WHERE room_id=p_room_id AND user_id=p_actor_id) THEN
    RAISE EXCEPTION 'لست عضواً في هذه الغرفة.' USING errcode='42501';
  END IF;
  v_state:=v_room.game_state;
  v_table:=coalesce(v_state->'tableFlip','{}'::jsonb);
  v_challenge:=coalesce(v_table->'activeChallenge','{}'::jsonb);
  IF v_challenge->>'status'<>'pending' THEN
    RAISE EXCEPTION 'ماكو تحدّي ينتظر التأكيد حالياً.' USING errcode='55000';
  END IF;
  BEGIN
    v_target:=(v_challenge->>'targetId')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'بيانات صاحب التحدّي غير صالحة.' USING errcode='22023';
  END;
  SELECT display_name INTO v_name FROM public.game_room_players
  WHERE room_id=p_room_id AND user_id=p_actor_id;

  IF p_action='claim-table-flip-challenge' THEN
    IF v_target IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'هذا التحدّي مو مخصص إلك.' USING errcode='42501';
    END IF;
    IF coalesce((v_challenge->>'claimed')::boolean,false) THEN
      RAISE EXCEPTION 'أعلنت إنجاز التحدّي مسبقاً.' USING errcode='23505';
    END IF;
    v_challenge:=v_challenge||jsonb_build_object('claimed',true,'claimedBy',p_actor_id::text);
    v_state:=jsonb_set(v_state,'{tableFlip,activeChallenge}',v_challenge,true);
    v_state:=jsonb_set(v_state,'{feed}',coalesce(v_state->'feed','[]'::jsonb)||
      jsonb_build_array(coalesce(v_name,'اللاعب')||' أعلن إنه نفّذ التحدّي؛ ننتظر تأكيد الهوست.'),true);
  ELSE
    IF v_room.host_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'تأكيد التحدّي من صلاحية الهوست فقط.' USING errcode='42501';
    END IF;
    IF coalesce((v_challenge->>'claimed')::boolean,false) IS NOT TRUE
       OR v_challenge->>'claimedBy' IS DISTINCT FROM v_target::text THEN
      RAISE EXCEPTION 'اللاعب لازم يعلن إنجاز التحدّي أولاً.' USING errcode='55000';
    END IF;
    v_bonus:=greatest(1,least(5,coalesce((v_challenge->>'bonus')::integer,2)));
    v_scores:=coalesce(v_state->'scores','{}'::jsonb);
    v_scores:=v_scores||jsonb_build_object(v_target::text,
      coalesce((v_scores->>v_target::text)::integer,0)+v_bonus);
    v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    v_challenge:=v_challenge||jsonb_build_object('status','completed','confirmedBy',p_actor_id::text,'awarded',v_bonus);
    v_state:=jsonb_set(v_state,'{tableFlip,activeChallenge}',v_challenge,true);
    v_state:=jsonb_set(v_state,'{feed}',coalesce(v_state->'feed','[]'::jsonb)||
      jsonb_build_array(coalesce(v_challenge->>'targetName','اللاعب')||' كمل التحدّي وحصل على +'||v_bonus||' نقطة!'),true);
  END IF;

  UPDATE public.game_rooms SET game_state=v_state,updated_at=pg_catalog.clock_timestamp()
  WHERE id=p_room_id RETURNING * INTO v_room;
  INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
  VALUES(p_room_id,p_actor_id,v_room.game_key,p_action,jsonb_build_object('target_id',v_target));
  RETURN v_room;
END;
$function$;

REVOKE ALL ON FUNCTION public.engine_resolve_table_flip_challenge(uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.engine_resolve_table_flip_challenge(uuid,uuid,text,timestamptz) TO service_role;


CREATE OR REPLACE FUNCTION public.engine_v2_guess_number(p_room_id uuid, p_actor_id uuid, p_guess integer, p_expected_updated_at timestamp with time zone)
 RETURNS game_rooms
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_room public.game_rooms;
  v_secret integer;
  v_count integer;
  v_hint text;
  v_name text;
  v_tries jsonb;
  v_feed jsonb;
  v_board jsonb;
  v_state jsonb;
  v_won boolean;
  v_scores jsonb;
  v_multiplier integer:=1;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_guess is null or p_guess not between 1 and 100
     or p_expected_updated_at is null then
    raise exception 'أدخل رقماً من ١ إلى ١٠٠.' using errcode='22023';
  end if;
  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة اللعبة؛ حدّثها وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version<>2 or v_room.game_key<>'number' or v_room.status<>'playing' then
    raise exception 'محرك تخمين الرقم غير نشط لهذه الغرفة.';
  end if;
  if not exists (select 1 from public.game_room_players p
                 where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  if exists (
    select 1 from public.game_room_engine_events e
    where e.room_id=p_room_id and e.actor_id=p_actor_id
      and e.event_type='number_guess'
      and e.created_at>pg_catalog.clock_timestamp()-interval '750 milliseconds'
  ) then
    raise exception 'تمهّل قليلاً قبل التخمين التالي.' using errcode='P0001';
  end if;
  select (secret_state->>'number')::integer into v_secret
  from public.game_room_private_state where room_id=p_room_id for update;
  if v_secret is null then raise exception 'سر الجولة غير متاح؛ أعد إنشاء الجولة.'; end if;
  select p.display_name into v_name from public.game_room_players p
  where p.room_id=p_room_id and p.user_id=p_actor_id;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  v_tries:=coalesce(v_board->'tries','{}'::jsonb);
  v_count:=coalesce((v_tries->>p_actor_id::text)::integer,0)+1;
  v_tries:=v_tries||jsonb_build_object(p_actor_id::text,v_count);
  v_won:=p_guess=v_secret;
  v_hint:=case when v_won then 'صحيح! أصبت الرقم.'
    when p_guess<v_secret then 'الرقم أكبر من تخمينك.'
    else 'الرقم أصغر من تخمينك.' end;
  v_feed:=coalesce(v_room.game_state->'feed','[]'::jsonb)
    ||jsonb_build_array(v_name||' خمّن '||p_guess||'، '||v_hint);
  v_board:=jsonb_set(v_board,'{tries}',v_tries,true);
  v_board:=jsonb_set(v_board,'{hint}',to_jsonb(v_hint),true);
  v_board:=jsonb_set(v_board,'{last_guess}',to_jsonb(p_guess),true);
  v_board:=jsonb_set(v_board,'{last_guess_by}',to_jsonb(p_actor_id::text),true);
  if v_won then
    v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
    v_board:=jsonb_set(v_board,'{revealed_number}',to_jsonb(v_secret),true);
  end if;
  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',v_feed,true);
  v_multiplier:=case when coalesce((v_state->'tableFlip'->>'doubleNext')::boolean,false) then 2 else 1 end;
  IF v_won THEN
    v_scores:=coalesce(v_state->'scores','{}'::jsonb);
    v_scores:=v_scores||jsonb_build_object(p_actor_id::text,v_multiplier);
    v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    IF v_multiplier>1 THEN v_state:=jsonb_set(v_state,'{tableFlip,doubleNext}','false'::jsonb,true); END IF;
    v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
  END IF;
  insert into public.game_room_engine_events(room_id,actor_id,event_type,event_payload)
  values(p_room_id,p_actor_id,'number_guess',
    jsonb_build_object('guess',p_guess,'attempt',v_count,
      'result',case when v_won then 'correct' when p_guess<v_secret then 'higher' else 'lower' end));
  v_state:=private.maybe_apply_table_flip(p_room_id,p_actor_id,'number','guess-number',v_state,2);
  update public.game_rooms
  set game_state=v_state,status=case when v_won then 'finished' else status end,
      updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;
  if v_won then delete from public.game_room_private_state where room_id=p_room_id; end if;
  return v_room;
end;
$function$;

CREATE OR REPLACE FUNCTION public.engine_v3_apply_action(p_room_id uuid, p_actor_id uuid, p_action text, p_payload jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS game_rooms
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_room public.game_rooms;
  v_players uuid[];
  v_player_count integer;
  v_actor_index integer;
  v_turn integer;
  v_next_turn integer;
  v_candidate integer;
  v_action_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_state jsonb;
  v_board jsonb;
  v_feed jsonb;
  v_scores jsonb;
  v_positions jsonb;
  v_mine jsonb;
  v_off jsonb;
  v_new_mine jsonb;
  v_private jsonb;
  v_room_private jsonb;
  v_hand jsonb;
  v_stock jsonb;
  v_discard jsonb;
  v_chain jsonb;
  v_tile jsonb;
  v_left jsonb;
  v_right jsonb;
  v_card jsonb;
  v_top jsonb;
  v_deck jsonb;
  v_piece jsonb;
  v_question integer;
  v_dice integer;
  v_dice2 integer;
  v_old integer;
  v_new integer;
  v_selected integer;
  v_dest integer;
  v_index integer;
  v_side text;
  v_take integer;
  v_idx integer;
  v_color text;
  v_value text;
  v_text text;
  v_normalized text;
  v_answer_key text;
  v_stage text;
  v_target uuid;
  v_winner uuid;
  v_game text;
  v_status text;
  v_event_payload jsonb:='{}'::jsonb;
  v_seen timestamptz;
  v_ready boolean:=false;
  v_room_private_obj jsonb;
  v_rotation numeric;
  v_spin integer;
  v_multiplier integer:=1;
  v_choices text[]:=array['who','number','liar','yesno','most','snakes','domino','tavla','colors','quiz'];
  v_eligible_choices text[];
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_actor_id is null or p_room_id is null or p_action is null
     or jsonb_typeof(v_action_payload) is distinct from 'object'
     or pg_catalog.pg_column_size(v_action_payload)>8192
     or p_expected_updated_at is null then
    raise exception 'بيانات الحركة غير صالحة.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if not exists(
    select 1 from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=p_actor_id
  ) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;
  select array_agg(p.user_id order by p.seat),count(*)::integer
  into v_players,v_player_count
  from public.game_room_players p where p.room_id=p_room_id;
  if v_room.updated_at is distinct from p_expected_updated_at then
    raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
  end if;
  if v_room.engine_version=1 and p_action='upgrade' then
    if v_room.host_id is distinct from p_actor_id then raise exception 'ترقية الغرفة من صلاحية المضيف فقط.' using errcode='42501'; end if;
    if v_room.status in ('waiting','finished') then
      v_ready:=true;
    elsif v_room.status='playing' and v_room.game_key in ('who','most','yesno','quiz','liar') then
      if v_room.game_key='who' then
        select count(*)>=v_player_count into v_ready from jsonb_object_keys(coalesce(v_room.game_state->'board'->'guesses','{}'::jsonb));
      elsif v_room.game_key='most' then
        select count(*)>=v_player_count into v_ready from jsonb_object_keys(coalesce(v_room.game_state->'board'->'votes','{}'::jsonb));
      elsif v_room.game_key in ('yesno','quiz') then
        select count(*)>=v_player_count into v_ready from jsonb_object_keys(coalesce(v_room.game_state->'board'->'answers','{}'::jsonb));
      elsif v_room.game_key='liar' then
        select count(*)>=v_player_count into v_ready from jsonb_object_keys(coalesce(v_room.game_state->'board'->'votes','{}'::jsonb));
      end if;
    end if;
    if not coalesce(v_ready,false) then
      raise exception 'كمّلوا إجابات الجولة الحالية قبل ترقية الغرفة.' using errcode='55000';
    end if;
    v_game:=v_room.game_key;
    v_state:=jsonb_build_object('phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('تم تجهيز الغرفة للمحرك الخادمي الجديد.'),
      'board',case when v_game='number' then jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
        when v_game='wheel' then jsonb_build_object('rotation',0,'result',null,'spins',0,'stage','landing','spinning',false)
        else '{}'::jsonb end);
    update public.game_rooms set engine_version=case when v_game='number' then 2 else 3 end,
      status='waiting',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
      where id=p_room_id returning * into v_room;
    insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
      values(p_room_id,p_actor_id,v_game,'upgrade',jsonb_build_object('from_engine_version',1));
    return v_room;
  end if;
  if v_room.engine_version<>3 then raise exception 'هذه الغرفة ليست على محرك الإصدار الثالث.' using errcode='55000'; end if;
  if v_room.status='finished' then raise exception 'انتهت هذه الجولة.' using errcode='55000'; end if;

  update public.game_room_players set last_seen_at=pg_catalog.now()
  where room_id=p_room_id and user_id=p_actor_id;

  select array_agg(p.user_id order by p.seat),count(*)::integer
  into v_players,v_player_count
  from public.game_room_players p where p.room_id=p_room_id;
  v_actor_index:=array_position(v_players,p_actor_id)-1;
  v_state:=v_room.game_state;
  v_multiplier:=case when coalesce((v_state->'tableFlip'->>'doubleNext')::boolean,false) then 2 else 1 end;
  v_board:=coalesce(v_state->'board','{}'::jsonb);
  v_feed:=coalesce(v_state->'feed','[]'::jsonb);
  v_scores:=coalesce(v_state->'scores','{}'::jsonb);
  v_turn:=coalesce((v_state->>'turn')::integer,0);
  v_game:=v_room.game_key;
  v_status:=v_room.status;

  if p_action='start' then
    if v_room.host_id is distinct from p_actor_id then
      raise exception 'بدء اللعبة من صلاحية المضيف فقط.' using errcode='42501';
    end if;
    if v_room.status not in ('waiting','finished') then
      raise exception 'لا يمكن بدء جولة جديدة أثناء اللعب.' using errcode='55000';
    end if;
    if v_player_count < (case when v_game='liar' then 3 else 2 end) or v_player_count>v_room.max_players then
      raise exception 'عدد اللاعبين غير كافٍ لبدء اللعبة.';
    end if;

    delete from public.game_room_player_private_state where room_id=p_room_id;
    delete from public.game_room_private_state where room_id=p_room_id;

    v_scores:='{}'::jsonb;
    for v_idx in 1..v_player_count loop
      v_scores:=v_scores||jsonb_build_object(v_players[v_idx]::text,0);
    end loop;

    if v_game='snakes' then
      select coalesce(jsonb_agg(0 order by n),'[]'::jsonb) into v_positions
      from generate_series(1,v_player_count) n;
      v_board:=jsonb_build_object('positions',v_positions,'dice',null,'finished',null);
    elsif v_game='domino' then
      select jsonb_agg(jsonb_build_array(a,b) order by gen_random_uuid())
      into v_deck
      from generate_series(0,6) a
      cross join generate_series(a,6) b;
      v_take:=case when v_player_count=2 then 7 else 5 end;
      for v_idx in 1..v_player_count loop
        select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
        into v_hand
        from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
        where x.ordinality<=v_take;
        insert into public.game_room_player_private_state(room_id,user_id,private_state)
        values(p_room_id,v_players[v_idx],jsonb_build_object('hand',v_hand,'drawn',false));
        select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
        into v_deck
        from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
        where x.ordinality>v_take;
      end loop;
      insert into public.game_room_private_state(room_id,secret_state)
      values(p_room_id,jsonb_build_object('domino_draw',coalesce(v_deck,'[]'::jsonb)));
      v_board:=jsonb_build_object('chain','[]'::jsonb,'stock_count',jsonb_array_length(coalesce(v_deck,'[]'::jsonb)),'ended',false);
    elsif v_game='colors' then
      select jsonb_agg(jsonb_build_object('c',c,'v',v) order by gen_random_uuid())
      into v_deck
      from generate_series(1,3) copies
      cross join unnest(array['أحمر','أزرق','أخضر','أصفر']) c
      cross join unnest(array['١','٢','٣','٤','تخطي']) v;
      v_take:=7;
      for v_idx in 1..v_player_count loop
        select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
        into v_hand
        from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
        where x.ordinality<=v_take;
        insert into public.game_room_player_private_state(room_id,user_id,private_state)
        values(p_room_id,v_players[v_idx],jsonb_build_object('hand',v_hand,'drawn',false));
        select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
        into v_deck
        from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
        where x.ordinality>v_take;
      end loop;
      v_top:=v_deck->(jsonb_array_length(v_deck)-1);
      select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
      into v_stock
      from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
      where x.ordinality<jsonb_array_length(v_deck);
      insert into public.game_room_private_state(room_id,secret_state)
      values(p_room_id,jsonb_build_object('colors_draw',v_stock));
      v_board:=jsonb_build_object('discard',jsonb_build_array(v_top),'draw_count',jsonb_array_length(v_stock));
    elsif v_game='tavla' then
      v_positions:='[]'::jsonb;
      for v_idx in 0..1 loop
        v_mine:='[]'::jsonb;
        for v_candidate in 0..14 loop
          v_new:=case
            when v_idx=0 then case mod(v_candidate,4) when 0 then 0 when 1 then 11 when 2 then 16 else 18 end
            else case mod(v_candidate,4) when 0 then 23 when 1 then 12 when 2 then 7 else 5 end
          end;
          v_mine:=v_mine||jsonb_build_array(jsonb_build_object('point',v_new,'id',v_candidate));
        end loop;
        v_positions:=v_positions||jsonb_build_array(v_mine);
      end loop;
      v_board:=jsonb_build_object('positions',v_positions,'dice','[]'::jsonb,'selected',null,'moves',0,'off','[0,0]'::jsonb);
    elsif v_game='wheel' then
      v_board:=jsonb_build_object('rotation',0,'result',null,'spins',0,'stage','landing','spinning',false);
    elsif v_game in ('quiz','who','most','yesno','liar') then
      v_board:=jsonb_build_object(
        'question',0,'answers','{}'::jsonb,'guesses','{}'::jsonb,
        'votes','{}'::jsonb,'hints','{}'::jsonb,
        'stage',case when v_game='liar' then 'hints' else 'answers' end
      );
      if v_game='liar' then
        v_board:=jsonb_set(v_board,'{question_text}',to_jsonb('شاهد بطاقتك السرية. أعطوا تلميحاً من دون كشف الكلمة، ثم صوّتوا على الكذّاب.'::text),true);
        v_target:=v_players[1+(get_byte(uuid_send(gen_random_uuid()),0)%v_player_count)];
        v_text:=(array['بغداد','تمرة','دجلة','قهوة','نخلة','سفينة','قمر','مطر','مدرسة','أسد','بحر','صحراء'])[1+(get_byte(uuid_send(gen_random_uuid()),1)%12)];
        for v_idx in 1..v_player_count loop
          insert into public.game_room_player_private_state(room_id,user_id,private_state)
          values(p_room_id,v_players[v_idx],
            case when v_players[v_idx]=v_target
              then jsonb_build_object('role','liar','word',null,'hint','أنت الكذّاب؛ حاول تندمج مع البقية.')
              else jsonb_build_object('role','player','word',v_text,'hint','لا تكشف الكلمة؛ أعطِ تلميحاً مناسباً.')
            end);
        end loop;
      end if;
    else
      raise exception 'اللعبة غير مدعومة بالمحرك الخادمي.';
    end if;

    v_state:=jsonb_build_object(
      'phase','playing','round',1,'turn',0,'scores',v_scores,'feed',jsonb_build_array('بدأت اللعبة!'),'board',v_board
    );
    update public.game_rooms
    set status='playing',game_state=v_state,game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
    values(p_room_id,p_actor_id,v_game,'start',jsonb_build_object('players',v_player_count));
    return v_room;
  end if;

  if p_action in ('wheel-enter','wheel-spin','wheel-finish','wheel-back','wheel-again','wheel-select') then
    if v_game<>'wheel' then raise exception 'هذا الأمر خاص بالدولاب.' using errcode='22023'; end if;
    if p_action<>'wheel-finish' and v_room.host_id is distinct from p_actor_id then
      raise exception 'التحكم بالدولاب من صلاحية المضيف فقط.' using errcode='42501';
    end if;
    v_stage:=coalesce(v_board->>'stage','landing');

    if p_action='wheel-finish' then
      if coalesce((v_board->>'spinning')::boolean,false) is distinct from true
         or v_board->>'spinStartedAt' is null
         or (v_board->>'spinStartedAt')::timestamptz + make_interval(secs=>coalesce((v_board->>'spinDuration')::integer,6500)/1000.0) > pg_catalog.clock_timestamp() then
        raise exception 'لم تكتمل لفة الدولاب بعد.' using errcode='55000';
      end if;
      v_board:=jsonb_set(v_board - 'pending_result','{result}',to_jsonb(v_board->>'pending_result'),true);
      v_board:=jsonb_set(v_board,'{spinning}','false'::jsonb,true);
      v_board:=jsonb_set(v_board,'{stage}',to_jsonb('result'::text),true);
    elsif p_action='wheel-enter' then
      if v_stage<>'landing' then raise exception 'الدولاب ليس في الواجهة الرئيسية.'; end if;
      v_board:=jsonb_set(v_board,'{stage}',to_jsonb('arena'::text),true);
    elsif p_action='wheel-spin' then
      if v_stage<>'arena' then raise exception 'ادخل ساحة الدولاب أولاً.'; end if;
      select array_agg(c.choice order by c.ordinality) into v_eligible_choices
      from unnest(v_choices) with ordinality as c(choice,ordinality)
      where v_player_count between
        (case c.choice when 'liar' then 3 else 2 end)
        and
        (case c.choice when 'number' then 8 when 'snakes' then 6 when 'domino' then 4 when 'tavla' then 2 when 'colors' then 8 when 'quiz' then 12 when 'who' then 12 when 'yesno' then 12 when 'most' then 12 else 16 end);
      if coalesce(array_length(v_eligible_choices,1),0)=0 then
        raise exception 'ماكو لعبة مناسبة لعدد اللاعبين الحالي.' using errcode='55000';
      end if;
      v_index:=get_byte(uuid_send(gen_random_uuid()),0)%array_length(v_eligible_choices,1);
      v_spin:=coalesce((v_board->>'spins')::integer,0)+1;
      v_selected:=array_position(v_choices,v_eligible_choices[v_index+1])-1;
      v_rotation:=coalesce((v_board->>'rotation')::numeric,0)+360*(7+(get_byte(uuid_send(gen_random_uuid()),1)%3))
        +((360-((coalesce((v_board->>'rotation')::numeric,0)+(v_selected+0.5)*(360.0/array_length(v_choices,1)))::numeric % 360)) % 360);
      v_board:=jsonb_set(v_board,'{spinning}',to_jsonb(true),true);
      v_board:=jsonb_set(v_board,'{result}','null'::jsonb,true);
      v_board:=jsonb_set(v_board,'{eligibleGames}',to_jsonb(v_eligible_choices),true);
      v_board:=jsonb_set(v_board,'{pending_result}',to_jsonb(v_eligible_choices[v_index+1]),true);
      v_board:=jsonb_set(v_board,'{startRotation}',to_jsonb(coalesce((v_board->>'rotation')::numeric,0)),true);
      v_board:=jsonb_set(v_board,'{rotation}',to_jsonb(v_rotation),true);
      v_board:=jsonb_set(v_board,'{spins}',to_jsonb(v_spin),true);
      v_board:=jsonb_set(v_board,'{stage}',to_jsonb('arena'::text),true);
      v_board:=jsonb_set(v_board,'{spinStartedAt}',to_jsonb(pg_catalog.clock_timestamp()),true);
      v_board:=jsonb_set(v_board,'{spinDuration}',to_jsonb(6500),true);
      v_feed:=v_feed||jsonb_build_array('بدأت اللفة الخادمية للدولاب.');
    elsif p_action='wheel-back' then
      if coalesce((v_board->>'spinning')::boolean,false) then raise exception 'انتظر اكتمال لفة الدولاب أولاً.'; end if;
      if v_stage not in ('arena','result') then raise exception 'لا يمكن الرجوع الآن.'; end if;
      v_board:=jsonb_set(v_board,'{result}','null'::jsonb,true);
      v_board:=jsonb_set(v_board,'{stage}',to_jsonb('landing'::text),true);
    elsif p_action='wheel-again' then
      if coalesce((v_board->>'spinning')::boolean,false) then raise exception 'اللفة الحالية لم تكتمل بعد.'; end if;
      if v_stage<>'result' then raise exception 'لا توجد نتيجة لإعادتها.'; end if;
      v_board:=jsonb_set(v_board,'{result}','null'::jsonb,true);
      v_board:=jsonb_set(v_board,'{stage}',to_jsonb('arena'::text),true);
    elsif p_action='wheel-select' then
      if v_stage<>'result' then raise exception 'لا توجد لعبة مختارة لاعتمادها.'; end if;
      v_game:=v_board->>'result';
      select array_agg(c.choice order by c.ordinality) into v_eligible_choices
      from unnest(v_choices) with ordinality as c(choice,ordinality)
      where v_player_count between
        (case c.choice when 'liar' then 3 else 2 end)
        and
        (case c.choice when 'number' then 8 when 'snakes' then 6 when 'domino' then 4 when 'tavla' then 2 when 'colors' then 8 when 'quiz' then 12 when 'who' then 12 when 'yesno' then 12 when 'most' then 12 else 16 end);
      if not (v_game=any(coalesce(v_eligible_choices,array[]::text[]))) then
        raise exception 'اللعبة المختارة لا تناسب عدد اللاعبين الحالي.' using errcode='22023';
      end if;
      v_state:=jsonb_build_object(
        'phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
        'feed',jsonb_build_array('اختار الدولاب لعبة جديدة: '||v_game),
        'board',case when v_game='number'
          then jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
          when v_game='wheel' then jsonb_build_object('rotation',0,'result',null,'spins',0,'stage','landing')
          else '{}'::jsonb end
      );
      update public.game_rooms
      set game_key=v_game,engine_version=case when v_game='number' then 2 else 3 end,
          status='waiting',game_state=v_state,updated_at=pg_catalog.clock_timestamp()
      where id=p_room_id returning * into v_room;
      insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
      values(p_room_id,p_actor_id,'wheel','wheel-select',jsonb_build_object('selected_game',v_game));
      return v_room;
    end if;

    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',v_feed,true);
    update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
    values(p_room_id,p_actor_id,v_game,p_action,'{}'::jsonb);
    return v_room;
  end if;

  if v_room.status<>'playing' or v_state->>'phase'<>'playing' then
    raise exception 'اللعبة ليست في حالة لعب.' using errcode='55000';
  end if;

  -- The ordered seat array is authoritative. Skip seats whose heartbeat expired,
  -- but keep the seat itself so the player can reconnect to the same match.
  v_next_turn:=mod(v_turn+1,v_player_count);
  for v_idx in 1..v_player_count loop
    v_candidate:=mod(v_turn+v_idx,v_player_count);
    select p.last_seen_at into v_seen
    from public.game_room_players p
    where p.room_id=p_room_id and p.user_id=v_players[v_candidate+1];
    if v_seen>pg_catalog.now()-interval '90 seconds' then
      v_next_turn:=v_candidate;
      exit;
    end if;
  end loop;

  if p_action='roll' and v_game='snakes' then
    if v_actor_index<>v_turn then raise exception 'مو دورك حالياً.' using errcode='42501'; end if;
    v_dice:=1+(get_byte(uuid_send(gen_random_uuid()),0)%6);
    v_positions:=v_board->'positions';
    v_old:=coalesce((v_positions->>v_actor_index)::integer,0);
    v_new:=case when v_old+v_dice>100 then v_old else v_old+v_dice end;
    v_new:=case v_new
      when 3 then 22 when 8 then 30 when 20 then 41 when 27 then 56
      when 50 then 67 when 71 then 91 when 80 then 99
      when 17 then 4 when 34 then 12 when 62 then 19 when 87 then 24 when 95 then 75 when 99 then 78
      else v_new end;
    v_positions:=jsonb_set(v_positions,array[v_actor_index::text],to_jsonb(v_new),false);
    v_board:=jsonb_set(v_board,'{positions}',v_positions,true);
    v_board:=jsonb_set(v_board,'{dice}',to_jsonb(v_dice),true);
    v_feed:=v_feed||jsonb_build_array((select p.display_name from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id)||' رمى '||v_dice||' ووصل إلى '||v_new);
    if v_new=100 then
      v_board:=jsonb_set(v_board,'{finished}',to_jsonb(v_actor_index),true);
      v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
      v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
      v_status:='finished';
      v_event_payload:=jsonb_build_object('winner_id',p_actor_id,'position',100);
    else
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_next_turn),true);
    end if;

  elsif p_action in ('play-domino','draw-domino','pass-domino') and v_game='domino' then
    if v_actor_index<>v_turn then raise exception 'مو دورك حالياً.' using errcode='42501'; end if;
    select ps.private_state into v_private
    from public.game_room_player_private_state ps
    where ps.room_id=p_room_id and ps.user_id=p_actor_id
    for update;
    if v_private is null then raise exception 'يدك غير متاحة؛ أعد مزامنة الغرفة.'; end if;
    v_hand:=coalesce(v_private->'hand','[]'::jsonb);
    select pr.secret_state into v_room_private
    from public.game_room_private_state pr where pr.room_id=p_room_id for update;
    if v_room_private is null then raise exception 'مخزون الدومينوا غير متاح.'; end if;
    v_stock:=coalesce(v_room_private->'domino_draw','[]'::jsonb);

    if p_action='draw-domino' then
      if jsonb_array_length(v_stock)=0 then raise exception 'خلص مخزون السحب.'; end if;
      v_tile:=v_stock->(jsonb_array_length(v_stock)-1);
      select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_stock
      from jsonb_array_elements(v_stock) with ordinality x(value,ordinality)
      where x.ordinality<jsonb_array_length(v_stock);
      v_hand:=v_hand||jsonb_build_array(v_tile);
      update public.game_room_private_state
      set secret_state=jsonb_set(v_room_private,'{domino_draw}',v_stock,true),updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id;
      update public.game_room_player_private_state
      set private_state=jsonb_set(v_private,'{hand}',v_hand,true),updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id and user_id=p_actor_id;
      v_board:=jsonb_set(v_board,'{stock_count}',to_jsonb(jsonb_array_length(v_stock)),true);
      v_feed:=v_feed||jsonb_build_array('سحب لاعب قطعة من المخزون.');
    elsif p_action='pass-domino' then
      if jsonb_array_length(v_stock)>0 then raise exception 'ما زال مخزون السحب متاحاً؛ اسحب قطعة أولاً.'; end if;
      v_chain:=coalesce(v_board->'chain','[]'::jsonb);
      if jsonb_array_length(v_chain)=0 then raise exception 'ابدأ السلسلة بقطعة من يدك.'; end if;
      v_left:=v_chain->0;
      v_right:=v_chain->(jsonb_array_length(v_chain)-1);
      if exists(
        select 1 from jsonb_array_elements(v_hand) h
        where (h->>0)::integer in ((v_left->>0)::integer,(v_right->>1)::integer)
           or (h->>1)::integer in ((v_left->>0)::integer,(v_right->>1)::integer)
      ) then raise exception 'عندك قطعة تگدر تلعبها؛ ما يصير تمرّر الدور.'; end if;
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_next_turn),true);
      v_feed:=v_feed||jsonb_build_array('مرّر لاعب دوره بعد انتهاء مخزون السحب.');
    else
      v_index:=coalesce((v_action_payload->>'index')::integer,-1);
      if v_index<0 or v_index>=jsonb_array_length(v_hand) then raise exception 'اختيار القطعة غير صالح.'; end if;
      v_tile:=v_hand->v_index;
      v_chain:=coalesce(v_board->'chain','[]'::jsonb);
      v_side:='right';
      -- Match and orient against both open ends.
      if jsonb_array_length(v_chain)>0 then
        v_left:=v_chain->0;
        v_right:=v_chain->(jsonb_array_length(v_chain)-1);
        v_old:=(v_left->>0)::integer;
        v_new:=(v_right->>1)::integer;
        if (v_tile->>0)::integer=v_new then
          v_side:='right';
        elsif (v_tile->>1)::integer=v_new then
          v_tile:=jsonb_build_array(v_tile->1,v_tile->0);
          v_side:='right';
        elsif (v_tile->>1)::integer=v_old then
          v_side:='left';
        elsif (v_tile->>0)::integer=v_old then
          v_tile:=jsonb_build_array(v_tile->1,v_tile->0);
          v_side:='left';
        else
          raise exception 'هاي القطعة ما تطابق طرف السلسلة.';
        end if;
      end if;
      if v_side='left' then v_chain:=jsonb_build_array(v_tile)||v_chain;
      else v_chain:=v_chain||jsonb_build_array(v_tile); end if;
      select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_hand
      from jsonb_array_elements(v_hand) with ordinality x(value,ordinality)
      where x.ordinality<>v_index+1;
      update public.game_room_player_private_state
      set private_state=jsonb_set(v_private,'{hand}',v_hand,true),updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id and user_id=p_actor_id;
      v_board:=jsonb_set(v_board,'{chain}',v_chain,true);
      v_feed:=v_feed||jsonb_build_array('لعب لاعب قطعة دومينوا.');
      if jsonb_array_length(v_hand)=0 then
        v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
        v_status:='finished';
        v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
        v_board:=jsonb_set(v_board,'{ended}',to_jsonb(true),true);
        v_event_payload:=jsonb_build_object('winner_id',p_actor_id,'reason','empty_hand');
      else
        v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_next_turn),true);
      end if;
    end if;

  elsif p_action in ('play-color','draw-color','pass-color') and v_game='colors' then
    if v_actor_index<>v_turn then raise exception 'مو دورك حالياً.' using errcode='42501'; end if;
    select ps.private_state into v_private
    from public.game_room_player_private_state ps
    where ps.room_id=p_room_id and ps.user_id=p_actor_id for update;
    if v_private is null then raise exception 'يدك غير متاحة؛ أعد مزامنة الغرفة.'; end if;
    v_hand:=coalesce(v_private->'hand','[]'::jsonb);
    select pr.secret_state into v_room_private
    from public.game_room_private_state pr where pr.room_id=p_room_id for update;
    v_stock:=coalesce(v_room_private->'colors_draw','[]'::jsonb);
    v_discard:=coalesce(v_board->'discard','[]'::jsonb);

    if p_action='draw-color' then
      if coalesce((v_private->>'drawn')::boolean,false) then
        raise exception 'سحبت كارتاً بالفعل؛ العب أو مرّر الدور.';
      end if;
      if jsonb_array_length(v_stock)=0 and jsonb_array_length(v_discard)>1 then
        v_top:=v_discard->(jsonb_array_length(v_discard)-1);
        select coalesce(jsonb_agg(x.value order by gen_random_uuid()),'[]'::jsonb)
        into v_stock
        from jsonb_array_elements(v_discard) with ordinality x(value,ordinality)
        where x.ordinality<jsonb_array_length(v_discard);
        v_discard:=jsonb_build_array(v_top);
        v_board:=jsonb_set(v_board,'{discard}',v_discard,true);
      end if;
      if jsonb_array_length(v_stock)=0 then raise exception 'ما بقت كروت للسحب.'; end if;
      v_card:=v_stock->(jsonb_array_length(v_stock)-1);
      select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_stock
      from jsonb_array_elements(v_stock) with ordinality x(value,ordinality)
      where x.ordinality<jsonb_array_length(v_stock);
      v_hand:=v_hand||jsonb_build_array(v_card);
      update public.game_room_private_state
      set secret_state=jsonb_set(v_room_private,'{colors_draw}',v_stock,true),updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id;
      update public.game_room_player_private_state
      set private_state=jsonb_set(jsonb_set(v_private,'{hand}',v_hand,true),'{drawn}','true'::jsonb,true),
          updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id and user_id=p_actor_id;
      v_board:=jsonb_set(v_board,'{draw_count}',to_jsonb(jsonb_array_length(v_stock)),true);
      v_feed:=v_feed||jsonb_build_array('سحب لاعب كارتاً.');
    elsif p_action='pass-color' then
      if coalesce((v_private->>'drawn')::boolean,false) is distinct from true then
        raise exception 'اسحب كارتاً أولاً قبل تمرير الدور.';
      end if;
      update public.game_room_player_private_state
      set private_state=jsonb_set(v_private,'{drawn}','false'::jsonb,true),updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id and user_id=p_actor_id;
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_next_turn),true);
    else
      v_index:=coalesce((v_action_payload->>'index')::integer,-1);
      if v_index<0 or v_index>=jsonb_array_length(v_hand) then raise exception 'اختيار الكارت غير صالح.'; end if;
      v_card:=v_hand->v_index;
      v_top:=v_discard->(jsonb_array_length(v_discard)-1);
      if jsonb_array_length(v_discard)>0
         and v_card->>'c' is distinct from v_top->>'c'
         and v_card->>'v' is distinct from v_top->>'v' then
        raise exception 'اختار كارت يطابق اللون أو الرقم.';
      end if;
      select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_hand
      from jsonb_array_elements(v_hand) with ordinality x(value,ordinality)
      where x.ordinality<>v_index+1;
      v_discard:=v_discard||jsonb_build_array(v_card);
      update public.game_room_player_private_state
      set private_state=jsonb_set(jsonb_set(v_private,'{hand}',v_hand,true),'{drawn}','false'::jsonb,true),
          updated_at=pg_catalog.clock_timestamp()
      where room_id=p_room_id and user_id=p_actor_id;
      v_board:=jsonb_set(v_board,'{discard}',v_discard,true);
      v_feed:=v_feed||jsonb_build_array('لعب لاعب كارتاً.');
      if jsonb_array_length(v_hand)=0 then
        v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
        v_status:='finished';
        v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
        v_event_payload:=jsonb_build_object('winner_id',p_actor_id,'reason','empty_hand');
      else
        v_candidate:=case when v_card->>'v'='تخطي' then mod(v_next_turn+1,v_player_count) else v_next_turn end;
        v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_candidate),true);
      end if;
    end if;

  elsif p_action in ('roll','select-piece','move-piece') and v_game='tavla' then
    if v_actor_index<>v_turn then raise exception 'مو دورك حالياً.' using errcode='42501'; end if;
    v_positions:=coalesce(v_board->'positions','[]'::jsonb);
    v_mine:=v_positions->v_actor_index;
    if p_action='roll' then
      if jsonb_array_length(coalesce(v_board->'dice','[]'::jsonb))>0 then
        raise exception 'استخدم نتيجة النرد الحالية أولاً.';
      end if;
      v_dice:=1+(get_byte(uuid_send(gen_random_uuid()),0)%6);
      v_dice2:=1+(get_byte(uuid_send(gen_random_uuid()),1)%6);
      v_board:=jsonb_set(v_board,'{dice}',jsonb_build_array(v_dice,v_dice2),true);
      v_board:=jsonb_set(v_board,'{selected}','null'::jsonb,true);
      v_feed:=v_feed||jsonb_build_array('رمى لاعب النرد.');
    elsif p_action='select-piece' then
      if jsonb_array_length(coalesce(v_board->'dice','[]'::jsonb))=0 then raise exception 'ارمِ النرد أولاً.'; end if;
      v_selected:=coalesce((v_action_payload->>'point')::integer,-1);
      if not exists(select 1 from jsonb_array_elements(v_mine) x where (x->>'point')::integer=v_selected) then
        raise exception 'ماكو قطعة إلك بهالنقطة.';
      end if;
      v_board:=jsonb_set(v_board,'{selected}',to_jsonb(v_selected),true);
    else
      if jsonb_array_length(coalesce(v_board->'dice','[]'::jsonb))=0 or v_board->>'selected' is null then
        raise exception 'اختار قطعة بعد رمية النرد.';
      end if;
      v_selected:=(v_board->>'selected')::integer;
      v_dice:=(v_board->'dice'->>0)::integer;
      v_dest:=case when v_actor_index=0 then v_selected+v_dice else v_selected-v_dice end;
      if coalesce((v_action_payload->>'destination')::integer,-1)<>v_dest then
        raise exception 'الوجهة لا تطابق نتيجة النرد.';
      end if;
      if (v_dest>23 and v_actor_index<>0) or (v_dest<0 and v_actor_index<>1) then
        raise exception 'اتجاه إخراج القطعة غير صحيح.';
      end if;
      v_new_mine:='[]'::jsonb;
      v_seen:=null;
      for v_piece in select value from jsonb_array_elements(v_mine) loop
        if v_seen is null and (v_piece->>'point')::integer=v_selected then
          if v_dest between 0 and 23 then
            v_new_mine:=v_new_mine||jsonb_build_array(jsonb_set(v_piece,'{point}',to_jsonb(v_dest),true));
          end if;
          v_seen:=pg_catalog.now();
        else
          v_new_mine:=v_new_mine||jsonb_build_array(v_piece);
        end if;
      end loop;
      if v_seen is null then raise exception 'القطعة المختارة غير موجودة.'; end if;
      v_positions:=jsonb_set(v_positions,array[v_actor_index::text],v_new_mine,true);
      v_stock:=v_board->'dice';
      select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_deck
      from jsonb_array_elements(v_stock) with ordinality x(value,ordinality)
      where x.ordinality>1;
      v_board:=jsonb_set(v_board,'{positions}',v_positions,true);
      v_board:=jsonb_set(v_board,'{dice}',v_deck,true);
      v_board:=jsonb_set(v_board,'{selected}','null'::jsonb,true);
      v_board:=jsonb_set(v_board,'{moves}',to_jsonb(coalesce((v_board->>'moves')::integer,0)+1),true);
      if v_dest<0 or v_dest>23 then
        v_off:=coalesce(v_board->'off','[0,0]'::jsonb);
        v_off:=jsonb_set(v_off,array[v_actor_index::text],to_jsonb(coalesce((v_off->>v_actor_index)::integer,0)+1),true);
        v_board:=jsonb_set(v_board,'{off}',v_off,true);
        v_feed:=v_feed||jsonb_build_array('أخرج لاعب قطعة من المسار.');
        if (v_off->>v_actor_index)::integer>=15 then
          v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
          v_status:='finished';
          v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(p_actor_id::text),true);
          v_event_payload:=jsonb_build_object('winner_id',p_actor_id,'reason','all_pieces_borne_off');
        end if;
      else
        v_feed:=v_feed||jsonb_build_array('حرّك لاعب قطعة حسب نتيجة النرد.');
      end if;
      if v_status<>'finished' and jsonb_array_length(v_deck)=0 then
        v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_next_turn),true);
      end if;
    end if;

  elsif p_action='submit' and v_game in ('quiz','who','most','yesno','liar') then
    v_text:=btrim(coalesce(v_action_payload->>'value',''));
    if char_length(v_text) not between 1 and 120 then raise exception 'الإجابة يجب أن تكون بين حرف واحد و١٢٠ حرفاً.'; end if;
    v_stage:=coalesce(v_board->>'stage','answers');
    if v_game='liar' and v_stage='votes' then
      begin v_target:=(v_text)::uuid;
      exception when others then raise exception 'اختار لاعباً من قائمة الموجودين.'; end;
      if not (v_target=any(v_players)) or v_target=p_actor_id then
        raise exception 'التصويت لازم يكون للاعب آخر موجود بالغرفة.';
      end if;
      v_answer_key:='votes';
    elsif v_game='liar' then
      v_answer_key:='hints';
    elsif v_game='who' then v_answer_key:='guesses';
    elsif v_game='most' then
      begin v_target:=(v_text)::uuid;
      exception when others then raise exception 'اختار لاعباً من قائمة الربع.'; end;
      if not (v_target=any(v_players)) then raise exception 'التصويت لازم يكون للاعب داخل الغرفة.'; end if;
      v_answer_key:='votes';
    else v_answer_key:='answers';
    end if;

    v_private:=coalesce(v_board->v_answer_key,'{}'::jsonb);
    if v_private ? p_actor_id::text then raise exception 'وصلت إجابتك بالفعل بهالجولة.' using errcode='23505'; end if;

    v_normalized:=regexp_replace(lower(v_text),'[[:space:]ًٌٍَُِّْٰـ]','','g');
    if v_game='quiz' then
      v_question:=coalesce((v_board->>'question')::integer,0);
      if (v_question=0 and v_normalized='بغداد')
         or (v_question=1 and v_normalized=any(array['7','٧','سبعة','سبع']))
         or (v_question=2 and v_normalized=any(array['المشتري','مشتري'])) then
        v_scores:=v_scores||jsonb_build_object(p_actor_id::text,coalesce((v_scores->>p_actor_id::text)::integer,0)+v_multiplier);
        v_event_payload:=jsonb_build_object('correct',true,'question',v_question);
      else
        v_event_payload:=jsonb_build_object('correct',false,'question',v_question);
      end if;
      v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    elsif v_game='yesno' then
      if position('اي' in v_normalized)>0 or position('إي' in v_normalized)>0
         or position('لا' in v_normalized)>0 or position('نعم' in v_normalized)>0 then
        v_event_payload:=jsonb_build_object('caught',true,'player_id',p_actor_id);
        v_scores:=v_scores||jsonb_build_object(p_actor_id::text,greatest(0,coalesce((v_scores->>p_actor_id::text)::integer,0)-v_multiplier));
      else
        v_event_payload:=jsonb_build_object('caught',false,'player_id',p_actor_id);
        v_scores:=v_scores||jsonb_build_object(p_actor_id::text,coalesce((v_scores->>p_actor_id::text)::integer,0)+v_multiplier);
      end if;
      v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    end if;

    if v_multiplier>1 and v_game in ('quiz','yesno') then
      v_state:=jsonb_set(v_state,'{tableFlip,doubleNext}','false'::jsonb,true);
    end if;

    v_board:=jsonb_set(v_board,array[v_answer_key],v_private||jsonb_build_object(p_actor_id::text,case when v_answer_key='votes' and v_game in ('liar','most') then v_target::text else v_text end),true);
    v_feed:=v_feed||jsonb_build_array('سجّل لاعب إجابته.');
  elsif p_action='advance-vote' and v_game='liar' then
    if v_room.host_id is distinct from p_actor_id then raise exception 'المضيف فقط يگدر ينقل اللعبة للتصويت.' using errcode='42501'; end if;
    if coalesce(v_board->>'stage','hints')<>'hints' then raise exception 'مرحلة التلميحات انتهت.'; end if;
    if (select count(*) from jsonb_object_keys(coalesce(v_board->'hints','{}'::jsonb)))<v_player_count then
      raise exception 'انتظر تلميحات كل اللاعبين قبل التصويت.';
    end if;
    v_board:=jsonb_set(v_board,'{stage}',to_jsonb('votes'::text),true);
    v_feed:=v_feed||jsonb_build_array('بدأ التصويت على المشتبه به.');
  elsif p_action='next-round' and v_game in ('quiz','who','most','yesno','liar') then
    if v_room.host_id is distinct from p_actor_id then raise exception 'المضيف فقط يگدر يبدأ الجولة التالية.' using errcode='42501'; end if;
    if v_game='liar' then
      if coalesce(v_board->>'stage','hints')<>'votes'
         or (select count(*) from jsonb_object_keys(coalesce(v_board->'votes','{}'::jsonb)))<v_player_count then
        raise exception 'كمّلوا التصويت قبل الجولة التالية.';
      end if;
      v_board:=jsonb_set(v_board,'{hints}','{}'::jsonb,true);
      v_board:=jsonb_set(v_board,'{votes}','{}'::jsonb,true);
      v_board:=jsonb_set(v_board,'{stage}',to_jsonb('hints'::text),true);
      delete from public.game_room_player_private_state where room_id=p_room_id;
      v_target:=v_players[1+(get_byte(uuid_send(gen_random_uuid()),0)%v_player_count)];
      v_text:=(array['بغداد','تمرة','دجلة','قهوة','نخلة','سفينة','قمر','مطر','مدرسة','أسد','بحر','صحراء'])[1+(get_byte(uuid_send(gen_random_uuid()),1)%12)];
      for v_idx in 1..v_player_count loop
        insert into public.game_room_player_private_state(room_id,user_id,private_state)
        values(p_room_id,v_players[v_idx],
          case when v_players[v_idx]=v_target
            then jsonb_build_object('role','liar','word',null,'hint','أنت الكذّاب؛ حاول تندمج مع البقية.')
            else jsonb_build_object('role','player','word',v_text,'hint','لا تكشف الكلمة؛ أعطِ تلميحاً مناسباً.')
          end);
      end loop;
      v_state:=jsonb_set(v_state,'{round}',to_jsonb(coalesce((v_state->>'round')::integer,1)+1),true);
    else
      v_question:=coalesce((v_board->>'question')::integer,0);
      if v_game='quiz' and v_question>=2 then
        v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
        v_status:='finished';
        v_event_payload:=jsonb_build_object('completed',true,'scores',v_scores);
      else
        v_board:=jsonb_set(v_board,'{question}',to_jsonb(v_question+1),true);
        v_board:=jsonb_set(v_board,'{answers}','{}'::jsonb,true);
        v_board:=jsonb_set(v_board,'{votes}','{}'::jsonb,true);
        v_board:=jsonb_set(v_board,'{guesses}','{}'::jsonb,true);
        v_state:=jsonb_set(v_state,'{round}',to_jsonb(coalesce((v_state->>'round')::integer,1)+1),true);
      end if;
    end if;
    v_feed:=v_feed||jsonb_build_array('بدأت جولة جديدة.');

  else
    raise exception 'الحركة غير مدعومة لهذه اللعبة.' using errcode='22023';
  end if;

  v_state:=jsonb_set(v_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{feed}',v_feed,true);
  v_state:=private.maybe_apply_table_flip(p_room_id,p_actor_id,v_game,p_action,v_state,3);

  insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
  values(p_room_id,p_actor_id,v_game,p_action,v_event_payload);

  -- Write proof before the room update so the AFTER trigger can verify it.
  if v_status='finished' and v_event_payload ? 'winner_id' then
    insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
    values(p_room_id,p_actor_id,v_game,'game-finished',v_event_payload);
  elsif v_status='finished' and v_game='quiz' and v_event_payload->>'completed'='true' then
    insert into public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
    values(p_room_id,p_actor_id,v_game,'game-finished',v_event_payload);
  end if;

  update public.game_rooms
  set game_state=v_state,status=v_status,updated_at=pg_catalog.clock_timestamp()
  where id=p_room_id returning * into v_room;

  return v_room;
end;
$function$;
