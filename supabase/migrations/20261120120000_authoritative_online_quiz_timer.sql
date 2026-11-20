-- Authoritative 15-second online quiz rounds.
-- Applied only by an explicit deployment migration; this file is staged on the feature branch.
CREATE OR REPLACE FUNCTION public.engine_v3_apply_quiz_action(
  p_room_id uuid,
  p_actor_id uuid,
  p_action text,
  p_question jsonb,
  p_choice integer,
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
  v_board jsonb;
  v_quiz jsonb;
  v_public jsonb;
  v_private jsonb;
  v_secret jsonb;
  v_secret_question jsonb;
  v_answers jsonb;
  v_used jsonb;
  v_scores jsonb;
  v_players uuid[];
  v_player uuid;
  v_count integer;
  v_answer_count integer;
  v_question_number integer;
  v_now timestamptz;
  v_started_at timestamptz;
  v_deadline timestamptz;
  v_correct integer;
  v_selected integer;
  v_is_correct boolean;
  v_result jsonb;
  v_feed jsonb;
  v_category text;
  v_difficulty text;
  v_question_id text;
  v_event_payload jsonb;
BEGIN
  IF coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role'
  ) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Engine gateway only.' USING errcode='42501';
  END IF;
  IF p_room_id IS NULL OR p_actor_id IS NULL OR p_expected_updated_at IS NULL
     OR p_action NOT IN ('start','submit','timeout','next','finish') THEN
    RAISE EXCEPTION 'بيانات تحدّي الأسئلة غير صالحة.' USING errcode='22023';
  END IF;

  SELECT * INTO v_room FROM public.game_rooms WHERE id=p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الغرفة غير موجودة.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.game_room_players p
    WHERE p.room_id=p_room_id AND p.user_id=p_actor_id
  ) THEN
    RAISE EXCEPTION 'لست عضواً في هذه الغرفة.' USING errcode='42501';
  END IF;
  IF v_room.engine_version<>3 OR v_room.game_key<>'quiz' THEN
    RAISE EXCEPTION 'هذه الغرفة ليست مهيأة لتحدّي الأسئلة الجديد.' USING errcode='55000';
  END IF;
  IF v_room.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'تغيّرت حالة الغرفة؛ حدّث اللعبة وحاول مرة أخرى.' USING errcode='40001';
  END IF;
  SELECT array_agg(p.user_id ORDER BY p.seat),count(*)::integer
    INTO v_players,v_count
    FROM public.game_room_players p WHERE p.room_id=p_room_id;
  IF v_count<2 OR v_count>12 THEN
    RAISE EXCEPTION 'تحدّي الأسئلة يحتاج من لاعبين إلى ١٢ لاعباً.' USING errcode='55000';
  END IF;

  v_state:=v_room.game_state;
  v_board:=coalesce(v_state->'board','{}'::jsonb);
  v_answers:=coalesce(v_board->'quizQuestion'->'answers','{}'::jsonb);
  v_scores:=coalesce(v_state->'scores','{}'::jsonb);
  v_feed:=coalesce(v_state->'feed','[]'::jsonb);
  v_now:=pg_catalog.clock_timestamp();

  IF p_action IN ('start','next') THEN
    IF v_room.host_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'إعداد السؤال التالي من صلاحية الهوست فقط.' USING errcode='42501';
    END IF;
    IF p_question IS NULL OR jsonb_typeof(p_question)<>'object'
       OR jsonb_typeof(p_question->'public')<>'object'
       OR jsonb_typeof(p_question->'private')<>'object' THEN
      RAISE EXCEPTION 'بيانات السؤال غير مكتملة.' USING errcode='22023';
    END IF;
    v_public:=p_question->'public';
    v_private:=p_question->'private';
    v_category:=v_public->>'category';
    v_difficulty:=v_public->>'difficulty';
    v_question_id:=v_public->>'id';
    IF v_category NOT IN ('general','wrestlers','aqeeda-imami','aqeeda-sunni','anime','cars','brands','gaming','math','medicine')
       OR v_difficulty NOT IN ('easy','medium','hard','expert')
       OR coalesce(length(v_question_id),0)<1 OR coalesce(length(v_question_id),0)>100
       OR coalesce(length(v_public->>'question'),0)<5 OR coalesce(length(v_public->>'question'),0)>700
       OR jsonb_typeof(v_public->'options')<>'array'
       OR jsonb_array_length(v_public->'options')<>4
       OR coalesce((v_private->>'correctChoice')::integer,-1) NOT BETWEEN 0 AND 3
       OR coalesce(length(v_private->>'explanation'),0)<5
       OR coalesce((v_private->>'questionId')=v_question_id,false) IS NOT TRUE THEN
      RAISE EXCEPTION 'السؤال أو الإجابة غير صالحين.' USING errcode='22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_public->'options') AS option_value
      WHERE jsonb_typeof(option_value)<>'string' OR length(trim(both '"' from option_value::text))=0
    ) THEN
      RAISE EXCEPTION 'خيارات الإجابة غير صالحة.' USING errcode='22023';
    END IF;
    IF jsonb_array_length((
      SELECT jsonb_agg(DISTINCT lower(trim(both '"' from option_value::text)))
      FROM jsonb_array_elements(v_public->'options') AS option_value
    ))<>4 THEN
      RAISE EXCEPTION 'يجب أن تكون الخيارات الأربعة مختلفة.' USING errcode='22023';
    END IF;
    IF v_category<>'general' AND (
      jsonb_typeof(v_private->'source')<>'object'
      OR coalesce(v_private->'source'->>'url','') NOT LIKE 'https://%'
      OR coalesce(length(v_private->'source'->>'label'),0)<1
    ) THEN
      RAISE EXCEPTION 'مصدر تصحيح السؤال غير صالح.' USING errcode='22023';
    END IF;
    IF p_action='start' THEN
      IF v_room.status NOT IN ('waiting','finished') THEN
        RAISE EXCEPTION 'لا يمكن بدء تحدٍّ جديد أثناء الجولة.' USING errcode='55000';
      END IF;
      IF coalesce(v_state->>'phase','')='playing' AND v_room.status='playing' THEN
        RAISE EXCEPTION 'هناك سؤال جارٍ بالفعل.' USING errcode='55000';
      END IF;
      v_question_number:=1;
      v_used:=jsonb_build_array(v_question_id);
      SELECT coalesce(jsonb_object_agg(p.user_id::text,0),'{}'::jsonb)
        INTO v_scores FROM public.game_room_players p WHERE p.room_id=p_room_id;
      DELETE FROM public.game_room_player_private_state WHERE room_id=p_room_id;
    ELSE
      IF v_room.status<>'playing' OR v_state->>'phase' IS DISTINCT FROM 'playing'
         OR coalesce((v_board->'quizQuestion'->>'revealed')::boolean,false) IS NOT TRUE THEN
        RAISE EXCEPTION 'اعرضوا نتيجة السؤال الحالي قبل الانتقال.' USING errcode='55000';
      END IF;
      v_question_number:=coalesce((v_board->'quizQuestion'->>'questionNumber')::integer,0)+1;
      IF v_question_number>10 THEN
        RAISE EXCEPTION 'اكتملت الأسئلة العشرة؛ أنهِ المباراة واحفظ النتيجة.' USING errcode='55000';
      END IF;
      IF v_category IS DISTINCT FROM v_board->'quizQuestion'->>'category'
         OR v_difficulty IS DISTINCT FROM v_board->'quizQuestion'->>'difficulty' THEN
        RAISE EXCEPTION 'لا يمكن تغيير القسم أو المستوى أثناء المباراة.' USING errcode='22023';
      END IF;
      v_used:=coalesce(v_board->'quizQuestion'->'usedQuestionIds','[]'::jsonb);
      IF v_used ? v_question_id THEN
        RAISE EXCEPTION 'تم استخدام هذا السؤال في المباراة؛ اختَر سؤالاً مختلفاً.' USING errcode='23505';
      END IF;
      v_used:=v_used||jsonb_build_array(v_question_id);
    END IF;

    v_started_at:=v_now;
    v_deadline:=v_started_at+interval '15 seconds';
    v_quiz:=jsonb_build_object(
      'id',v_question_id,'category',v_category,'difficulty',v_difficulty,
      'question',v_public->>'question','options',v_public->'options',
      'questionNumber',v_question_number,'totalQuestions',10,
      'startedAt',v_started_at,'deadlineAt',v_deadline,
      'revealed',false,'timedOut',false,'answers','{}'::jsonb,
      'usedQuestionIds',v_used
    );
    v_state:=jsonb_build_object(
      'phase','playing','round',v_question_number,'turn',0,
      'scores',v_scores,'feed',v_feed||jsonb_build_array(
        CASE WHEN p_action='start' THEN 'بدأ تحدّي الأسئلة بقسم '||v_category||' ومستوى '||v_difficulty||'.'
        ELSE 'بدأ السؤال رقم '||v_question_number||' من ١٠.' END
      ),
      'board',jsonb_build_object('quizQuestion',v_quiz)
    );

    v_secret_question:=jsonb_build_object(
      'id',v_question_id,
      'correctChoice',(v_private->>'correctChoice')::integer,
      'explanation',v_private->>'explanation',
      'source',v_private->'source'
    );
    INSERT INTO public.game_room_private_state(room_id,secret_state,created_at,updated_at)
    VALUES(p_room_id,jsonb_build_object('quizQuestion',v_secret_question),v_now,v_now)
    ON CONFLICT(room_id) DO UPDATE
      SET secret_state=coalesce(public.game_room_private_state.secret_state,'{}'::jsonb)
        ||jsonb_build_object('quizQuestion',EXCLUDED.secret_state->'quizQuestion'),
          updated_at=EXCLUDED.updated_at;
    UPDATE public.game_rooms
      SET game_state=v_state,status='playing',updated_at=v_now
      WHERE id=p_room_id RETURNING * INTO v_room;
    INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
      VALUES(p_room_id,p_actor_id,'quiz',CASE WHEN p_action='start' THEN 'quiz-start' ELSE 'quiz-next' END,
        jsonb_build_object('question_id',v_question_id,'question_number',v_question_number,'deadline_at',v_deadline));
    RETURN v_room;
  END IF;

  IF v_room.status<>'playing' OR v_state->>'phase' IS DISTINCT FROM 'playing'
     OR jsonb_typeof(v_board->'quizQuestion')<>'object' THEN
    RAISE EXCEPTION 'لا توجد جولة أسئلة مفتوحة حالياً.' USING errcode='55000';
  END IF;
  v_quiz:=v_board->'quizQuestion';
  IF coalesce((v_quiz->>'revealed')::boolean,false) THEN
    IF p_action='timeout' THEN RETURN v_room; END IF;
    RAISE EXCEPTION 'تم إعلان نتيجة هذا السؤال بالفعل.' USING errcode='55000';
  END IF;
  v_question_id:=v_quiz->>'id';
  SELECT secret_state INTO v_secret FROM public.game_room_private_state WHERE room_id=p_room_id FOR UPDATE;
  v_secret_question:=v_secret->'quizQuestion';
  IF v_secret_question IS NULL OR v_secret_question->>'id' IS DISTINCT FROM v_question_id THEN
    RAISE EXCEPTION 'تعذّر استرجاع مفتاح السؤال السري.' USING errcode='55000';
  END IF;
  v_correct:=(v_secret_question->>'correctChoice')::integer;
  v_deadline:=(v_quiz->>'deadlineAt')::timestamptz;

  IF p_action='submit' THEN
    IF v_now>=v_deadline THEN
      RAISE EXCEPTION 'انتهت الثواني الخمس عشرة لهذا السؤال.' USING errcode='55000';
    END IF;
    IF p_choice IS NULL OR p_choice NOT BETWEEN 0 AND 3 THEN
      RAISE EXCEPTION 'اختَر إجابة من الخيارات الأربعة.' USING errcode='22023';
    END IF;
    IF v_answers ? p_actor_id::text THEN
      RAISE EXCEPTION 'إجابتك مسجلة بالفعل لهذا السؤال.' USING errcode='23505';
    END IF;
    INSERT INTO public.game_room_player_private_state(room_id,user_id,private_state,updated_at)
    VALUES(p_room_id,p_actor_id,jsonb_build_object('quizPending',jsonb_build_object(
      'questionId',v_question_id,'selectedChoice',p_choice,'submittedAt',v_now
    )),v_now)
    ON CONFLICT(room_id,user_id) DO UPDATE
      SET private_state=(coalesce(public.game_room_player_private_state.private_state,'{}'::jsonb)-'quizResult')
        ||jsonb_build_object('quizPending',EXCLUDED.private_state->'quizPending'),
          updated_at=EXCLUDED.updated_at;
    v_answers:=v_answers||jsonb_build_object(p_actor_id::text,jsonb_build_object('submitted',true,'submittedAt',v_now));
    v_quiz:=jsonb_set(v_quiz,'{answers}',v_answers,true);
    v_board:=jsonb_set(v_board,'{quizQuestion}',v_quiz,true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{feed}',v_feed||jsonb_build_array('وصلت إجابة لاعب إلى الخادم.'),true);
    UPDATE public.game_rooms SET game_state=v_state,updated_at=v_now
      WHERE id=p_room_id RETURNING * INTO v_room;
    INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
      VALUES(p_room_id,p_actor_id,'quiz','quiz-answer-submitted',jsonb_build_object('question_id',v_question_id));
    RETURN v_room;
  END IF;

  IF p_action='timeout' THEN
    IF v_now<v_deadline THEN
      RAISE EXCEPTION 'ما انتهت المهلة بعد.' USING errcode='55000';
    END IF;
    FOR v_player IN SELECT p.user_id FROM public.game_room_players p WHERE p.room_id=p_room_id LOOP
      SELECT private_state INTO v_private
        FROM public.game_room_player_private_state
        WHERE room_id=p_room_id AND user_id=v_player
        FOR UPDATE;
      v_selected:=NULL;
      IF v_private->'quizPending'->>'questionId'=v_question_id THEN
        v_selected:=nullif(v_private->'quizPending'->>'selectedChoice','')::integer;
      END IF;
      v_is_correct:=v_selected IS NOT NULL AND v_selected=v_correct;
      IF v_is_correct THEN
        v_scores:=jsonb_set(v_scores,ARRAY[v_player::text],
          to_jsonb(coalesce((v_scores->>v_player::text)::integer,0)+1),true);
      END IF;
      v_result:=jsonb_build_object(
        'questionId',v_question_id,'selectedChoice',v_selected,
        'correctChoice',v_correct,'isCorrect',v_is_correct,
        'timedOut',v_selected IS NULL,
        'explanation',v_secret_question->>'explanation',
        'source',v_secret_question->'source'
      );
      INSERT INTO public.game_room_player_private_state(room_id,user_id,private_state,updated_at)
      VALUES(p_room_id,v_player,jsonb_build_object('quizResult',v_result),v_now)
      ON CONFLICT(room_id,user_id) DO UPDATE
        SET private_state=(coalesce(public.game_room_player_private_state.private_state,'{}'::jsonb)-'quizPending')
          ||jsonb_build_object('quizResult',EXCLUDED.private_state->'quizResult'),
            updated_at=EXCLUDED.updated_at;
    END LOOP;
    v_quiz:=v_quiz||jsonb_build_object(
      'revealed',true,'timedOut',true,'correctChoice',v_correct,
      'explanation',v_secret_question->>'explanation',
      'source',v_secret_question->'source','revealedAt',v_now
    );
    v_board:=jsonb_set(v_board,'{quizQuestion}',v_quiz,true);
    v_state:=jsonb_set(v_state,'{board}',v_board,true);
    v_state:=jsonb_set(v_state,'{scores}',v_scores,true);
    v_state:=jsonb_set(v_state,'{feed}',v_feed||jsonb_build_array('انتهى عدّ السؤال، وظهرت الإجابة الصحيحة للجميع.'),true);
    UPDATE public.game_rooms SET game_state=v_state,updated_at=v_now
      WHERE id=p_room_id RETURNING * INTO v_room;
    INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
      VALUES(p_room_id,p_actor_id,'quiz','quiz-question-revealed',jsonb_build_object('question_id',v_question_id,'timed_out',true));
    RETURN v_room;
  END IF;

  IF p_action='finish' THEN
    IF v_room.host_id IS DISTINCT FROM p_actor_id THEN
      RAISE EXCEPTION 'إنهاء المباراة من صلاحية الهوست فقط.' USING errcode='42501';
    END IF;
    IF coalesce((v_quiz->>'revealed')::boolean,false) IS NOT TRUE THEN
      RAISE EXCEPTION 'اعرض نتيجة السؤال قبل إنهاء المباراة.' USING errcode='55000';
    END IF;
    v_event_payload:=jsonb_build_object(
      'completed',true,'participant_count',v_count,
      'reason','quiz_host_finished',
      'questions_completed',coalesce((v_quiz->>'questionNumber')::integer,0)
    );
    INSERT INTO public.game_room_action_events(room_id,actor_id,game_key,action,event_payload)
      VALUES(p_room_id,p_actor_id,'quiz','game-finished',v_event_payload);
    v_state:=jsonb_set(v_state,'{phase}',to_jsonb('finished'::text),true);
    v_state:=jsonb_set(v_state,'{feed}',v_feed||jsonb_build_array('انتهى تحدّي الأسئلة. تم حفظ نقاط جميع اللاعبين.'),true);
    UPDATE public.game_rooms SET game_state=v_state,status='finished',updated_at=v_now
      WHERE id=p_room_id RETURNING * INTO v_room;
    RETURN v_room;
  END IF;

  RAISE EXCEPTION 'أمر تحدّي الأسئلة غير مدعوم.' USING errcode='22023';
END;
$function$;

REVOKE ALL ON FUNCTION public.engine_v3_apply_quiz_action(uuid,uuid,text,jsonb,integer,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engine_v3_apply_quiz_action(uuid,uuid,text,jsonb,integer,timestamptz) TO service_role;
