-- Snakes & Ladders authoritative rules v2; existing legacy boards keep their previous map.
CREATE OR REPLACE FUNCTION public.engine_v3_apply_action(p_room_id uuid, p_actor_id uuid, p_action text, p_payload jsonb, p_expected_updated_at timestamp with time zone)
 RETURNS game_rooms
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_room public.game_rooms;
  v_before public.game_rooms;
  v_after public.game_rooms;
  v_players uuid[];
  v_player_count integer;
  v_actor_index integer;
  v_turn integer;
  v_next_turn integer;
  v_target_index integer;
  v_target_id uuid;
  v_hand_counts jsonb;
  v_hand jsonb;
  v_private jsonb;
  v_room_private jsonb;
  v_board jsonb;
  v_state jsonb;
  v_deck jsonb;
  v_stock jsonb;
  v_discard jsonb;
  v_top jsonb;
  v_card jsonb;
  v_opening_tile jsonb;
  v_opening_player uuid;
  v_chain jsonb;
  v_left jsonb;
  v_right jsonb;
  v_pending jsonb;
  v_draw_result jsonb;
  v_draw_count integer;
  v_stock_count integer;
  v_card_index integer;
  v_card_count integer;
  v_copy integer;
  v_i integer;
  v_j integer;
  v_n integer;
  v_color text;
  v_value text;
  v_active_color text;
  v_chosen_color text;
  v_card_value text;
  v_direction integer;
  v_old integer;
  v_landing integer;
  v_final integer;
  v_die integer;
  v_animation_ms integer;
  v_started_at timestamptz;
  v_kind text;
  v_head integer;
  v_tail integer;
  v_start integer;
  v_end integer;
  v_used integer[]:=array[1,100];
  v_snakes jsonb:='[]'::jsonb;
  v_ladders jsonb:='[]'::jsonb;
  v_positions jsonb;
  v_feed jsonb;
  v_pips integer;
  v_min_pips integer;
  v_winner_count integer;
  v_winner uuid;
  v_pending_player uuid;
  v_hand_count integer;
  v_uno_penalty jsonb;
  v_path jsonb:='[]'::jsonb;
  v_step integer;
  v_six_streak integer:=0;
  v_next_six_streak integer:=0;
  v_keep_turn boolean:=false;
  v_opening_rolls jsonb:='[]'::jsonb;
  v_rolls integer[];
  v_active integer[];
  v_roll integer;
  v_highest integer;
  v_display_name text;
  v_idx integer;
begin
  if coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) is distinct from 'service_role' then
    raise exception 'Engine gateway only.' using errcode='42501';
  end if;
  if p_room_id is null or p_actor_id is null or p_action is null
     or jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) is distinct from 'object'
     or pg_catalog.pg_column_size(coalesce(p_payload,'{}'::jsonb))>8192
     or p_expected_updated_at is null then
    raise exception 'بيانات الحركة غير صالحة.' using errcode='22023';
  end if;

  select * into v_room from public.game_rooms where id=p_room_id for update;
  if not found then raise exception 'الغرفة غير موجودة.'; end if;
  if not exists(select 1 from public.game_room_players p where p.room_id=p_room_id and p.user_id=p_actor_id) then
    raise exception 'لست عضواً في هذه الغرفة.' using errcode='42501';
  end if;

  -- A snake move is finalized only after the server-defined animation window.
  if p_action='finish-snake-move' then
    if v_room.engine_version<>3 or v_room.game_key<>'snakes' then
      raise exception 'هذا الأمر خاص بلعبة حيّة ودرج.' using errcode='22023';
    end if;
    v_pending:=v_room.game_state->'board'->'pendingMove';
    if v_pending is null or v_pending='null'::jsonb then return v_room; end if;
    if v_room.updated_at is distinct from p_expected_updated_at then
      raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
    end if;
    if pg_catalog.clock_timestamp() <
       (v_pending->>'startedAt')::timestamptz
       + ((v_pending->>'animationMs')::integer * interval '1 millisecond') then
      raise exception 'الحركة ما اكتملت بصرياً بعد.' using errcode='55000';
    end if;
    select array_agg(p.user_id order by p.seat),count(*)::integer
    into v_players,v_player_count
    from public.game_room_players p where p.room_id=p_room_id;
    v_actor_index:=(v_pending->>'actorIndex')::integer;
    if v_actor_index<0 or v_actor_index>=v_player_count then
      raise exception 'ترتيب اللاعب في الحركة غير صالح.' using errcode='22023';
    end if;
    v_board:=v_room.game_state->'board';
    v_positions:=coalesce(v_board->'positions','[]'::jsonb);
    v_positions:=jsonb_set(v_positions,array[v_actor_index::text],to_jsonb((v_pending->>'final')::integer),false);
    v_board:=jsonb_set(v_board,'{positions}',v_positions,true);
    v_board:=v_board-'pendingMove';
    v_board:=jsonb_set(v_board,'{lastMove}',v_pending,true);
    v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
    v_board:=jsonb_set(v_board,'{consecutiveSixes}',to_jsonb(coalesce((v_pending->>'nextSixStreak')::integer,0)),true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    if (v_pending->>'final')::integer=100 then
      v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
    elsif coalesce((v_pending->>'keepTurn')::boolean,false) then
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_actor_index),true);
    else
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb((v_actor_index+1)%v_player_count),true);
    end if;
    update public.game_rooms
    set game_state=v_state,
        status=case when (v_pending->>'final')::integer=100 then 'finished' else status end,
        updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    return v_room;
  end if;

  -- UNO call/catch are room-member actions, not turn actions.
  if p_action in ('call-uno','catch-uno') then
    if v_room.engine_version<>3 or v_room.game_key<>'colors' or v_room.status<>'playing' then
      raise exception 'نداء UNO غير متاح حالياً.' using errcode='55000';
    end if;
    if v_room.updated_at is distinct from p_expected_updated_at then
      raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
    end if;
    v_board:=v_room.game_state->'board';
    v_pending:=v_board->'unoPending';
    if v_pending is null or v_pending='null'::jsonb then
      raise exception 'ماكو لاعب منتظر نداء UNO حالياً.' using errcode='55000';
    end if;
    v_pending_player:=(v_pending->>'playerId')::uuid;
    if p_action='call-uno' then
      if p_actor_id<>v_pending_player then raise exception 'نداء UNO يخص اللاعب صاحب الكرت الواحد.' using errcode='42501'; end if;
      v_board:=v_board-'unoPending';
      v_board:=jsonb_set(v_board,'{unoLastCall}',jsonb_build_object('playerId',p_actor_id,'at',pg_catalog.clock_timestamp()),true);
    else
      if p_actor_id=v_pending_player then raise exception 'ما تگدر تصيد نفسك؛ نادِ UNO.' using errcode='42501'; end if;
      v_draw_result:=private.draw_uno_cards(p_room_id,v_pending_player,2);
      v_board:=v_board-'unoPending';
      v_board:=jsonb_set(v_board,'{draw_count}',to_jsonb((v_draw_result->>'stockCount')::integer),true);
      v_board:=jsonb_set(v_board,'{discard}',v_draw_result->'discard',true);
      v_board:=jsonb_set(v_board,'{unoLastPenalty}',jsonb_build_object('playerId',v_pending_player,'caughtBy',p_actor_id,'cards',2),true);
    end if;
    v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
    update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_room;
    return v_room;
  end if;

  -- Preserve the exact v3 engine as the trusted rules core for all ordinary actions.
  -- Special wrappers below only add the missing visual timing and authentic game rules.
  if p_action='start' and v_room.engine_version=3 and v_room.game_key in ('snakes','domino','colors') then
    v_after:=public.engine_v3_apply_action_core(p_room_id,p_actor_id,p_action,p_payload,p_expected_updated_at);

    select game_state into v_state from public.game_rooms where id=p_room_id;
    select array_agg(p.user_id order by p.seat),count(*)::integer
    into v_players,v_player_count
    from public.game_room_players p where p.room_id=p_room_id;
    if v_state is null then raise exception 'تعذّر استرجاع حالة اللعبة بعد التهيئة.'; end if;
    v_board:=coalesce(v_state->'board','{}'::jsonb);

    if v_room.game_key='snakes' then
      v_used:=array[1,100];
      v_snakes:='[]'::jsonb;
      v_ladders:='[]'::jsonb;
      for v_i in 1..10 loop
        select candidate into v_head
        from generate_series(18,98) candidate
        where not candidate=any(v_used)
        order by random() limit 1;
        select candidate into v_tail
        from generate_series(2,v_head-8) candidate
        where not candidate=any(v_used)
        order by random() limit 1;
        v_used:=array_append(v_used,v_head);
        v_used:=array_append(v_used,v_tail);
        v_snakes:=v_snakes||jsonb_build_array(jsonb_build_object('from',v_head,'to',v_tail));
      end loop;
      for v_i in 1..9 loop
        select candidate into v_start
        from generate_series(2,88) candidate
        where not candidate=any(v_used)
        order by random() limit 1;
        select candidate into v_end
        from generate_series(v_start+8,99) candidate
        where not candidate=any(v_used)
        order by random() limit 1;
        v_used:=array_append(v_used,v_start);
        v_used:=array_append(v_used,v_end);
        v_ladders:=v_ladders||jsonb_build_array(jsonb_build_object('from',v_start,'to',v_end));
      end loop;
      v_board:=jsonb_set(v_board,'{snakes}',v_snakes,true);
      v_board:=jsonb_set(v_board,'{ladders}',v_ladders,true);
      v_board:=jsonb_set(v_board,'{dice}','null'::jsonb,true);
      v_board:=jsonb_set(v_board,'{consecutiveSixes}','0'::jsonb,true);
      v_rolls:=array_fill(0,ARRAY[v_player_count]);
      v_opening_rolls:='[]'::jsonb;
      for v_idx in 1..v_player_count loop
        v_roll:=1+(get_byte(uuid_send(gen_random_uuid()),0)%6);
        v_rolls[v_idx]:=v_roll;
        select display_name into v_display_name from public.game_room_players
        where room_id=p_room_id and user_id=v_players[v_idx];
        v_opening_rolls:=v_opening_rolls||jsonb_build_array(
          jsonb_build_object('playerId',v_players[v_idx]::text,'displayName',v_display_name,'rolls',jsonb_build_array(v_roll))
        );
      end loop;
      select max(value) into v_highest from unnest(v_rolls) as rolls(value);
      select array_agg(i order by i) into v_active
      from generate_subscripts(v_rolls,1) as idx(i) where v_rolls[i]=v_highest;
      while cardinality(v_active)>1 loop
        foreach v_idx in array v_active loop
          v_roll:=1+(get_byte(uuid_send(gen_random_uuid()),0)%6);
          v_rolls[v_idx]:=v_roll;
          v_opening_rolls:=jsonb_set(v_opening_rolls,array[(v_idx-1)::text,'rolls'],
            coalesce(v_opening_rolls->(v_idx-1)->'rolls','[]'::jsonb)||to_jsonb(v_roll),false);
        end loop;
        select max(v_rolls[i]) into v_highest from unnest(v_active) as tied(i);
        select array_agg(i order by i) into v_active
        from unnest(v_active) as tied(i) where v_rolls[i]=v_highest;
      end loop;
      v_actor_index:=v_active[1]-1;
      v_board:=jsonb_set(v_board,'{openingRolls}',v_opening_rolls,true);
      v_board:=jsonb_set(v_board,'{startingPlayerId}',to_jsonb(v_players[v_active[1]]::text),true);
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_actor_index),true);

    elsif v_room.game_key='domino' then
      select ps.user_id,tile.value
      into v_opening_player,v_opening_tile
      from public.game_room_player_private_state ps
      join public.game_room_players rp on rp.room_id=ps.room_id and rp.user_id=ps.user_id
      cross join lateral jsonb_array_elements(ps.private_state->'hand') as tile(value)
      where ps.room_id=p_room_id
      order by
        case when (tile.value->>0)::integer=(tile.value->>1)::integer then 1 else 0 end desc,
        case when (tile.value->>0)::integer=(tile.value->>1)::integer
          then (tile.value->>0)::integer
          else (tile.value->>0)::integer+(tile.value->>1)::integer end desc,
        greatest((tile.value->>0)::integer,(tile.value->>1)::integer) desc,
        rp.seat asc
      limit 1;
      if v_opening_player is null or v_opening_tile is null then
        raise exception 'تعذّر تحديد قطعة البداية في الدومينو.';
      end if;
      v_actor_index:=array_position(v_players,v_opening_player)-1;
      select coalesce(jsonb_object_agg(ps.user_id::text,jsonb_array_length(ps.private_state->'hand')),'{}'::jsonb)
      into v_hand_counts
      from public.game_room_player_private_state ps where ps.room_id=p_room_id;
      v_board:=jsonb_set(v_board,'{openingTile}',v_opening_tile,true);
      v_board:=jsonb_set(v_board,'{openingPlayerId}',to_jsonb(v_opening_player::text),true);
      v_board:=jsonb_set(v_board,'{handCounts}',v_hand_counts,true);
      v_board:=jsonb_set(v_board,'{consecutivePasses}','0'::jsonb,true);
      v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_actor_index),true);

    elsif v_room.game_key='colors' then
      v_deck:='[]'::jsonb;
      foreach v_color in array array['أحمر','أزرق','أخضر','أصفر'] loop
        v_deck:=v_deck||jsonb_build_array(jsonb_build_object('c',v_color,'v','0','kind','number'));
        for v_i in 1..9 loop
          for v_copy in 1..2 loop
            v_deck:=v_deck||jsonb_build_array(jsonb_build_object('c',v_color,'v',v_i::text,'kind','number'));
          end loop;
        end loop;
        foreach v_value in array array['skip','reverse','draw2'] loop
          for v_copy in 1..2 loop
            v_deck:=v_deck||jsonb_build_array(jsonb_build_object('c',v_color,'v',v_value,'kind','action'));
          end loop;
        end loop;
      end loop;
      for v_copy in 1..4 loop
        v_deck:=v_deck||jsonb_build_array(
          jsonb_build_object('c','wild','v','wild','kind','wild'),
          jsonb_build_object('c','wild','v','wild4','kind','wild')
        );
      end loop;
      select coalesce(jsonb_agg(x.value order by gen_random_uuid()),'[]'::jsonb)
      into v_deck
      from jsonb_array_elements(v_deck) x(value);
      if jsonb_array_length(v_deck)<>108 then raise exception 'توزيع UNO غير مكتمل.'; end if;

      for v_i in 1..v_player_count loop
        select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
        into v_hand
        from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
        where x.ordinality between ((v_i-1)*7+1) and (v_i*7);
        update public.game_room_player_private_state
        set private_state=jsonb_build_object('hand',v_hand,'drawn',false),
            updated_at=pg_catalog.clock_timestamp()
        where room_id=p_room_id and user_id=v_players[v_i];
      end loop;

      select x.value,x.ordinality
      into v_top,v_n
      from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
      where x.ordinality>(v_player_count*7) and x.value->>'kind'='number'
      order by x.ordinality limit 1;
      if v_top is null then raise exception 'تعذّر اختيار كرت البداية في UNO.'; end if;
      select coalesce(jsonb_agg(x.value order by gen_random_uuid()),'[]'::jsonb)
      into v_stock
      from jsonb_array_elements(v_deck) with ordinality x(value,ordinality)
      where x.ordinality>(v_player_count*7) and x.ordinality<>v_n;
      insert into public.game_room_private_state(room_id,secret_state)
      values(p_room_id,jsonb_build_object('colors_draw',v_stock))
      on conflict(room_id) do update
        set secret_state=jsonb_build_object('colors_draw',excluded.secret_state->'colors_draw'),
            updated_at=pg_catalog.clock_timestamp();
      v_board:=jsonb_build_object(
        'discard',jsonb_build_array(v_top),
        'draw_count',jsonb_array_length(v_stock),
        'direction',1,
        'activeColor',v_top->>'c',
        'unoPending',null
      );
    end if;

    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_after;
    return v_after;
  end if;

  -- Snake roll: the trusted v3 core supplies the server-side die result.
  -- This wrapper records the path and delays the next turn until animation completion.
  if p_action='roll' and v_room.engine_version=3 and v_room.game_key='snakes' then
    if v_room.updated_at is distinct from p_expected_updated_at then
      raise exception 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' using errcode='40001';
    end if;
    if v_room.game_state->'board'->'pendingMove' is not null
       and v_room.game_state->'board'->'pendingMove'<>'null'::jsonb then
      raise exception 'انتظر اكتمال حركة اللاعب الحالي.' using errcode='55000';
    end if;
    select array_agg(p.user_id order by p.seat),count(*)::integer
    into v_players,v_player_count
    from public.game_room_players p where p.room_id=p_room_id;
    v_actor_index:=array_position(v_players,p_actor_id)-1;
    v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
    v_positions:=v_room.game_state->'board'->'positions';
    v_old:=coalesce((v_positions->>v_actor_index)::integer,0);

    v_after:=public.engine_v3_apply_action_core(p_room_id,p_actor_id,p_action,p_payload,p_expected_updated_at);

    v_die:=(v_after.game_state->'board'->>'dice')::integer;
    v_six_streak:=coalesce((v_room.game_state->'board'->>'consecutiveSixes')::integer,0);
    v_path:='[]'::jsonb;
    v_landing:=v_old;
    v_final:=v_old;
    v_kind:='normal';
    v_keep_turn:=false;
    v_next_six_streak:=0;
    if v_die=6 and v_six_streak>=2 then
      v_kind:='triple_six_cancel';
    else
      if v_old+v_die<=100 then
        v_landing:=v_old+v_die;
        for v_step in v_old+1..v_landing loop
          v_path:=v_path||jsonb_build_array(v_step);
        end loop;
      else
        v_landing:=200-(v_old+v_die);
        v_kind:='bounce';
        for v_step in v_old+1..100 loop
          v_path:=v_path||jsonb_build_array(v_step);
        end loop;
        for v_step in reverse 99..v_landing loop
          v_path:=v_path||jsonb_build_array(v_step);
        end loop;
      end if;
      v_final:=v_landing;
      v_ladders:=coalesce(v_room.game_state->'board'->'ladders','[]'::jsonb);
      v_snakes:=coalesce(v_room.game_state->'board'->'snakes','[]'::jsonb);
      if jsonb_array_length(v_ladders)=0 then
        v_ladders:=jsonb_build_array(jsonb_build_object('from',3,'to',22),jsonb_build_object('from',8,'to',30),jsonb_build_object('from',20,'to',41),jsonb_build_object('from',27,'to',56),jsonb_build_object('from',50,'to',67),jsonb_build_object('from',71,'to',91),jsonb_build_object('from',80,'to',99));
      end if;
      if jsonb_array_length(v_snakes)=0 then
        v_snakes:=jsonb_build_array(jsonb_build_object('from',17,'to',4),jsonb_build_object('from',34,'to',12),jsonb_build_object('from',62,'to',19),jsonb_build_object('from',87,'to',24),jsonb_build_object('from',95,'to',75),jsonb_build_object('from',99,'to',78));
      end if;
      if v_kind<>'bounce' then
        select (x.value->>'to')::integer into v_final
        from jsonb_array_elements(v_ladders) x(value)
        where (x.value->>'from')::integer=v_landing limit 1;
        if found then
          v_kind:='ladder';
        else
          v_final:=v_landing;
          select (x.value->>'to')::integer into v_final
          from jsonb_array_elements(v_snakes) x(value)
          where (x.value->>'from')::integer=v_landing limit 1;
          if found then v_kind:='snake'; else v_final:=v_landing; end if;
        end if;
      end if;
      if v_kind in ('snake','ladder') then v_path:=v_path||jsonb_build_array(v_final); end if;
      if v_die=6 then v_next_six_streak:=v_six_streak+1; v_keep_turn:=true; end if;
    end if;
    v_started_at:=pg_catalog.clock_timestamp();
    v_animation_ms:=case when jsonb_array_length(v_path)=0 then 900
      else 850+(jsonb_array_length(v_path)*180)+case when v_kind in ('snake','ladder') then 650 else 0 end end;
    v_pending:=jsonb_build_object(
      'id',gen_random_uuid()::text,'actorId',p_actor_id::text,'actorIndex',v_actor_index,
      'from',v_old,'landing',v_landing,'final',v_final,'path',v_path,'dice',v_die,'kind',v_kind,
      'nextSixStreak',v_next_six_streak,'keepTurn',v_keep_turn,
      'startedAt',v_started_at,'animationMs',v_animation_ms
    );
    v_board:=v_after.game_state->'board';
    v_board:=jsonb_set(v_board,'{positions}',v_positions,true);
    v_board:=jsonb_set(v_board,'{pendingMove}',v_pending,true);
    v_state:=jsonb_set(v_after.game_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{phase}',to_jsonb('playing'::text),true);
    v_state:=jsonb_set(v_state,'{turn}',to_jsonb(v_turn),true);
    v_feed:=coalesce(v_state->'feed','[]'::jsonb);
    if jsonb_array_length(v_feed)>0 then
      v_feed:=jsonb_set(v_feed,array[(jsonb_array_length(v_feed)-1)::text],
        to_jsonb((select display_name from public.game_room_players where room_id=p_room_id and user_id=p_actor_id)
          ||case v_kind
            when 'triple_six_cancel' then ' رمى ٦ للمرة الثالثة؛ أُلغيت الحركة.'
            when 'bounce' then ' تجاوز ١٠٠ وارتد إلى '||v_final
            when 'ladder' then ' صعد الدرج إلى '||v_final
            when 'snake' then ' نزل بالحيّة إلى '||v_final
            else ' رمى النرد وظهر '||v_die||'، وتحرك إلى '||v_final
          end),false);
      v_state:=jsonb_set(v_state,'{feed}',v_feed,true);
    end if;
    update public.game_rooms set game_state=v_state,status='playing',updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_after;
    return v_after;
  end if;

  -- Enforce the authentic opening tile and legal draw/pass rules in double-six Dominoes.
  if v_room.engine_version=3 and v_room.game_key='domino'
     and p_action in ('play-domino','draw-domino','pass-domino') then
    select array_agg(p.user_id order by p.seat),count(*)::integer
    into v_players,v_player_count
    from public.game_room_players p where p.room_id=p_room_id;
    v_board:=v_room.game_state->'board';
    v_chain:=coalesce(v_board->'chain','[]'::jsonb);
    if p_action='play-domino' and jsonb_array_length(v_chain)=0
       and v_board ? 'openingTile' then
      if p_actor_id is distinct from (v_board->>'openingPlayerId')::uuid then
        raise exception 'يبدأ الدومينو صاحب أعلى دبل أو أعلى قطعة.' using errcode='42501';
      end if;
      select private_state into v_private
      from public.game_room_player_private_state
      where room_id=p_room_id and user_id=p_actor_id for update;
      v_hand:=coalesce(v_private->'hand','[]'::jsonb);
      v_card_index:=coalesce((p_payload->>'index')::integer,-1);
      if v_card_index<0 or v_card_index>=jsonb_array_length(v_hand)
         or v_hand->v_card_index is distinct from v_board->'openingTile' then
        raise exception 'ابدأ بالقطعة الأعلى التي ظهرت لك في بداية الجولة.' using errcode='55000';
      end if;
    elsif p_action='draw-domino' and jsonb_array_length(v_chain)>0 then
      select private_state into v_private
      from public.game_room_player_private_state
      where room_id=p_room_id and user_id=p_actor_id for update;
      v_hand:=coalesce(v_private->'hand','[]'::jsonb);
      v_left:=v_chain->0;
      v_right:=v_chain->(jsonb_array_length(v_chain)-1);
      if exists(
        select 1 from jsonb_array_elements(v_hand) h(value)
        where (h.value->>0)::integer in ((v_left->>0)::integer,(v_right->>1)::integer)
           or (h.value->>1)::integer in ((v_left->>0)::integer,(v_right->>1)::integer)
      ) then
        raise exception 'عندك قطعة قانونية تگدر تلعبها؛ ما يصير تسحب.' using errcode='55000';
      end if;
    end if;

    v_after:=public.engine_v3_apply_action_core(p_room_id,p_actor_id,p_action,p_payload,p_expected_updated_at);

    v_board:=v_after.game_state->'board';

    if p_action='play-domino' then
      v_board:=v_board-'openingTile'-'openingPlayerId';
      v_board:=jsonb_set(v_board,'{consecutivePasses}','0'::jsonb,true);
    elsif p_action='pass-domino' then
      v_n:=coalesce((v_room.game_state->'board'->>'consecutivePasses')::integer,0)+1;
      v_board:=jsonb_set(v_board,'{consecutivePasses}',to_jsonb(v_n),true);
    end if;

    select coalesce(jsonb_object_agg(ps.user_id::text,jsonb_array_length(ps.private_state->'hand')),'{}'::jsonb)
    into v_hand_counts
    from public.game_room_player_private_state ps where ps.room_id=p_room_id;
    v_board:=jsonb_set(v_board,'{handCounts}',v_hand_counts,true);

    if p_action='pass-domino' and v_n>=v_player_count then
      select min(total_pips) into v_min_pips
      from (
        select sum((tile.value->>0)::integer+(tile.value->>1)::integer)::integer as total_pips
        from public.game_room_player_private_state ps
        cross join lateral jsonb_array_elements(ps.private_state->'hand') tile(value)
        where ps.room_id=p_room_id
        group by ps.user_id
      ) totals;
      select count(*) into v_winner_count
      from (
        select sum((tile.value->>0)::integer+(tile.value->>1)::integer)::integer as total_pips
        from public.game_room_player_private_state ps
        cross join lateral jsonb_array_elements(ps.private_state->'hand') tile(value)
        where ps.room_id=p_room_id
        group by ps.user_id
      ) totals
      where total_pips=v_min_pips;

      if v_winner_count=1 then
        select ps.user_id into v_winner
        from public.game_room_player_private_state ps
        cross join lateral jsonb_array_elements(ps.private_state->'hand') tile(value)
        where ps.room_id=p_room_id
        group by ps.user_id
        having sum((tile.value->>0)::integer+(tile.value->>1)::integer)=v_min_pips
        limit 1;
        v_board:=jsonb_set(v_board,'{winner_id}',to_jsonb(v_winner::text),true);
        v_board:=jsonb_set(v_board,'{draw}',to_jsonb(false),true);
      else
        v_board:=jsonb_set(v_board,'{winner_id}','null'::jsonb,true);
        v_board:=jsonb_set(v_board,'{draw}',to_jsonb(true),true);
      end if;
      v_board:=jsonb_set(v_board,'{ended}',to_jsonb(true),true);
      v_state:=jsonb_set(v_after.game_state,'{board}',v_board,true);
      v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
      update public.game_rooms set game_state=v_state,status='finished',updated_at=pg_catalog.clock_timestamp()
      where id=p_room_id returning * into v_after;
      return v_after;
    end if;

    v_state:=jsonb_set(v_after.game_state,'{board}',v_board,true);
    update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_after;
    return v_after;
  end if;

  -- UNO: normalize wild cards for the legacy v3 core, then apply action effects and direction.
  if v_room.engine_version=3 and v_room.game_key='colors'
     and p_action in ('play-color','draw-color','pass-color') then
    select array_agg(p.user_id order by p.seat),count(*)::integer
    into v_players,v_player_count
    from public.game_room_players p where p.room_id=p_room_id;
    v_actor_index:=array_position(v_players,p_actor_id)-1;
    v_turn:=coalesce((v_room.game_state->>'turn')::integer,0);
    v_board:=v_room.game_state->'board';
    v_pending:=v_board->'unoPending';

    if p_action='play-color' then
      select private_state into v_private
      from public.game_room_player_private_state
      where room_id=p_room_id and user_id=p_actor_id for update;
      v_hand:=coalesce(v_private->'hand','[]'::jsonb);
      v_card_index:=coalesce((p_payload->>'index')::integer,-1);
      v_card_count:=jsonb_array_length(v_hand);
      if v_card_index<0 or v_card_index>=v_card_count then raise exception 'اختيار الكرت غير صالح.'; end if;
      if coalesce((v_private->>'drawn')::boolean,false) and v_card_index<>v_card_count-1 then
        raise exception 'بعد السحب تگدر تلعب الكرت الجديد فقط.' using errcode='55000';
      end if;
      v_card:=v_hand->v_card_index;
      v_top:=v_board->'discard'->(jsonb_array_length(v_board->'discard')-1);
      v_active_color:=coalesce(v_board->>'activeColor',v_top->>'c');
      if v_card->>'c'='wild' then
        v_chosen_color:=p_payload->>'color';
        if v_chosen_color is null or v_chosen_color not in ('أحمر','أزرق','أخضر','أصفر') then
          raise exception 'اختار اللون الجديد للكرت الحر.' using errcode='22023';
        end if;
        if v_card->>'v'='wild4' and exists(
          select 1 from jsonb_array_elements(v_hand) with ordinality h(value,ordinality)
          where h.ordinality<>v_card_index+1 and h.value->>'c'=v_active_color and h.value->>'c'<>'wild'
        ) then
          raise exception 'كرت +4 ما ينلعب إذا عندك كرت من اللون الحالي.' using errcode='55000';
        end if;
        select coalesce(jsonb_agg(
          case when h.ordinality=v_card_index+1
            then jsonb_set(h.value,'{c}',to_jsonb(v_active_color),true)
            else h.value end
          order by h.ordinality
        ),'[]'::jsonb)
        into v_hand
        from jsonb_array_elements(v_hand) with ordinality h(value,ordinality);
        update public.game_room_player_private_state
        set private_state=jsonb_set(v_private,'{hand}',v_hand,true),
            updated_at=pg_catalog.clock_timestamp()
        where room_id=p_room_id and user_id=p_actor_id;
      else
        v_chosen_color:=v_card->>'c';
      end if;
      v_card_value:=v_card->>'v';
    end if;

    v_after:=public.engine_v3_apply_action_core(p_room_id,p_actor_id,p_action,p_payload,p_expected_updated_at);

    v_board:=v_after.game_state->'board';

    -- If the player with one card did not call UNO before another player acted,
    -- the penalty is applied automatically and transactionally.
    if v_pending is not null and v_pending<>'null'::jsonb
       and p_actor_id is distinct from (v_pending->>'playerId')::uuid then
      v_pending_player:=(v_pending->>'playerId')::uuid;
      v_draw_result:=private.draw_uno_cards(p_room_id,v_pending_player,2);
      v_board:=jsonb_set(v_board,'{draw_count}',to_jsonb((v_draw_result->>'stockCount')::integer),true);
      v_board:=jsonb_set(v_board,'{discard}',v_draw_result->'discard',true);
      v_board:=v_board-'unoPending';
      v_board:=jsonb_set(v_board,'{unoLastPenalty}',jsonb_build_object('playerId',v_pending_player,'cards',2,'reason','missed_call'),true);
    end if;

    if p_action='pass-color' then
      v_next_turn:=((v_actor_index+coalesce((v_board->>'direction')::integer,1)+v_player_count)%v_player_count);
      v_state:=jsonb_set(v_after.game_state,'{turn}',to_jsonb(v_next_turn),true);
    elsif p_action='play-color' then
      v_discard:=coalesce(v_board->'discard','[]'::jsonb);
      v_top:=v_discard->(jsonb_array_length(v_discard)-1);
      if v_card->>'c'='wild' then
        v_top:=jsonb_set(v_top,'{c}',to_jsonb(v_chosen_color),true);
        v_discard:=jsonb_set(v_discard,array[(jsonb_array_length(v_discard)-1)::text],v_top,false);
        v_board:=jsonb_set(v_board,'{discard}',v_discard,true);
        v_active_color:=v_chosen_color;
      else
        v_active_color:=v_card->>'c';
      end if;
      v_board:=jsonb_set(v_board,'{activeColor}',to_jsonb(v_active_color),true);
      v_direction:=coalesce((v_board->>'direction')::integer,1);
      v_next_turn:=((v_actor_index+v_direction+v_player_count)%v_player_count);
      if v_card_value='reverse' then
        v_direction:=-v_direction;
        v_board:=jsonb_set(v_board,'{direction}',to_jsonb(v_direction),true);
        if v_player_count=2 then
          v_next_turn:=v_actor_index;
        else
          v_next_turn:=((v_actor_index+v_direction+v_player_count)%v_player_count);
        end if;
      elsif v_card_value='skip' then
        v_next_turn:=((v_actor_index+(2*v_direction)+2*v_player_count)%v_player_count);
      elsif v_card_value in ('draw2','wild4') then
        v_draw_count:=case when v_card_value='draw2' then 2 else 4 end;
        v_target_index:=((v_actor_index+v_direction+v_player_count)%v_player_count)+1;
        v_target_id:=v_players[v_target_index];
        v_draw_result:=private.draw_uno_cards(p_room_id,v_target_id,v_draw_count);
        v_board:=jsonb_set(v_board,'{draw_count}',to_jsonb((v_draw_result->>'stockCount')::integer),true);
        v_board:=jsonb_set(v_board,'{discard}',v_draw_result->'discard',true);
        v_next_turn:=((v_actor_index+(2*v_direction)+2*v_player_count)%v_player_count);
      end if;
      v_state:=jsonb_set(v_after.game_state,'{turn}',to_jsonb(v_next_turn),true);
      v_hand_count:=jsonb_array_length(coalesce((select private_state->'hand' from public.game_room_player_private_state where room_id=p_room_id and user_id=p_actor_id),'[]'::jsonb));
      if v_hand_count=1 and v_after.status<>'finished' then
        v_board:=jsonb_set(v_board,'{unoPending}',jsonb_build_object('playerId',p_actor_id::text,'createdAt',pg_catalog.clock_timestamp()),true);
      elsif v_hand_count=0 then
        v_board:=v_board-'unoPending';
      end if;
    else
      v_state:=v_after.game_state;
    end if;

    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    update public.game_rooms set game_state=v_state,updated_at=pg_catalog.clock_timestamp()
    where id=p_room_id returning * into v_after;
    return v_after;
  end if;

  -- All other game actions continue through the original, already-tested v3 core.
  return public.engine_v3_apply_action_core(p_room_id,p_actor_id,p_action,p_payload,p_expected_updated_at);
end;
$function$
