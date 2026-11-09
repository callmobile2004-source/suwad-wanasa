-- Auction game foundation. Additive only: does not alter existing room/game tables.
-- Text catalog is visible to authenticated players; media is optional and private.
-- All auction state changes are server-side and serialized by the bid RPC.

create table if not exists public.auction_categories (
  id text primary key,
  name_ar text not null,
  description_ar text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint auction_categories_id_format check (id ~ '^[a-z0-9-]{2,40}$')
);

insert into public.auction_categories (id, name_ar, description_ar, sort_order)
values
  ('football-players', 'مزاد لاعبي كرة القدم', 'لاعبون وبطاقات رياضية مع مراكزهم وإحصاءاتهم وإنجازاتهم.', 1),
  ('wrestlers', 'مزاد المصارعين', 'مصارعون وشخصيات الحلبات مع الألقاب والإنجازات.', 2),
  ('rare-animals', 'مزاد الحيوانات النادرة', 'معلومات تثقيفية ومقتنيات افتراضية فقط، دون بيع أو تجارة حيوانات حقيقية.', 3),
  ('cars', 'مزاد السيارات', 'سيارات وموديلات ومواصفات الأداء والحالة.', 4),
  ('watches', 'مزاد الساعات', 'ساعات وموديلات ومواد التصنيع والإصدارات.', 5),
  ('video-games', 'مزاد ألعاب الفيديو', 'ألعاب وأجهزة وشخصيات ومقتنيات ألعاب.', 6),
  ('real-estate', 'مزاد العقارات', 'عقارات افتراضية مع المساحة والموقع والمواصفات.', 7),
  ('aircraft-ships', 'مزاد الطائرات والسفن', 'مركبات جوية وبحرية مع مواصفات تعريفية.', 8),
  ('antiques', 'مزاد الآثار والتحف', 'تحف ومقتنيات تاريخية مع مصدر وتوثيق واضحين.', 9),
  ('rare-cards', 'مزاد البطاقات النادرة', 'بطاقات رياضية وألعاب جمع وإصدارات محدودة.', 10),
  ('fictional-gear', 'مزاد المعدات الخيالية', 'معدات خيالية داخل اللعبة فقط، لا أسلحة حقيقية أو تعليمات اقتناء.', 11),
  ('mystery-lots', 'مزاد المفاجآت', 'طرود افتراضية بمحتوى يُكشف تدريجياً قبل المزايدة.', 12)
on conflict (id) do update set
  name_ar = excluded.name_ar,
  description_ar = excluded.description_ar,
  sort_order = excluded.sort_order;

create table if not exists public.auction_items (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.auction_categories(id) on update cascade on delete restrict,
  slug text not null unique,
  title_ar text not null,
  subtitle_ar text,
  description_ar text not null,
  facts jsonb not null default '{}'::jsonb,
  estimated_value bigint not null,
  opening_price bigint not null,
  min_increment bigint not null default 100,
  currency_code text not null default 'WCOIN',
  rarity text not null default 'common',
  condition_label text,
  source_url text,
  source_name text,
  source_license text,
  source_verified_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auction_items_slug_format check (slug ~ '^[a-z0-9-]{2,100}$'),
  constraint auction_items_values_positive check (
    estimated_value > 0 and opening_price > 0 and min_increment > 0
    and opening_price <= estimated_value * 10
  ),
  constraint auction_items_facts_object check (jsonb_typeof(facts) = 'object'),
  constraint auction_items_rarity check (rarity in ('common','uncommon','rare','epic','legendary','mythic'))
);

create index if not exists auction_items_category_active_idx
  on public.auction_items(category_id, is_active, created_at desc);

create table if not exists public.auction_item_media (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.auction_items(id) on delete cascade,
  media_kind text not null,
  storage_path text,
  external_url text,
  alt_ar text not null,
  attribution text,
  license text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint auction_item_media_kind check (media_kind in ('image','gif')),
  constraint auction_item_media_location check (
    (storage_path is not null and external_url is null)
  ),
  constraint auction_item_media_path_safe check (
    storage_path is null or (nullif(btrim(storage_path),'') is not null and storage_path !~ '(^/|\.\.|\\)')
  )
);

create index if not exists auction_item_media_item_order_idx
  on public.auction_item_media(item_id, sort_order);

alter table public.auction_items add constraint auction_items_active_source_verified check (
 not is_active or (source_url is not null and source_url ~ '^https://' and nullif(btrim(source_name),'') is not null and source_verified_at is not null)
);
alter table public.auction_item_media add constraint auction_item_media_active_license_required check (
 not is_active or (nullif(btrim(attribution),'') is not null and nullif(btrim(license),'') is not null)
);


create table if not exists public.auction_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique,
  host_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'lobby',
  max_players smallint not null default 8,
  starting_budget bigint not null default 100000,
  bid_mode text not null default 'open',
  round_time_seconds integer not null default 45,
  current_item_id uuid references public.auction_items(id) on delete restrict,
  current_price bigint,
  min_increment bigint,
  highest_bidder_id uuid references auth.users(id) on delete set null,
  current_ends_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint auction_rooms_code_format check (room_code ~ '^[A-Z0-9]{6}$'),
  constraint auction_rooms_status check (status in ('lobby','active','completed','cancelled')),
  constraint auction_rooms_players_limit check (max_players between 2 and 8),
  constraint auction_rooms_budget_positive check (starting_budget between 1000 and 1000000000),
  constraint auction_rooms_bid_mode check (bid_mode in ('open','secret')),
  constraint auction_rooms_round_time check (round_time_seconds between 15 and 180),
  constraint auction_rooms_settings_object check (jsonb_typeof(settings) = 'object')
);

create index if not exists auction_rooms_host_status_idx on public.auction_rooms(host_id, status, created_at desc);

create table if not exists public.auction_room_players (
  room_id uuid not null references public.auction_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  seat smallint not null,
  balance bigint not null,
  spent bigint not null default 0,
  total_wins integer not null default 0,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat),
  constraint auction_room_players_seat check (seat between 0 and 7),
  constraint auction_room_players_money check (balance >= 0 and spent >= 0),
  constraint auction_room_players_name check (char_length(display_name) between 2 and 24)
);

create index if not exists auction_room_players_user_idx on public.auction_room_players(user_id, joined_at desc);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.auction_rooms(id) on delete cascade,
  item_id uuid not null references public.auction_items(id) on delete restrict,
  bidder_id uuid not null references auth.users(id) on delete restrict,
  amount bigint not null,
  created_at timestamptz not null default now(),
  constraint auction_bids_amount_positive check (amount > 0)
);

create index if not exists auction_bids_room_time_idx on public.auction_bids(room_id, created_at desc);
create index if not exists auction_bids_item_amount_idx on public.auction_bids(item_id, amount desc);

alter table public.auction_categories enable row level security;
alter table public.auction_items enable row level security;
alter table public.auction_item_media enable row level security;
alter table public.auction_rooms enable row level security;
alter table public.auction_room_players enable row level security;
alter table public.auction_bids enable row level security;

drop policy if exists "auction categories visible" on public.auction_categories;
create policy "auction categories visible" on public.auction_categories
  for select to authenticated using (is_active);

drop policy if exists "active auction items visible" on public.auction_items;
create policy "active auction items visible" on public.auction_items
  for select to authenticated using (is_active);

drop policy if exists "active auction media visible" on public.auction_item_media;
create policy "active auction media visible" on public.auction_item_media
  for select to authenticated using (
    is_active and exists (
      select 1 from public.auction_items i
      where i.id = auction_item_media.item_id and i.is_active
    )
  );



-- First playable text-only catalog: three lots for every active category.
-- No media row is required to list a lot, create a room, start, bid, or advance a round.
insert into public.auction_items (
 category_id,slug,title_ar,subtitle_ar,description_ar,facts,estimated_value,opening_price,min_increment,
 currency_code,rarity,condition_label,source_url,source_name,source_license,source_verified_at,is_active
) values
  ('football-players', 'lionel-messi-2026', 'ليونيل ميسي', 'بطاقة نجم كرة القدم', 'مهاجم إنتر ميامي وقائد منتخب الأرجنتين، بقدمه اليسرى ورقمه 10 حسب ملف MLS الحالي.', '{"النادي":"إنتر ميامي","المنتخب":"الأرجنتين","المركز":"مهاجم","الرقم":"10","القدم المفضلة":"اليسرى"}'::jsonb, 180000, 18000, 2000, 'WCOIN', 'mythic', 'بطاقة معلومات رياضية', 'https://www.mlssoccer.com/messi/', 'MLS — Leo Messi', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('football-players', 'cristiano-ronaldo-2026', 'كريستيانو رونالدو', 'بطاقة الهداف البرتغالي', 'مهاجم نادي النصر ومنتخب البرتغال، ورقمه 7 وفق ملف دوري روشن السعودي.', '{"النادي":"النصر السعودي","المنتخب":"البرتغال","المركز":"مهاجم","الرقم":"7","الجنسية":"برتغالي"}'::jsonb, 175000, 20000, 2500, 'WCOIN', 'mythic', 'بطاقة معلومات رياضية', 'https://www.spl.com.sa/ar/players/cristiano-ronaldo', 'دوري روشن السعودي — كريستيانو رونالدو', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('football-players', 'mohamed-salah-archive', 'محمد صلاح', 'بطاقة أرشيفية لمسيرته مع ليفربول', 'ملف تاريخي لمسيرة اللاعب المصري مع ليفربول بين 2017 و2026. البطاقة أرشيفية ولا تدّعي أن النادي هو ناديه الحالي.', '{"الجنسية":"مصر","المركز":"مهاجم","فترة ليفربول":"2017–2026","المشاركات مع ليفربول":"442","الأهداف مع ليفربول":"257"}'::jsonb, 160000, 17000, 2000, 'WCOIN', 'legendary', 'ملف أرشيفي موثّق', 'https://www.liverpoolfc.com/info/mohamed-salah', 'Liverpool FC — ملف محمد صلاح الأرشيفي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('wrestlers', 'john-cena', 'جون سينا', 'أسطورة WWE', 'مصارع WWE السابق، حقق 17 بطولة عالمية واعتزل المنافسة داخل الحلبة في نهاية 2025.', '{"الاتحاد":"WWE","الإنجاز العالمي":"17 بطولة عالمية","الحالة":"اعتزل المنافسة داخل الحلبة نهاية 2025","الحركة الشهيرة":"Attitude Adjustment"}'::jsonb, 170000, 19000, 2500, 'WCOIN', 'mythic', 'بطاقة شخصية رياضية', 'https://www.wwe.com/superstars/john-cena', 'WWE — John Cena', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('wrestlers', 'roman-reigns', 'رومان رينز', 'زعيم الطاولة', 'من أبرز نجوم WWE، ويذكر ملفه الرسمي فوزه برويال رامبل 2026 وبطولة Crown Jewel للرجال 2026.', '{"الاتحاد":"WWE","اللقب":"The OTC","إنجاز 2026":"الفوز برويال رامبل للرجال","إنجاز آخر":"بطل Crown Jewel للرجال 2026","حركات معروفة":"Spear و Superman Punch"}'::jsonb, 168000, 20000, 2500, 'WCOIN', 'mythic', 'بطاقة شخصية رياضية', 'https://www.wwe.com/superstars/roman-reigns', 'WWE — Roman Reigns', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('wrestlers', 'the-undertaker', 'أندرتيكر', 'الرجل الميت', 'أيقونة WWE؛ بدأ ظهوره في Survivor Series عام 1990 واعتزل في 2020، وأُدخل قاعة مشاهير WWE عام 2022.', '{"الاتحاد":"WWE","أول ظهور":"Survivor Series 1990","الاعتزال":"2020","قاعة المشاهير":"2022","إنجاز بارز":"سلسلة WrestleMania الشهيرة"}'::jsonb, 155000, 17500, 2000, 'WCOIN', 'legendary', 'بطاقة تاريخية للمصارعة', 'https://www.wwe.com/superstars/undertaker', 'WWE — The Undertaker', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('rare-animals', 'vaquita-porpoise', 'الفاكيتا', 'أندر الثدييات البحرية', 'خنزير بحر صغير يعيش في شمال خليج كاليفورنيا بالمكسيك، ومصنف ضمن الأنواع المهددة بخطر انقراض حرج.', '{"الاسم العلمي":"Phocoena sinus","الموطن":"شمال خليج كاليفورنيا","التصنيف":"خطر انقراض حرج","معلومة":"أندر الثدييات البحرية"}'::jsonb, 120000, 12000, 1500, 'WCOIN', 'mythic', 'بطاقة تثقيفية للحفاظ على البيئة', 'https://www.worldwildlife.org/species/dolphin-and-porpoise/vaquita/', 'WWF — Vaquita', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('rare-animals', 'saola', 'الساولا', 'وحيد القرن الآسيوي', 'ثديي نادر اكتُشف علمياً عام 1992، يعيش في جبال أناميت بين لاوس وفيتنام، وحالته حرجة.', '{"الاسم العلمي":"Pseudoryx nghetinhensis","الموطن":"جبال أناميت في لاوس وفيتنام","التصنيف":"خطر انقراض حرج","عدد الأفراد":"غير معروف"}'::jsonb, 115000, 11000, 1500, 'WCOIN', 'mythic', 'بطاقة تثقيفية للحفاظ على البيئة', 'https://www.worldwildlife.org/species/saola/', 'WWF — Saola', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('rare-animals', 'amur-leopard', 'نمر آمور', 'قطّ الغابات الباردة', 'سلالة نادرة من النمور تعيش في غابات معتدلة بشرق روسيا ومناطق من الصين، ومصنفة بخطر انقراض حرج.', '{"الاسم العلمي":"Panthera pardus orientalis","الموطن":"غابات معتدلة في الشرق الروسي والصين","التصنيف":"خطر انقراض حرج","السلوك":"منعزل غالباً"}'::jsonb, 110000, 10500, 1500, 'WCOIN', 'legendary', 'بطاقة تثقيفية للحفاظ على البيئة', 'https://www.worldwildlife.org/species/amur-leopard/', 'WWF — Amur Leopard', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('cars', 'suwad-falcon-gt', 'صقر GT', 'سيارة رياضية افتراضية', 'طراز تخيلي من عالم سَـوَاد وناسة؛ جميع مواصفاته وأرقامه خيالية لأغراض اللعب.', '{"الفئة":"كوبيه رياضية","سنة التصميم":"2030","المحرك":"V8 افتراضي","القوة":"620 حصاناً افتراضياً","نظام الدفع":"خلفي","الحالة":"ممتازة داخل اللعبة"}'::jsonb, 145000, 15000, 2000, 'WCOIN', 'epic', 'مركبة خيالية داخل اللعبة', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('cars', 'nova-electric-x', 'نوفا إلكتريك X', 'سيارة كهربائية مستقبلية', 'تصميم خيالي أصلي لسيارة كهربائية؛ لا يمثل طرازاً تجارياً حقيقياً.', '{"الفئة":"سيدان كهربائية","المدى":"720 كم افتراضياً","التسارع":"3.4 ثانية افتراضياً","البطارية":"حزمة خيالية","الحالة":"جديدة داخل اللعبة"}'::jsonb, 132000, 14000, 1800, 'WCOIN', 'legendary', 'مركبة خيالية داخل اللعبة', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('cars', 'baghdad-classic-72', 'بغداد كلاسيك 72', 'تحفة كلاسيكية خيالية', 'سيارة كلاسيكية مصممة حصراً لكتالوج اللعبة، وليست نسخة حقيقية موثقة.', '{"الفئة":"كلاسيكية","سنة التصميم":"1972 خيالياً","الهيكل":"معدن كلاسيكي","المحرك":"6 أسطوانات افتراضي","الحالة":"مجددة داخل اللعبة"}'::jsonb, 118000, 12500, 1500, 'WCOIN', 'rare', 'مركبة خيالية داخل اللعبة', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('watches', 'elite-automatic', 'إيليت أوتوماتيك', 'ساعة ميكانيكية خيالية', 'تصميم ساعة أصلي خيالي، لا ينتسب إلى علامة تجارية حقيقية.', '{"الآلية":"أوتوماتيكية خيالية","الهيكل":"فولاذ مصقول","القطر":"41 مم","الزجاج":"ياقوت صناعي افتراضي","الإصدار":"01 / 100"}'::jsonb, 98000, 10000, 1200, 'WCOIN', 'epic', 'قطعة خيالية داخل اللعبة', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('watches', 'dawn-gmt', 'داون GMT', 'ساعة المسافر', 'ساعة خيالية صممت لعالم اللعبة مع مؤشر توقيت ثانٍ.', '{"الآلية":"ميكانيكية خيالية","الميزة":"توقيتان GMT","المادة":"تيتانيوم افتراضي","القطر":"40 مم","الإصدار":"محدود"}'::jsonb, 92000, 9500, 1100, 'WCOIN', 'rare', 'قطعة خيالية داخل اللعبة', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('watches', 'river-pearl-limited', 'لؤلؤة النهر', 'إصدار جامع افتراضي', 'قطعة فنية خيالية مستوحاة من ألوان دجلة، وليست منتجاً تجارياً حقيقياً.', '{"الميناء":"أزرق لؤلؤي","الهيكل":"فضة خيالية","الآلية":"كوارتز افتراضي","الإصدار":"واحد من 25"}'::jsonb, 88000, 9000, 1000, 'WCOIN', 'legendary', 'قطعة خيالية داخل اللعبة', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('video-games', 'shadows-of-iraq', 'ظلال الرافدين', 'لعبة مغامرات خيالية', 'عنوان أصلي متخيل في كتالوج المزاد؛ ليس لعبة منشورة أو غلافاً تابعاً لناشر آخر.', '{"النوع":"مغامرات واستكشاف","المنصة":"منصة خيالية","النمط":"لاعب واحد","الإصدار":"جامع افتراضي"}'::jsonb, 92000, 9500, 1200, 'WCOIN', 'epic', 'مقتنى رقمي خيالي', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('video-games', 'last-station', 'المحطة الأخيرة', 'لعبة بقاء خيالية', 'فكرة لعبة أصلية متخيلة، مع ملف إصدار جامع افتراضي.', '{"النوع":"بقاء وقصة","المنصة":"حاسوب خيالي","النمط":"قصة فردية","المحتوى":"عالم أصلي"}'::jsonb, 86000, 9000, 1100, 'WCOIN', 'rare', 'مقتنى رقمي خيالي', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('video-games', 'champions-arena', 'ساحة الأبطال', 'منافسات خيالية', 'لعبة رياضية إلكترونية خيالية داخل عالم سَـوَاد وناسة.', '{"النوع":"رياضة ومنافسة","المنصة":"جهاز ألعاب افتراضي","النمط":"محلي وأونلاين خيالياً","الإصدار":"نسخة البطولة"}'::jsonb, 83000, 8500, 1000, 'WCOIN', 'rare', 'مقتنى رقمي خيالي', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('real-estate', 'sky-garden-residence', 'حدائق السماء', 'مجمع سكني افتراضي', 'عقار خيالي بالكامل داخل مدينة متخيلة؛ لا يمثل عرضاً عقارياً حقيقياً.', '{"المدينة":"مدينة الرافدين الخيالية","المساحة":"420 م²","الغرف":"5","الطوابق":"3","المرافق":"حديقة ومسبح افتراضي"}'::jsonb, 250000, 25000, 3000, 'WCOIN', 'legendary', 'عقار افتراضي غير قابل للتملك الحقيقي', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('real-estate', 'river-view-penthouse', 'بنتهاوس ضفاف النهر', 'إطلالة افتراضية', 'وحدة سكنية خيالية بإطلالة متخيلة على النهر ضمن عالم اللعبة.', '{"المدينة":"مدينة النهر الخيالية","المساحة":"310 م²","الغرف":"4","الطابق":"24","المرافق":"شرفة بانورامية"}'::jsonb, 235000, 23000, 2800, 'WCOIN', 'epic', 'عقار افتراضي غير قابل للتملك الحقيقي', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('real-estate', 'desert-moon-villa', 'فيلا قمر الصحراء', 'منتجع افتراضي', 'فيلا خيالية صممت لكتالوج اللعبة ولا ترتبط بموقع أو ملكية حقيقية.', '{"الموقع":"واحة خيالية","المساحة":"680 م²","الغرف":"6","المرافق":"حديقة ومجلس وساحة","التصميم":"معاصر عربي"}'::jsonb, 220000, 22000, 2500, 'WCOIN', 'epic', 'عقار افتراضي غير قابل للتملك الحقيقي', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('aircraft-ships', 'shaheen-9-jet', 'شاهين 9', 'طائرة رجال أعمال خيالية', 'مركبة جوية خيالية لأغراض اللعب، ولا تمثل طائرة فعلية أو مواصفات تشغيلية معتمدة.', '{"النوع":"طائرة أعمال خيالية","السعة":"14 مقعداً افتراضياً","المدى":"7200 كم داخل عالم اللعبة","التصنيف":"مدني افتراضي","الحالة":"ممتازة"}'::jsonb, 300000, 30000, 3500, 'WCOIN', 'legendary', 'مركبة افتراضية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('aircraft-ships', 'rafidain-frigate', 'فرقاطة الرافدين', 'سفينة خيالية للاستكشاف', 'سفينة خيالية مدنية للبحث والإنقاذ والاستكشاف؛ لا تتضمن تسليحاً أو مواصفات قتالية.', '{"النوع":"سفينة بحث وإنقاذ خيالية","الطول":"128 م افتراضياً","الطاقم":"80 داخل اللعبة","المهام":"بحث وإنقاذ","الحالة":"جاهزة"}'::jsonb, 285000, 28000, 3200, 'WCOIN', 'epic', 'مركبة افتراضية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('aircraft-ships', 'gulf-pearl-research-vessel', 'لؤلؤة الخليج', 'سفينة أبحاث بحرية', 'سفينة أبحاث خيالية مصممة لاستكشاف أعماق البحار في عالم اللعبة.', '{"النوع":"سفينة أبحاث","الطول":"96 م افتراضياً","المهمة":"أبحاث المحيطات","المختبرات":"3 افتراضية","الحالة":"حديثة"}'::jsonb, 265000, 26000, 3000, 'WCOIN', 'rare', 'مركبة افتراضية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('antiques', 'abbasid-palace-mirror-replica', 'مرآة القصر العباسي', 'نسخة فنية تخيلية', 'قطعة خيالية مستوحاة من الزخارف العباسية؛ نسخة لعبة وليست أثراً أصلياً أو مقتنى تاريخياً موثقاً.', '{"النوع":"نسخة فنية خيالية","الإلهام":"زخارف عباسية","المادة":"نحاس افتراضي","التوثيق":"قصة خيالية داخل اللعبة"}'::jsonb, 130000, 13000, 1500, 'WCOIN', 'epic', 'نسخة افتراضية وليست أثراً حقيقياً', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('antiques', 'sumerian-seal-replica', 'ختم سومري تخيلي', 'نسخة تعليمية افتراضية', 'تصميم خيالي مستوحى من الأختام الأسطوانية القديمة؛ لا يدّعي أنه قطعة أثرية أصلية.', '{"النوع":"نسخة افتراضية","الإلهام":"الأختام الأسطوانية في بلاد الرافدين","المادة":"حجر صناعي خيالي","العمر":"غير منطبق؛ قطعة لعبة"}'::jsonb, 125000, 12500, 1400, 'WCOIN', 'legendary', 'نسخة افتراضية وليست أثراً حقيقياً', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('antiques', 'iraqi-brass-astrolabe', 'أسطرلاب نحاسي عراقي', 'قطعة متخيلة لهواة التاريخ', 'تصميم لعبة أصلي مستوحى من أدوات الفلك التاريخية؛ ليس جهازاً تاريخياً موثقاً أو أثراً للبيع.', '{"النوع":"أسطرلاب خيالي","المادة":"نحاس افتراضي","الإلهام":"التراث العلمي في المنطقة","التوثيق":"تصميم خيالي"}'::jsonb, 118000, 11800, 1300, 'WCOIN', 'rare', 'نسخة افتراضية وليست أثراً حقيقياً', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('rare-cards', 'legends-collection-01', 'مجموعة الأساطير 01', 'بطاقة تجميع خيالية', 'سلسلة بطاقات أصلية متخيلة للمزاد، لا تستخدم صور لاعبين أو شخصيات محمية.', '{"السلسلة":"أساطير الوناسة","الرقم":"01","الندرة":"أسطورية","الإصدار":"واحد من 50"}'::jsonb, 85000, 8500, 1000, 'WCOIN', 'legendary', 'بطاقة رقمية أصلية خيالية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('rare-cards', 'golden-striker-card', 'المهاجم الذهبي', 'بطاقة رياضية خيالية', 'شخصية رياضية خيالية بالكامل، وليست بطاقة لاعب حقيقي أو علامة تجارية.', '{"الفئة":"مهاجم","التقييم":"97 افتراضياً","المهارة":"تسديدة دقيقة","الإصدار":"واحد من 75"}'::jsonb, 82000, 8200, 950, 'WCOIN', 'epic', 'بطاقة رقمية أصلية خيالية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('rare-cards', 'neon-guardian-card', 'حارس النيون', 'بطاقة عالم خيالي', 'بطاقة جمع أصلية من عالم مستقبلي متخيل.', '{"العالم":"مدينة النيون الخيالية","الفئة":"حارس","المهارة":"درع ضوئي","الإصدار":"واحد من 25"}'::jsonb, 78000, 7800, 900, 'WCOIN', 'rare', 'بطاقة رقمية أصلية خيالية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('fictional-gear', 'sindbad-aegis', 'درع السندباد', 'أداة حماية سحرية', 'قطعة سحرية خيالية غير واقعية، مخصصة لعالم اللعبة ولا تمثل سلاحاً أو أداة حقيقية.', '{"العالم":"أساطير البحار","الفئة":"حماية","القدرة":"حاجز ضوئي","المستوى":"أسطوري"}'::jsonb, 100000, 10000, 1200, 'WCOIN', 'legendary', 'أداة خيالية داخل اللعبة فقط', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('fictional-gear', 'dawn-cloak', 'عباءة الفجر', 'قطعة خيالية نادرة', 'عباءة سحرية متخيلة تمنح حاملها أثراً ضوئياً داخل عالم اللعبة فقط.', '{"العالم":"مدينة الفجر","الفئة":"زي سحري","القدرة":"أثر ضوئي","المستوى":"نادر"}'::jsonb, 95000, 9500, 1100, 'WCOIN', 'epic', 'أداة خيالية داخل اللعبة فقط', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('fictional-gear', 'moon-compass', 'بوصلة القمر', 'أداة استكشاف سحرية', 'بوصلة خيالية تشير إلى المسارات المتخيلة في عالم المزاد.', '{"العالم":"جزر القمر","الفئة":"استكشاف","القدرة":"تحديد المسار الخيالي","المستوى":"نادر"}'::jsonb, 90000, 9000, 1000, 'WCOIN', 'rare', 'أداة خيالية داخل اللعبة فقط', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('mystery-lots', 'desert-expedition-box', 'صندوق بعثة الصحراء', 'مفاجأة افتراضية', 'صندوق خيالي يحتوي تلميحات عن خريطة ورقية وبوصلة تذكارية افتراضيتين؛ المحتوى كله داخل اللعبة.', '{"التلميح الأول":"أثر طريق قديم","التلميح الثاني":"أداة استكشاف","عدد المحتويات":"3 عناصر افتراضية","مستوى الغموض":"عالٍ"}'::jsonb, 65000, 6500, 800, 'WCOIN', 'rare', 'صندوق افتراضي لا يحتوي منتجات حقيقية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('mystery-lots', 'retro-gamer-box', 'صندوق اللاعب القديم', 'رحلة إلى ألعاب الماضي', 'صندوق مفاجآت رقمي يتضمن تلميحات عن جهاز لعب خيالي وبطاقتين من مجموعة اللعبة.', '{"التلميح الأول":"تقنية محمولة","التلميح الثاني":"بطاقات جمع","عدد المحتويات":"4 عناصر افتراضية","مستوى الغموض":"متوسط"}'::jsonb, 70000, 7000, 850, 'WCOIN', 'epic', 'صندوق افتراضي لا يحتوي منتجات حقيقية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true),
  ('mystery-lots', 'starship-cargo-box', 'شحنة المركبة النجمية', 'حمولة من عالم خيالي', 'صندوق خيالي من رحلة فضائية متصورة؛ لا يتضمن إلا مقتنيات افتراضية في اللعبة.', '{"التلميح الأول":"إشارة من المدار","التلميح الثاني":"قطعة من المركبة","عدد المحتويات":"5 عناصر افتراضية","مستوى الغموض":"عالٍ"}'::jsonb, 78000, 7800, 900, 'WCOIN', 'legendary', 'صندوق افتراضي لا يحتوي منتجات حقيقية', 'https://github.com/callmobile2004-source/suwad-wanasa/blob/feat/auction-game-foundation/docs/auction-text-catalog.md', 'كتالوج سَـوَاد وناسة الأصلي', 'ملخص وصفي أصلي مع الإشارة إلى المرجع؛ لا تُستخدم وسائط المصدر', now(), true)
on conflict (slug) do nothing;

-- Non-recursive membership predicate for RLS on auction_room_players.
create or replace function private.is_auction_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $member$
  select auth.uid() is not null and exists (
    select 1 from public.auction_room_players p
    where p.room_id = p_room_id and p.user_id = auth.uid()
  );
$member$;

revoke all on function private.is_auction_room_member(uuid) from public, anon;
grant execute on function private.is_auction_room_member(uuid) to authenticated;

drop policy if exists "auction room members read rooms" on public.auction_rooms;
create policy "auction room members read rooms" on public.auction_rooms
  for select to authenticated using (
    private.is_auction_room_member(id)
  );

drop policy if exists "auction room members read players" on public.auction_room_players;
create policy "auction room members read players" on public.auction_room_players
  for select to authenticated using (
    private.is_auction_room_member(room_id)
  );

drop policy if exists "open auction bids visible to room members" on public.auction_bids;
create policy "open auction bids visible to room members" on public.auction_bids
  for select to authenticated using (
    exists (select 1 from public.auction_rooms r
      where r.id = auction_bids.room_id and r.bid_mode = 'open')
    and private.is_auction_room_member(room_id)
  );

revoke all on public.auction_categories, public.auction_items, public.auction_item_media,
  public.auction_rooms, public.auction_room_players, public.auction_bids from anon, authenticated;
grant select on public.auction_categories, public.auction_items, public.auction_item_media to authenticated;
grant select on public.auction_rooms, public.auction_room_players, public.auction_bids to authenticated;

-- Private delivery for approved catalog assets. Signed URLs are issued only after room membership is verified. No client upload policy is created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'auction-assets', 'auction-assets', false, 8388608,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Atomic auction lifecycle and bid engine (server role only).

create table if not exists public.auction_room_lots (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.auction_rooms(id) on delete cascade,
 round_number integer not null, item_id uuid not null references public.auction_items(id) on delete restrict,
 opening_price bigint not null, final_price bigint, winner_id uuid references auth.users(id) on delete set null,
 status text not null default 'active', started_at timestamptz not null default now(), ended_at timestamptz,
 unique(room_id,round_number), unique(room_id,item_id), check(round_number between 1 and 50),
 check(status in ('active','sold','unsold'))
);
create index if not exists auction_room_lots_room_round_idx on public.auction_room_lots(room_id,round_number);
alter table public.auction_room_lots enable row level security;
revoke all on public.auction_room_lots from anon,authenticated;
create table if not exists public.auction_room_secret_state (
 room_id uuid primary key references public.auction_rooms(id) on delete cascade,
 current_price bigint not null, highest_bidder_id uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.auction_room_secret_state enable row level security;
revoke all on public.auction_room_secret_state from public,anon,authenticated;

create or replace function public.auction_create_room(p_actor_id uuid,p_category_id text,p_display_name text,p_max_players smallint,p_budget bigint,p_bid_mode text,p_round_time_seconds integer,p_rounds_total integer)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; code text; n integer;
begin
 if p_actor_id is null or p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 24 or p_max_players not between 2 and 8 or p_budget not between 1000 and 1000000000 or p_bid_mode not in ('open','secret') or p_round_time_seconds not between 15 and 180 or p_rounds_total not between 1 and 20 then raise exception using errcode='22023',message='Invalid auction room settings'; end if;
 if not exists(select 1 from public.auction_categories c where c.id=p_category_id and c.is_active) then raise exception using errcode='22023',message='Invalid category'; end if;
 if (select count(*) from public.auction_items i where i.category_id=p_category_id and i.is_active)<p_rounds_total then raise exception using errcode='55000',message='Not enough active lots'; end if;
 for n in 1..8 loop code:=upper(substr(md5(gen_random_uuid()::text||clock_timestamp()::text),1,6)); exit when not exists(select 1 from public.auction_rooms where room_code=code); end loop;
 if exists(select 1 from public.auction_rooms where room_code=code) then raise exception using errcode='55000',message='Could not allocate room code'; end if;
 insert into public.auction_rooms(room_code,host_id,max_players,starting_budget,bid_mode,round_time_seconds,settings) values(code,p_actor_id,p_max_players,p_budget,p_bid_mode,p_round_time_seconds,jsonb_build_object('categoryId',p_category_id,'roundsTotal',p_rounds_total)) returning * into r;
 insert into public.auction_room_players(room_id,user_id,display_name,seat,balance) values(r.id,p_actor_id,btrim(p_display_name),0,p_budget);
 return r;
end;$fn$;

create or replace function public.auction_join_room(p_actor_id uuid,p_room_code text,p_display_name text,p_category_id text)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; next_seat integer;
begin
 if p_actor_id is null or p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 24 or p_room_code !~ '^[A-Z0-9]{6}$' or p_category_id is null then raise exception using errcode='22023',message='Invalid join details'; end if;
 select * into r from public.auction_rooms where room_code=upper(p_room_code) for update;
 if not found then raise exception using errcode='P0002',message='Room not found'; end if;
 if r.settings->>'categoryId' is distinct from p_category_id then raise exception using errcode='22023',message='Room belongs to another category'; end if;
 if exists(select 1 from public.auction_room_players p where p.room_id=r.id and p.user_id=p_actor_id) then return r; end if;
 if r.status<>'lobby' then raise exception using errcode='55000',message='Auction already started'; end if;
 select gs into next_seat from generate_series(0,r.max_players-1) as gs where not exists(select 1 from public.auction_room_players p where p.room_id=r.id and p.seat=gs) order by gs limit 1;
 if next_seat is null then raise exception using errcode='55000',message='Room full'; end if;
 insert into public.auction_room_players(room_id,user_id,display_name,seat,balance) values(r.id,p_actor_id,btrim(p_display_name),next_seat,r.starting_budget);
 update public.auction_rooms set updated_at=clock_timestamp() where id=r.id returning * into r; return r;
end;$fn$;

create or replace function public.auction_start_room(p_room_id uuid,p_actor_id uuid)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; item public.auction_items;
begin
 select * into r from public.auction_rooms where id=p_room_id for update;
 if not found then raise exception using errcode='P0002',message='Room not found'; end if;
 if r.host_id<>p_actor_id then raise exception using errcode='42501',message='Only host can start'; end if;
 if r.status<>'lobby' then raise exception using errcode='55000',message='Room not in lobby'; end if;
 if (select count(*) from public.auction_room_players p where p.room_id=r.id)<2 then raise exception using errcode='55000',message='At least two players required'; end if;
 select * into item from public.auction_items i where i.category_id=r.settings->>'categoryId' and i.is_active order by random() limit 1;
 if not found then raise exception using errcode='55000',message='No active lots'; end if;
 insert into public.auction_room_lots(room_id,round_number,item_id,opening_price) values(r.id,1,item.id,item.opening_price);
 if r.bid_mode='secret' then insert into public.auction_room_secret_state(room_id,current_price) values(r.id,item.opening_price); end if;
 update public.auction_rooms set status='active',current_item_id=item.id,current_price=case when r.bid_mode='open' then item.opening_price else null end,min_increment=item.min_increment,highest_bidder_id=null,current_ends_at=clock_timestamp()+make_interval(secs=>r.round_time_seconds),updated_at=clock_timestamp() where id=r.id returning * into r;
 return r;
end;$fn$;

create or replace function public.auction_place_bid(p_room_id uuid,p_actor_id uuid,p_amount bigint,p_expected_updated_at timestamptz)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; player public.auction_room_players; top_price bigint; next_minimum bigint;
begin
 if p_actor_id is null or p_amount is null or p_amount<=0 then raise exception using errcode='22023',message='Invalid bid'; end if;
 select * into r from public.auction_rooms where id=p_room_id for update;
 if not found then raise exception using errcode='P0002',message='Room not found'; end if;
 if r.status<>'active' or r.current_item_id is null or r.current_ends_at is null or r.current_ends_at<=now() then raise exception using errcode='55000',message='Bidding closed'; end if;
 if p_expected_updated_at is not null and r.updated_at<>p_expected_updated_at then raise exception using errcode='40001',message='Stale room state'; end if;
 select * into player from public.auction_room_players where room_id=p_room_id and user_id=p_actor_id for update;
 if not found then raise exception using errcode='42501',message='Not a member'; end if;
 if r.bid_mode='open' and exists(select 1 from public.auction_bids b where b.room_id=p_room_id and b.bidder_id=p_actor_id and b.created_at>clock_timestamp()-interval '1 second') then raise exception using errcode='P0001',message='Bid cooldown'; end if;
 if r.bid_mode='secret' then
  select opening_price into top_price from public.auction_room_lots where room_id=p_room_id and item_id=r.current_item_id and status='active';
  if exists(select 1 from public.auction_bids b where b.room_id=p_room_id and b.item_id=r.current_item_id and b.bidder_id=p_actor_id) then raise exception using errcode='23505',message='One sealed bid per player per lot'; end if;
  next_minimum:=coalesce(top_price,0)+coalesce(r.min_increment,1);
 else
  top_price:=r.current_price;
  next_minimum:=coalesce(top_price,0)+coalesce(r.min_increment,1);
 end if;
 if p_amount<next_minimum then raise exception using errcode='22023',message='Bid below minimum'; end if;
 if p_amount>player.balance then raise exception using errcode='22023',message='Bid exceeds budget'; end if;
 insert into public.auction_bids(room_id,item_id,bidder_id,amount) values(p_room_id,r.current_item_id,p_actor_id,p_amount);
 if r.bid_mode='secret' then
  update public.auction_room_secret_state set current_price=greatest(current_price,p_amount),
    highest_bidder_id=case when p_amount>current_price then p_actor_id else highest_bidder_id end,updated_at=clock_timestamp() where room_id=p_room_id;
 else update public.auction_rooms set current_price=p_amount,highest_bidder_id=p_actor_id where id=p_room_id; end if;
 update public.auction_rooms set current_ends_at=case when current_ends_at-now()<interval '8 seconds' then current_ends_at+interval '8 seconds' else current_ends_at end,updated_at=clock_timestamp() where id=p_room_id returning * into r;
 return r;
end;$fn$;

create or replace function public.auction_close_lot(p_room_id uuid,p_actor_id uuid,p_expected_item_id uuid)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; top_price bigint; winner uuid; lot_round integer; total_rounds integer; next_item public.auction_items; player public.auction_room_players;
begin
 select * into r from public.auction_rooms where id=p_room_id for update;
 if not found then raise exception using errcode='P0002',message='Room not found'; end if;
 if not exists(select 1 from public.auction_room_players p where p.room_id=r.id and p.user_id=p_actor_id) then raise exception using errcode='42501',message='Not a member'; end if;
 if r.host_id<>p_actor_id and r.current_ends_at>now() then raise exception using errcode='42501',message='Only host may close early'; end if;
 if r.status<>'active' then raise exception using errcode='55000',message='Room not active'; end if;
 if p_expected_item_id is null or r.current_item_id is distinct from p_expected_item_id then raise exception using errcode='40001',message='Auction lot has already advanced'; end if;
 if r.bid_mode='secret' then select current_price,highest_bidder_id into top_price,winner from public.auction_room_secret_state where room_id=r.id for update; else top_price:=r.current_price; winner:=r.highest_bidder_id; end if;
 select coalesce(max(round_number),0) into lot_round from public.auction_room_lots where room_id=r.id;
 total_rounds:=coalesce((r.settings->>'roundsTotal')::integer,1);
 update public.auction_room_lots set final_price=case when winner is null then null else top_price end,winner_id=winner,status=case when winner is null then 'unsold' else 'sold' end,ended_at=clock_timestamp() where room_id=r.id and round_number=lot_round and status='active';
 if winner is not null then
  select * into player from public.auction_room_players where room_id=r.id and user_id=winner for update;
  if not found or player.balance<top_price then raise exception using errcode='22023',message='Winner budget changed'; end if;
  update public.auction_room_players set balance=balance-top_price,spent=spent+top_price,total_wins=total_wins+1 where room_id=r.id and user_id=winner;
 end if;
 delete from public.auction_room_secret_state where room_id=r.id;
 if lot_round>=total_rounds then update public.auction_rooms set status='completed',current_item_id=null,current_price=null,highest_bidder_id=null,current_ends_at=null,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id returning * into r; return r; end if;
 select * into next_item from public.auction_items i where i.category_id=r.settings->>'categoryId' and i.is_active and not exists(select 1 from public.auction_room_lots l where l.room_id=r.id and l.item_id=i.id) order by random() limit 1;
 if not found then update public.auction_rooms set status='completed',current_item_id=null,current_price=null,highest_bidder_id=null,current_ends_at=null,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=r.id returning * into r; return r; end if;
 lot_round:=lot_round+1;
 insert into public.auction_room_lots(room_id,round_number,item_id,opening_price) values(r.id,lot_round,next_item.id,next_item.opening_price);
 if r.bid_mode='secret' then insert into public.auction_room_secret_state(room_id,current_price) values(r.id,next_item.opening_price); end if;
 update public.auction_rooms set current_item_id=next_item.id,current_price=case when r.bid_mode='open' then next_item.opening_price else null end,min_increment=next_item.min_increment,highest_bidder_id=null,current_ends_at=clock_timestamp()+make_interval(secs=>r.round_time_seconds),updated_at=clock_timestamp() where id=r.id returning * into r;
 return r;
end;$fn$;

revoke all on function public.auction_create_room(uuid,text,text,smallint,bigint,text,integer,integer) from public,anon,authenticated;
revoke all on function public.auction_join_room(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.auction_start_room(uuid,uuid) from public,anon,authenticated;
revoke all on function public.auction_close_lot(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.auction_place_bid(uuid,uuid,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.auction_create_room(uuid,text,text,smallint,bigint,text,integer,integer) to service_role;
grant execute on function public.auction_join_room(uuid,text,text,text) to service_role;
grant execute on function public.auction_start_room(uuid,uuid) to service_role;
grant execute on function public.auction_close_lot(uuid,uuid,uuid) to service_role;
grant execute on function public.auction_place_bid(uuid,uuid,bigint,timestamptz) to service_role;

-- Enable room/player row notifications for authenticated Realtime subscribers.
do $realtime$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='auction_rooms') then
   execute 'alter publication supabase_realtime add table public.auction_rooms';
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='auction_room_players') then
   execute 'alter publication supabase_realtime add table public.auction_room_players';
  end if;
 end if;
end;
$realtime$;

grant all on public.auction_room_lots,public.auction_room_secret_state to service_role;

grant all on public.auction_categories,public.auction_items,public.auction_item_media,public.auction_rooms,public.auction_room_players,public.auction_bids,public.auction_room_lots,public.auction_room_secret_state to service_role;
