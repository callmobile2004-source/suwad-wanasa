-- Chess is a strict two-player game. All move legality is checked in the authenticated
-- room-engine Edge Function with chess.js; this RPC is private to the service-role gateway.
ALTER TABLE public.game_rooms DROP CONSTRAINT IF EXISTS game_rooms_game_key_check;
ALTER TABLE public.game_rooms ADD CONSTRAINT game_rooms_game_key_check
CHECK (game_key = ANY (ARRAY[
  'who','number','liar','most','yesno','snakes','domino','tavla','colors','quiz','wheel','chess'
]::text[]));

CREATE OR REPLACE FUNCTION public.create_game_room(
  p_room_code text,
  p_room_name text,
  p_game_key text,
  p_max_players integer,
  p_game_state jsonb,
  p_display_name text
) RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_min integer;
  v_max integer;
  v_name text;
  v_state jsonb;
  v_engine_version smallint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'يلزم تسجيل الدخول.' USING errcode='42501'; END IF;
  IF p_room_code IS NULL OR p_room_code !~ '^[A-Z0-9]{6}$' THEN RAISE EXCEPTION 'رمز الغرفة غير صالح.'; END IF;
  IF p_room_name IS NULL OR char_length(btrim(p_room_name)) NOT BETWEEN 1 AND 32 THEN RAISE EXCEPTION 'اسم الغرفة غير صالح.'; END IF;
  v_name:=btrim(coalesce(p_display_name,''));
  IF char_length(v_name) NOT BETWEEN 2 AND 24 THEN RAISE EXCEPTION 'اسم اللاعب يجب أن يكون بين حرفين و٢٤ حرفاً.'; END IF;
  IF jsonb_typeof(coalesce(p_game_state,'{}'::jsonb)) IS DISTINCT FROM 'object'
     OR pg_catalog.pg_column_size(coalesce(p_game_state,'{}'::jsonb))>16384 THEN
    RAISE EXCEPTION 'بيانات بداية الغرفة غير صالحة.';
  END IF;

  CASE p_game_key
    WHEN 'who' THEN v_min:=2; v_max:=12;
    WHEN 'number' THEN v_min:=2; v_max:=8;
    WHEN 'liar' THEN v_min:=3; v_max:=16;
    WHEN 'most' THEN v_min:=2; v_max:=12;
    WHEN 'yesno' THEN v_min:=2; v_max:=12;
    WHEN 'snakes' THEN v_min:=2; v_max:=6;
    WHEN 'domino' THEN v_min:=2; v_max:=4;
    WHEN 'tavla' THEN v_min:=2; v_max:=2;
    WHEN 'colors' THEN v_min:=2; v_max:=10;
    WHEN 'quiz' THEN v_min:=2; v_max:=12;
    WHEN 'wheel' THEN v_min:=2; v_max:=16;
    WHEN 'chess' THEN v_min:=2; v_max:=2;
    ELSE RAISE EXCEPTION 'اللعبة المطلوبة غير معروفة.';
  END CASE;
  IF p_max_players IS NULL OR p_max_players NOT BETWEEN v_min AND v_max THEN
    RAISE EXCEPTION 'عدد اللاعبين لا يناسب اللعبة المختارة.';
  END IF;

  v_engine_version:=CASE WHEN p_game_key='number' THEN 2 ELSE 3 END;
  IF p_game_key='number' THEN
    v_state:=jsonb_build_object(
      'phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('الغرفة جاهزة للعبة تخمين الرقم.'),
      'board',jsonb_build_object('tries','{}'::jsonb,'hint','خمّن رقماً من ١ إلى ١٠٠.')
    );
  ELSE
    v_state:=jsonb_build_object(
      'phase','lobby','round',0,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('الغرفة جاهزة. يبدأ اللعب بعد اكتمال اللاعبين.'),
      'board',CASE WHEN p_game_key='wheel'
        THEN jsonb_build_object('rotation',0,'result',null,'spins',0,'stage','landing')
        ELSE '{}'::jsonb END
    );
  END IF;

  INSERT INTO public.game_rooms(
    room_code,room_name,game_key,host_id,max_players,status,game_state,engine_version
  ) VALUES(
    upper(p_room_code),btrim(p_room_name),p_game_key,auth.uid(),p_max_players,
    'waiting',v_state,v_engine_version
  ) RETURNING * INTO v_room;

  INSERT INTO public.game_room_players(room_id,user_id,display_name,seat,last_seen_at)
  VALUES(v_room.id,auth.uid(),v_name,0,pg_catalog.now());
  RETURN v_room;
END;
$function$;

CREATE OR REPLACE FUNCTION public.engine_v3_apply_chess_action(
  p_room_id uuid,
  p_actor_id uuid,
  p_action text,
  p_expected_updated_at timestamptz,
  p_payload jsonb
) RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_room public.game_rooms;
  v_players uuid[];
  v_player_count integer;
  v_actor_seat integer;
  v_board jsonb;
  v_state jsonb;
  v_status text;
  v_turn integer;
  v_winner uuid;
  v_fen text;
  v_pgn text;
  v_side text;
  v_legal jsonb;
  v_draw text;
  v_last_move jsonb;
  v_feed jsonb;
BEGIN
  IF coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'
  ) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Engine gateway only.' USING errcode='42501';
  END IF;
  IF p_room_id IS NULL OR p_actor_id IS NULL OR p_expected_updated_at IS NULL
     OR p_action NOT IN ('start-chess','move-chess','claim-chess-draw','resign-chess')
     OR jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) IS DISTINCT FROM 'object'
     OR pg_catalog.pg_column_size(coalesce(p_payload,'{}'::jsonb))>80000 THEN
    RAISE EXCEPTION 'بيانات حركة الشطرنج غير صالحة.' USING errcode='22023';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الغرفة غير موجودة.'; END IF;
  IF v_room.game_key<>'chess' OR v_room.engine_version<>3 THEN
    RAISE EXCEPTION 'الغرفة ليست شطرنجاً.' USING errcode='22023';
  END IF;
  IF v_room.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' USING errcode='40001';
  END IF;

  SELECT array_agg(user_id ORDER BY seat),count(*)::integer
  INTO v_players,v_player_count
  FROM public.game_room_players WHERE room_id=p_room_id;
  IF v_player_count<>2 OR v_players[1] IS NULL OR v_players[2] IS NULL THEN
    RAISE EXCEPTION 'الشطرنج يحتاج لاعبين اثنين.' USING errcode='55000';
  END IF;
  v_actor_seat:=array_position(v_players,p_actor_id)-1;
  IF v_actor_seat IS NULL OR v_actor_seat NOT IN (0,1) THEN
    RAISE EXCEPTION 'لست عضواً في هذه الغرفة.' USING errcode='42501';
  END IF;

  IF p_action='start-chess' THEN
    IF v_room.host_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'المضيف فقط يگدر يبدأ مباراة الشطرنج.' USING errcode='42501';
    END IF;
    IF v_room.status NOT IN ('waiting','finished') THEN
      RAISE EXCEPTION 'المباراة جارية بالفعل.' USING errcode='55000';
    END IF;
    IF p_payload->>'fen' IS DISTINCT FROM 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
       OR coalesce(p_payload->>'pgn','')<>'' OR p_payload->>'sideToMove'<>'w'
       OR coalesce(p_payload->>'turnIndex','0')<>'0'
       OR coalesce(jsonb_typeof(p_payload->'legalMoves'),'')<>'array'
       OR CASE WHEN jsonb_typeof(p_payload->'legalMoves')='array'
          THEN jsonb_array_length(p_payload->'legalMoves')<>20 ELSE true END THEN
      RAISE EXCEPTION 'تهيئة رقعة الشطرنج غير صحيحة.' USING errcode='22023';
    END IF;
    v_board:=jsonb_build_object(
      'fen',p_payload->>'fen','pgn','','sideToMove','w','turnIndex',0,
      'legalMoves',p_payload->'legalMoves','check',false,'lastMove',null,
      'ply',0,'canClaimDraw',false,'winnerId',null,'drawReason',null
    );
    v_state:=jsonb_build_object(
      'phase','playing','round',1,'turn',0,'scores','{}'::jsonb,
      'feed',jsonb_build_array('بدأت مباراة الشطرنج: الأبيض أولاً.'),
      'board',v_board
    );
    UPDATE public.game_rooms SET game_state=v_state,status='playing',
      game_started_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    WHERE id=p_room_id RETURNING * INTO v_room;
    INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
    VALUES(p_room_id,p_actor_id,'chess','start-chess',jsonb_build_object('side','white'));
    RETURN v_room;
  END IF;

  IF v_room.status<>'playing' THEN
    RAISE EXCEPTION 'مباراة الشطرنج ليست جارية.' USING errcode='55000';
  END IF;
  v_board:=coalesce(v_room.game_state->'board','{}'::jsonb);
  IF p_payload->>'expectedFen' IS DISTINCT FROM v_board->>'fen' THEN
    RAISE EXCEPTION 'تغيّرت رقعة الشطرنج؛ حدّث اللعبة.' USING errcode='40001';
  END IF;
  v_turn:=coalesce((v_board->>'turnIndex')::integer,-1);
  IF p_action IN ('move-chess','claim-chess-draw') AND v_actor_seat<>v_turn THEN
    RAISE EXCEPTION 'مو دورك حالياً.' USING errcode='42501';
  END IF;

  IF p_action='resign-chess' THEN
    v_winner:=CASE WHEN v_actor_seat=0 THEN v_players[2] ELSE v_players[1] END;
    IF p_payload->>'winnerId' IS DISTINCT FROM v_winner::text
       OR p_payload->>'drawReason' IS DISTINCT FROM 'resignation' THEN
      RAISE EXCEPTION 'بيانات الاستسلام غير متطابقة.' USING errcode='22023';
    END IF;
    v_status:='finished';
    v_draw:='resignation';
    v_fen:=v_board->>'fen';
    v_pgn:=coalesce(v_board->>'pgn','');
    v_side:=coalesce(v_board->>'sideToMove','w');
    v_legal:=coalesce(v_board->'legalMoves','[]'::jsonb);
    v_last_move:=v_board->'lastMove';
    v_board:=jsonb_set(v_board,'{winnerId}',to_jsonb(v_winner::text),true);
    v_board:=jsonb_set(v_board,'{drawReason}',to_jsonb(v_draw),true);
    v_board:=jsonb_set(v_board,'{canClaimDraw}','false'::jsonb,true);
  ELSE
    v_fen:=p_payload->>'fen';
    v_pgn:=coalesce(p_payload->>'pgn','');
    v_side:=p_payload->>'sideToMove';
    v_legal:=p_payload->'legalMoves';
    v_last_move:=p_payload->'lastMove';
    v_status:=p_payload->>'status';
    v_winner:=nullif(p_payload->>'winnerId','')::uuid;
    v_draw:=nullif(p_payload->>'drawReason','');
    IF v_fen IS NULL OR char_length(v_fen)>200 OR v_pgn IS NULL OR char_length(v_pgn)>60000
       OR v_side IS NULL OR v_side NOT IN ('w','b')
       OR v_status IS NULL OR v_status NOT IN ('playing','finished')
       OR coalesce(jsonb_typeof(v_legal),'')<>'array'
       OR CASE WHEN jsonb_typeof(v_legal)='array' THEN jsonb_array_length(v_legal)>256 ELSE true END
       OR coalesce((p_payload->>'turnIndex')::integer,-1)<>CASE WHEN v_side='w' THEN 0 ELSE 1 END
       OR coalesce((p_payload->>'ply')::integer,-1)<0 THEN
      RAISE EXCEPTION 'حالة رقعة الشطرنج غير صالحة.' USING errcode='22023';
    END IF;
    IF p_action='claim-chess-draw' AND (v_status<>'finished' OR v_draw NOT IN ('fifty_move_rule','threefold_repetition') OR v_winner IS NOT NULL) THEN
      RAISE EXCEPTION 'مطالبة التعادل غير صالحة.' USING errcode='22023';
    END IF;
    IF p_action='move-chess' AND v_status='finished' AND v_winner IS NULL AND v_draw IS NULL THEN
      RAISE EXCEPTION 'نتيجة المباراة غير محددة.' USING errcode='22023';
    END IF;
    IF v_winner IS NOT NULL AND NOT (v_winner=ANY(v_players)) THEN
      RAISE EXCEPTION 'الفائز ليس من لاعبي الغرفة.' USING errcode='22023';
    END IF;
    v_board:=jsonb_build_object(
      'fen',v_fen,'pgn',v_pgn,'sideToMove',v_side,
      'turnIndex',(p_payload->>'turnIndex')::integer,
      'legalMoves',v_legal,'check',coalesce((p_payload->>'check')::boolean,false),
      'lastMove',v_last_move,'ply',(p_payload->>'ply')::integer,
      'canClaimDraw',coalesce((p_payload->>'canClaimDraw')::boolean,false),
      'winnerId',v_winner,'drawReason',v_draw
    );
  END IF;

  v_state:=jsonb_set(v_room.game_state,'{board}',v_board,true);
  v_state:=jsonb_set(v_state,'{phase}',to_jsonb(v_status),true);
  v_state:=jsonb_set(v_state,'{turn}',to_jsonb(coalesce((v_board->>'turnIndex')::integer,v_turn)),true);
  v_feed:=coalesce(v_state->'feed','[]'::jsonb);
  v_feed:=v_feed||jsonb_build_array(
    CASE WHEN p_action='resign-chess' THEN 'استسلم لاعب وانتهت المباراة.'
         WHEN p_action='claim-chess-draw' THEN 'تم قبول مطالبة التعادل.'
         WHEN v_status='finished' AND v_winner IS NOT NULL THEN 'انتهت المباراة بكش مات.'
         WHEN v_status='finished' THEN 'انتهت المباراة بالتعادل.'
         ELSE 'تم تسجيل نقلة شطرنج قانونية.' END
  );
  v_state:=jsonb_set(v_state,'{feed}',v_feed,true);
  UPDATE public.game_rooms SET game_state=v_state,status=v_status,updated_at=pg_catalog.clock_timestamp()
  WHERE id=p_room_id RETURNING * INTO v_room;
  INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
  VALUES(p_room_id,p_actor_id,'chess',p_action,jsonb_build_object(
    'status',v_status,'winnerId',v_winner,'drawReason',v_draw,
    'san',v_last_move->>'san','ply',v_board->>'ply'
  ));
  IF v_status='finished' THEN
    INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
    VALUES(p_room_id,p_actor_id,'chess','game-finished',jsonb_build_object(
      'winner_id',v_winner,'reason',coalesce(v_draw,CASE WHEN v_winner IS NOT NULL THEN 'checkmate' ELSE 'draw' END)
    ));
  END IF;
  RETURN v_room;
END;
$function$;

REVOKE ALL ON FUNCTION public.engine_v3_apply_chess_action(uuid,uuid,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_v3_apply_chess_action(uuid,uuid,text,timestamptz,jsonb) TO service_role;
