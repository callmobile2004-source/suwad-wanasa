CREATE OR REPLACE FUNCTION private.tavla_can_move_from(
  p_points jsonb,p_bar jsonb,p_player integer,p_from integer,p_die integer
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $canfrom$
DECLARE
  v_target integer;
  v_source jsonb;
  v_dest jsonb;
  v_all_home boolean;
  v_farther boolean;
BEGIN
  IF p_player NOT IN (0,1) OR p_die NOT BETWEEN 1 AND 6 THEN RETURN false; END IF;
  IF COALESCE((p_bar->>p_player)::integer,0)>0 THEN
    IF p_from<>-1 THEN RETURN false; END IF;
    v_target:=CASE WHEN p_player=0 THEN 24-p_die ELSE p_die-1 END;
  ELSE
    IF p_from NOT BETWEEN 0 AND 23 THEN RETURN false; END IF;
    v_source:=p_points->p_from;
    IF v_source->>'owner' IS DISTINCT FROM p_player::text
       OR COALESCE((v_source->>'count')::integer,0)<1 THEN RETURN false; END IF;
    v_target:=CASE WHEN p_player=0 THEN p_from-p_die ELSE p_from+p_die END;
  END IF;
  IF v_target BETWEEN 0 AND 23 THEN
    v_dest:=p_points->v_target;
    RETURN COALESCE((v_dest->>'count')::integer,0)<2
      OR v_dest->>'owner' IS NULL
      OR (v_dest->>'owner')::integer=p_player;
  END IF;
  SELECT count(*)=0 INTO v_all_home
  FROM jsonb_array_elements(p_points) WITH ORDINALITY q(value,ord)
  WHERE q.value->>'owner'=p_player::text AND (q.value->>'count')::integer>0
    AND CASE WHEN p_player=0 THEN q.ord>6 ELSE q.ord<19 END;
  IF NOT v_all_home OR COALESCE((p_bar->>p_player)::integer,0)>0 THEN RETURN false; END IF;
  IF (p_player=0 AND v_target<0) OR (p_player=1 AND v_target>23) THEN
    SELECT EXISTS(
      SELECT 1 FROM jsonb_array_elements(p_points) WITH ORDINALITY q(value,ord)
      WHERE q.value->>'owner'=p_player::text AND (q.value->>'count')::integer>0
        AND CASE WHEN p_player=0 THEN q.ord-1>p_from ELSE q.ord-1<p_from END
    ) INTO v_farther;
    IF v_farther THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
$canfrom$;

REVOKE ALL ON FUNCTION private.tavla_can_move_from(jsonb,jsonb,integer,integer,integer) FROM PUBLIC,anon,authenticated;

-- Enforce official backgammon maximum-dice and higher-die rules.
CREATE OR REPLACE FUNCTION private.tavla_preview_move(
  p_points jsonb,p_bar jsonb,p_off jsonb,p_player integer,p_from integer,p_die integer
) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $preview$
DECLARE
  v_points jsonb:=p_points;
  v_bar jsonb:=p_bar;
  v_off jsonb:=p_off;
  v_target integer;
  v_source jsonb;
  v_dest jsonb;
  v_enemy integer:=1-p_player;
  v_count integer;
  v_farther boolean;
BEGIN
  IF COALESCE((v_bar->>p_player)::integer,0)>0 THEN
    IF p_from<>-1 THEN RAISE EXCEPTION 'bar source required'; END IF;
    v_target:=CASE WHEN p_player=0 THEN 24-p_die ELSE p_die-1 END;
  ELSE
    IF p_from NOT BETWEEN 0 AND 23 THEN RAISE EXCEPTION 'invalid source'; END IF;
    v_source:=v_points->p_from;
    IF v_source->>'owner' IS DISTINCT FROM p_player::text
       OR COALESCE((v_source->>'count')::integer,0)<1 THEN
      RAISE EXCEPTION 'invalid source';
    END IF;
    v_target:=CASE WHEN p_player=0 THEN p_from-p_die ELSE p_from+p_die END;
  END IF;

  IF v_target NOT BETWEEN 0 AND 23 THEN
    IF EXISTS(
      SELECT 1 FROM jsonb_array_elements(v_points) WITH ORDINALITY q(value,ord)
      WHERE q.value->>'owner'=p_player::text AND (q.value->>'count')::integer>0
        AND CASE WHEN p_player=0 THEN q.ord>6 ELSE q.ord<19 END
    ) OR COALESCE((v_bar->>p_player)::integer,0)>0 THEN
      RAISE EXCEPTION 'cannot bear off yet';
    END IF;
    IF (p_player=0 AND v_target<0) OR (p_player=1 AND v_target>23) THEN
      SELECT EXISTS(
        SELECT 1 FROM jsonb_array_elements(v_points) WITH ORDINALITY q(value,ord)
        WHERE q.value->>'owner'=p_player::text AND (q.value->>'count')::integer>0
          AND CASE WHEN p_player=0 THEN q.ord-1>p_from ELSE q.ord-1<p_from END
      ) INTO v_farther;
      IF v_farther THEN RAISE EXCEPTION 'oversize die not allowed'; END IF;
    END IF;
    v_off:=jsonb_set(v_off,ARRAY[p_player::text],
      to_jsonb(COALESCE((v_off->>p_player)::integer,0)+1),true);
  ELSE
    v_dest:=v_points->v_target;
    IF v_dest->>'owner' IS NOT NULL AND (v_dest->>'owner')::integer<>p_player
       AND COALESCE((v_dest->>'count')::integer,0)>=2 THEN
      RAISE EXCEPTION 'blocked point';
    ELSIF v_dest->>'owner' IS NOT NULL AND (v_dest->>'owner')::integer<>p_player
       AND COALESCE((v_dest->>'count')::integer,0)=1 THEN
      v_bar:=jsonb_set(v_bar,ARRAY[v_enemy::text],
        to_jsonb(COALESCE((v_bar->>v_enemy)::integer,0)+1),true);
      v_dest:=jsonb_build_object('owner',p_player,'count',1);
    ELSE
      v_dest:=jsonb_build_object('owner',p_player,
        'count',COALESCE((v_dest->>'count')::integer,0)+1);
    END IF;
    v_points:=jsonb_set(v_points,ARRAY[v_target::text],v_dest,true);
  END IF;

  IF p_from=-1 THEN
    v_bar:=jsonb_set(v_bar,ARRAY[p_player::text],
      to_jsonb(COALESCE((v_bar->>p_player)::integer,0)-1),true);
  ELSE
    v_source:=v_points->p_from;
    v_count:=COALESCE((v_source->>'count')::integer,0)-1;
    v_source:=CASE WHEN v_count<=0 THEN jsonb_build_object('owner',null,'count',0)
      ELSE jsonb_build_object('owner',p_player,'count',v_count) END;
    v_points:=jsonb_set(v_points,ARRAY[p_from::text],v_source,true);
  END IF;
  RETURN jsonb_build_object('points',v_points,'bar',v_bar,'off',v_off);
END;
$preview$;

CREATE OR REPLACE FUNCTION private.tavla_max_usable_dice(
  p_points jsonb,p_bar jsonb,p_off jsonb,p_player integer,p_dice jsonb
) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $maxdice$
DECLARE
  die_value integer;
  die_ordinal bigint;
  source_point integer;
  remaining jsonb;
  preview jsonb;
  best integer:=0;
  candidate integer;
BEGIN
  IF p_dice IS NULL OR jsonb_array_length(p_dice)=0 THEN RETURN 0; END IF;
  FOR die_value,die_ordinal IN
    SELECT x.value::text::integer,x.ord
    FROM jsonb_array_elements(p_dice) WITH ORDINALITY x(value,ord)
  LOOP
    IF COALESCE((p_bar->>p_player)::integer,0)>0 THEN
      IF private.tavla_can_move(p_points,p_bar,p_player,die_value) THEN
        SELECT COALESCE(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO remaining
        FROM jsonb_array_elements(p_dice) WITH ORDINALITY x(value,ord)
        WHERE x.ord<>die_ordinal;
        preview:=private.tavla_preview_move(p_points,p_bar,p_off,p_player,-1,die_value);
        candidate:=1+private.tavla_max_usable_dice(
          preview->'points',preview->'bar',preview->'off',p_player,remaining);
        best:=greatest(best,candidate);
      END IF;
    ELSE
      FOR source_point IN 0..23 LOOP
        IF (p_points->source_point->>'owner')=p_player::text
           AND COALESCE((p_points->source_point->>'count')::integer,0)>0
           AND private.tavla_can_move_from(p_points,p_bar,p_player,source_point,die_value) THEN
          SELECT COALESCE(jsonb_agg(x.value ORDER BY x.ord),'[]'::jsonb) INTO remaining
          FROM jsonb_array_elements(p_dice) WITH ORDINALITY x(value,ord)
          WHERE x.ord<>die_ordinal;
          preview:=private.tavla_preview_move(p_points,p_bar,p_off,p_player,source_point,die_value);
          candidate:=1+private.tavla_max_usable_dice(
            preview->'points',preview->'bar',preview->'off',p_player,remaining);
          best:=greatest(best,candidate);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN best;
END;
$maxdice$;

REVOKE ALL ON FUNCTION private.tavla_preview_move(jsonb,jsonb,jsonb,integer,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.tavla_max_usable_dice(jsonb,jsonb,jsonb,integer,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.tavla_apply_action(
  p_room_id uuid, p_actor_id uuid, p_action text, p_payload jsonb,
  p_expected_updated_at timestamptz
) RETURNS public.game_rooms
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $tavla$
DECLARE
  r public.game_rooms;
  players uuid[];
  actor_index integer;
  turn_index integer;
  points jsonb;
  board jsonb;
  state jsonb;
  dice jsonb;
  new_dice jsonb;
  bar jsonb;
  off jsonb;
  source_point integer;
  target_point integer;
  die integer;
  idx integer;
  source jsonb;
  target jsonb;
  enemy integer;
  owner_value integer;
  count_value integer;
  roll_a integer;
  roll_b integer;
  i integer;
  d integer;
  next_turn integer;
  opening jsonb;
  has_any boolean;
  all_home boolean;
  farther boolean;
  feed jsonb;
  room_status text;
  max_before integer;
  max_after integer;
  preferred_die integer;
  candidate_source integer;
  candidate_die integer;
  candidate_has_move boolean;
BEGIN
  IF COALESCE(
    NULLIF(current_setting('request.jwt.claim.role',true),''),
    NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Engine gateway only.' USING errcode='42501';
  END IF;

  SELECT * INTO r FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND OR r.game_key<>'tavla' OR r.engine_version<>3 THEN
    RAISE EXCEPTION 'غرفة الطاولي غير موجودة أو إصدارها غير مدعوم.' USING errcode='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.game_room_players p WHERE p.room_id=p_room_id AND p.user_id=p_actor_id) THEN
    RAISE EXCEPTION 'لست عضواً في هذه الغرفة.' USING errcode='42501';
  END IF;
  IF r.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' USING errcode='40001';
  END IF;

  SELECT array_agg(p.user_id ORDER BY p.seat) INTO players
  FROM public.game_room_players p WHERE p.room_id=p_room_id;
  IF COALESCE(array_length(players,1),0)<>2 THEN
    RAISE EXCEPTION 'الطاولي الأصلية تحتاج لاعبين اثنين بالضبط.' USING errcode='55000';
  END IF;
  actor_index:=array_position(players,p_actor_id)-1;
  state:=r.game_state;
  board:=COALESCE(state->'board','{}'::jsonb);
  points:=COALESCE(board->'points','[]'::jsonb);
  dice:=COALESCE(board->'dice','[]'::jsonb);
  bar:=COALESCE(board->'bar','[0,0]'::jsonb);
  off:=COALESCE(board->'off','[0,0]'::jsonb);
  turn_index:=COALESCE((state->>'turn')::integer,0);
  feed:=COALESCE(state->'feed','[]'::jsonb);

  IF p_action='start' THEN
    IF r.host_id IS DISTINCT FROM p_actor_id OR r.status NOT IN ('waiting','finished') THEN
      RAISE EXCEPTION 'بدء الطاولي من صلاحية المضيف فقط، وبعد انتهاء الجولة السابقة.' USING errcode='42501';
    END IF;
    points:='[]'::jsonb;
    FOR i IN 0..23 LOOP
      owner_value:=NULL; count_value:=0;
      IF i=23 THEN owner_value:=0; count_value:=2;
      ELSIF i=12 THEN owner_value:=0; count_value:=5;
      ELSIF i=7 THEN owner_value:=0; count_value:=3;
      ELSIF i=5 THEN owner_value:=0; count_value:=5;
      ELSIF i=0 THEN owner_value:=1; count_value:=2;
      ELSIF i=11 THEN owner_value:=1; count_value:=5;
      ELSIF i=16 THEN owner_value:=1; count_value:=3;
      ELSIF i=18 THEN owner_value:=1; count_value:=5;
      END IF;
      points:=points||jsonb_build_array(jsonb_build_object('owner',owner_value,'count',count_value));
    END LOOP;
    LOOP
      roll_a:=1+(get_byte(uuid_send(gen_random_uuid()),0)%6);
      roll_b:=1+(get_byte(uuid_send(gen_random_uuid()),1)%6);
      EXIT WHEN roll_a<>roll_b;
    END LOOP;
    turn_index:=CASE WHEN roll_a>roll_b THEN 0 ELSE 1 END;
    dice:=jsonb_build_array(greatest(roll_a,roll_b),least(roll_a,roll_b));
    opening:=jsonb_build_array(
      jsonb_build_object('playerId',players[1]::text,'roll',roll_a),
      jsonb_build_object('playerId',players[2]::text,'roll',roll_b)
    );
    board:=jsonb_build_object(
      'points',points,'bar','[0,0]'::jsonb,'off','[0,0]'::jsonb,
      'dice',dice,'opening',true,'openingRolls',opening,'selected',null,
      'lastMove',null,'turnNumber',1
    );
    state:=jsonb_build_object(
      'phase','playing','round',1,'turn',turn_index,'scores',COALESCE(state->'scores','{}'::jsonb),
      'feed',feed||jsonb_build_array('بدأت الطاولي الأصلية. رمية الافتتاح تحدد اللاعب الأول والرقمين الأولين.'),
      'board',board,'rules',COALESCE(state->'rules','{}'::jsonb)
    );
    UPDATE public.game_rooms SET game_state=state,status='playing',
      game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    WHERE id=p_room_id RETURNING * INTO r;
    RETURN r;
  END IF;

  IF r.status<>'playing' THEN RAISE EXCEPTION 'الجولة غير نشطة.' USING errcode='55000'; END IF;
  IF actor_index<>turn_index THEN RAISE EXCEPTION 'مو دورك حالياً.' USING errcode='42501'; END IF;

  IF p_action='roll' THEN
    IF jsonb_array_length(dice)>0 THEN RAISE EXCEPTION 'استخدم النرد الحالي أولاً.'; END IF;
    roll_a:=1+(get_byte(uuid_send(gen_random_uuid()),0)%6);
    roll_b:=1+(get_byte(uuid_send(gen_random_uuid()),1)%6);
    dice:=CASE WHEN roll_a=roll_b
      THEN jsonb_build_array(roll_a,roll_a,roll_a,roll_a)
      ELSE jsonb_build_array(greatest(roll_a,roll_b),least(roll_a,roll_b)) END;
    board:=jsonb_set(board,'{dice}',dice,true);
    board:=jsonb_set(board,'{lastRoll}',jsonb_build_array(roll_a,roll_b),true);
    board:=jsonb_set(board,'{opening}','false'::jsonb,true);
    feed:=feed||jsonb_build_array('نتيجة النرد: '||roll_a||' و '||roll_b||CASE WHEN roll_a=roll_b THEN ' (دبل)' ELSE '' END);
    IF NOT private.tavla_has_moves(points,bar,turn_index,dice) THEN
      next_turn:=(turn_index+1)%2;
      dice:='[]'::jsonb;
      board:=jsonb_set(board,'{dice}',dice,true);
      state:=jsonb_set(state,'{turn}',to_jsonb(next_turn),true);
      feed:=feed||jsonb_build_array('ماكو حركة قانونية؛ انتقل الدور للاعب الثاني.');
    END IF;
    state:=jsonb_set(state,'{board}',board,true);
    state:=jsonb_set(state,'{feed}',feed,true);
    UPDATE public.game_rooms SET game_state=state,updated_at=pg_catalog.clock_timestamp()
    WHERE id=p_room_id RETURNING * INTO r;
    RETURN r;
  END IF;

  IF p_action='pass-tavla' THEN
    IF jsonb_array_length(dice)=0 THEN RAISE EXCEPTION 'ماكو نرد متبقّي للتمرير.'; END IF;
    IF private.tavla_has_moves(points,bar,turn_index,dice) THEN
      RAISE EXCEPTION 'عندك حركة قانونية؛ لازم تستخدم النرد.' USING errcode='55000';
    END IF;
    next_turn:=(turn_index+1)%2;
    board:=jsonb_set(board,'{dice}','[]'::jsonb,true);
    state:=jsonb_set(state,'{board}',board,true);
    state:=jsonb_set(state,'{turn}',to_jsonb(next_turn),true);
    feed:=feed||jsonb_build_array('انتهت الحركات القانونية؛ انتقل الدور.');
    state:=jsonb_set(state,'{feed}',feed,true);
    UPDATE public.game_rooms SET game_state=state,updated_at=pg_catalog.clock_timestamp()
    WHERE id=p_room_id RETURNING * INTO r;
    RETURN r;
  END IF;

  IF p_action<>'move-tavla' THEN
    RAISE EXCEPTION 'حركة طاولي غير معروفة.' USING errcode='22023';
  END IF;
  IF jsonb_array_length(dice)=0 THEN RAISE EXCEPTION 'ارمِ النرد أولاً.'; END IF;
  source_point:=COALESCE((p_payload->>'from')::integer,-2);
  die:=COALESCE((p_payload->>'die')::integer,0);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(dice) q(value) WHERE (q.value#>>'{}')::integer=die) THEN
    RAISE EXCEPTION 'قيمة النرد غير متاحة.' USING errcode='22023';
  END IF;
  max_before:=private.tavla_max_usable_dice(points,bar,off,turn_index,dice);
  IF max_before<1 THEN
    RAISE EXCEPTION 'ماكو حركة قانونية؛ انتهى الدور.' USING errcode='55000';
  END IF;
  -- If only one of two dice can be used, official backgammon rules require the higher playable die.
  IF jsonb_array_length(dice)=2 AND max_before=1 THEN
    preferred_die:=NULL;
    FOR candidate_die IN
      SELECT DISTINCT value::text::integer
      FROM jsonb_array_elements(dice)
      ORDER BY value::text::integer DESC
    LOOP
      candidate_has_move:=false;
      IF COALESCE((bar->>turn_index)::integer,0)>0 THEN
        candidate_has_move:=private.tavla_can_move(points,bar,turn_index,candidate_die);
      ELSE
        FOR candidate_source IN 0..23 LOOP
          IF (points->candidate_source->>'owner')=turn_index::text
             AND COALESCE((points->candidate_source->>'count')::integer,0)>0
             AND private.tavla_can_move_from(points,bar,turn_index,candidate_source,candidate_die) THEN
            candidate_has_move:=true;
            EXIT;
          END IF;
        END LOOP;
      END IF;
      IF candidate_has_move THEN preferred_die:=candidate_die; EXIT; END IF;
    END LOOP;
    IF preferred_die IS NOT NULL AND die<>preferred_die THEN
      RAISE EXCEPTION 'إذا تگدر تستخدم نرد واحد فقط، لازم تستخدم الرقم الأعلى المتاح.' USING errcode='55000';
    END IF;
  END IF;

  IF COALESCE((bar->>turn_index)::integer,0)>0 THEN
    IF source_point<>-1 THEN RAISE EXCEPTION 'عندك حجر بالبار؛ لازم تدخله قبل أي حركة.' USING errcode='55000'; END IF;
    target_point:=CASE WHEN turn_index=0 THEN 24-die ELSE die-1 END;
    source:=NULL;
  ELSE
    IF source_point NOT BETWEEN 0 AND 23 THEN RAISE EXCEPTION 'نقطة البداية غير صالحة.' USING errcode='22023'; END IF;
    source:=points->source_point;
    IF source->>'owner' IS DISTINCT FROM turn_index::text OR COALESCE((source->>'count')::integer,0)<1 THEN
      RAISE EXCEPTION 'ماكو حجر إلك بهالنقطة.' USING errcode='55000';
    END IF;
    target_point:=CASE WHEN turn_index=0 THEN source_point-die ELSE source_point+die END;
  END IF;

  IF target_point NOT BETWEEN 0 AND 23 THEN
    SELECT count(*)=0 INTO all_home
    FROM jsonb_array_elements(points) WITH ORDINALITY q(value,ord)
    WHERE q.value->>'owner'=turn_index::text AND (q.value->>'count')::integer>0
      AND CASE WHEN turn_index=0 THEN q.ord>6 ELSE q.ord<19 END;
    IF NOT all_home OR COALESCE((bar->>turn_index)::integer,0)>0 THEN
      RAISE EXCEPTION 'ما تگدر تطلع الأحجار قبل ما توصل كلها لبيتك.' USING errcode='55000';
    END IF;
    IF (turn_index=0 AND target_point<0) OR (turn_index=1 AND target_point>23) THEN
      SELECT EXISTS(
        SELECT 1 FROM jsonb_array_elements(points) WITH ORDINALITY q(value,ord)
        WHERE q.value->>'owner'=turn_index::text AND (q.value->>'count')::integer>0
          AND CASE WHEN turn_index=0 THEN q.ord-1>source_point ELSE q.ord-1<source_point END
      ) INTO farther;
      IF farther THEN RAISE EXCEPTION 'لا يجوز استخدام نرد أكبر للإخراج مع وجود حجر أبعد.' USING errcode='55000'; END IF;
    END IF;
    off:=jsonb_set(off,ARRAY[turn_index::text],to_jsonb(COALESCE((off->>turn_index)::integer,0)+1),true);
  ELSE
    target:=points->target_point;
    IF target->>'owner' IS NOT NULL AND (target->>'owner')::integer<>turn_index
       AND COALESCE((target->>'count')::integer,0)>=2 THEN
      RAISE EXCEPTION 'النقطة مغلقة بحجرين أو أكثر للخصم.' USING errcode='55000';
    END IF;
    IF target->>'owner' IS NOT NULL AND (target->>'owner')::integer<>turn_index
       AND COALESCE((target->>'count')::integer,0)=1 THEN
      enemy:=1-turn_index;
      bar:=jsonb_set(bar,ARRAY[enemy::text],to_jsonb(COALESCE((bar->>enemy)::integer,0)+1),true);
      target:=jsonb_build_object('owner',turn_index,'count',1);
      feed:=feed||jsonb_build_array('ضربت حجر الخصم ورجع للبار.');
    ELSE
      target:=jsonb_build_object('owner',turn_index,'count',COALESCE((target->>'count')::integer,0)+1);
    END IF;
    points:=jsonb_set(points,ARRAY[target_point::text],target,true);
  END IF;

  IF source_point<>-1 THEN
    source:=points->source_point;
    count_value:=COALESCE((source->>'count')::integer,0)-1;
    source:=CASE WHEN count_value<=0 THEN jsonb_build_object('owner',null,'count',0)
      ELSE jsonb_build_object('owner',turn_index,'count',count_value) END;
    points:=jsonb_set(points,ARRAY[source_point::text],source,true);
  ELSE
    bar:=jsonb_set(bar,ARRAY[turn_index::text],to_jsonb(COALESCE((bar->>turn_index)::integer,0)-1),true);
  END IF;

  SELECT COALESCE(jsonb_agg(q.value ORDER BY q.ord),'[]'::jsonb) INTO new_dice
  FROM jsonb_array_elements(dice) WITH ORDINALITY q(value,ord)
  WHERE q.ord<>(SELECT min(z.ord) FROM jsonb_array_elements(dice) WITH ORDINALITY z(value,ord)
                WHERE (z.value#>>'{}')::integer=die);
  max_after:=private.tavla_max_usable_dice(points,bar,off,turn_index,new_dice);
  IF 1+max_after<max_before THEN
    RAISE EXCEPTION 'لازم تختار حركة تتيح استخدام أكبر عدد ممكن من أرقام النرد.' USING errcode='55000';
  END IF;
  board:=jsonb_set(board,'{points}',points,true);
  board:=jsonb_set(board,'{bar}',bar,true);
  board:=jsonb_set(board,'{off}',off,true);
  board:=jsonb_set(board,'{dice}',new_dice,true);
  board:=jsonb_set(board,'{selected}','null'::jsonb,true);
  board:=jsonb_set(board,'{lastMove}',jsonb_build_object('player',turn_index,'from',source_point,'to',target_point,'die',die),true);

  IF COALESCE((off->>turn_index)::integer,0)>=15 THEN
    state:=jsonb_set(state,'{phase}',to_jsonb('finished'::text),true);
    state:=jsonb_set(state,'{winnerId}',to_jsonb(p_actor_id::text),true);
    board:=jsonb_set(board,'{dice}','[]'::jsonb,true);
    room_status:='finished';
    feed:=feed||jsonb_build_array('فزت باللعبة بعد إخراج أحجارك الـ15!');
  ELSE
    room_status:='playing';
    IF jsonb_array_length(new_dice)=0 OR NOT private.tavla_has_moves(points,bar,turn_index,new_dice) THEN
      next_turn:=(turn_index+1)%2;
      board:=jsonb_set(board,'{dice}','[]'::jsonb,true);
      state:=jsonb_set(state,'{turn}',to_jsonb(next_turn),true);
    END IF;
    feed:=feed||jsonb_build_array('تم تنفيذ حركة الطاولي.');
  END IF;
  state:=jsonb_set(state,'{board}',board,true);
  state:=jsonb_set(state,'{feed}',feed,true);
  UPDATE public.game_rooms SET game_state=state,status=room_status,updated_at=pg_catalog.clock_timestamp()
  WHERE id=p_room_id RETURNING * INTO r;
  RETURN r;
END;
$tavla$;

