-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor لتفعيل دولاب الوناسة أونلاين.
-- آمن للتشغيل المتكرر: يحذف قيد game_key القديم ثم يعيد إنشاءه مع wheel.
alter table public.game_rooms drop constraint if exists game_rooms_game_key_check;
alter table public.game_rooms
  add constraint game_rooms_game_key_check
  check (game_key in ('who','number','liar','most','yesno','snakes','domino','tavla','colors','quiz','wheel'));
