-- Auction game foundation. Additive only: does not alter existing room/game tables.
-- Catalog media is public-read; uploads remain server-managed (service_role only).
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
    or (storage_path is null and external_url ~ '^https://')
  ),
  constraint auction_item_media_path_safe check (
    storage_path is null or (storage_path !~ '(^/|\.\.|\\)')
  )
);

create index if not exists auction_item_media_item_order_idx
  on public.auction_item_media(item_id, sort_order);

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
  for select to anon, authenticated using (is_active);

drop policy if exists "active auction items visible" on public.auction_items;
create policy "active auction items visible" on public.auction_items
  for select to anon, authenticated using (is_active);

drop policy if exists "active auction media visible" on public.auction_item_media;
create policy "active auction media visible" on public.auction_item_media
  for select to anon, authenticated using (
    is_active and exists (
      select 1 from public.auction_items i
      where i.id = auction_item_media.item_id and i.is_active
    )
  );

drop policy if exists "auction room members read rooms" on public.auction_rooms;
create policy "auction room members read rooms" on public.auction_rooms
  for select to authenticated using (
    exists (select 1 from public.auction_room_players p
      where p.room_id = auction_rooms.id and p.user_id = (select auth.uid()))
  );

drop policy if exists "auction room members read players" on public.auction_room_players;
create policy "auction room members read players" on public.auction_room_players
  for select to authenticated using (
    exists (select 1 from public.auction_room_players self
      where self.room_id = auction_room_players.room_id and self.user_id = (select auth.uid()))
  );

drop policy if exists "open auction bids visible to room members" on public.auction_bids;
create policy "open auction bids visible to room members" on public.auction_bids
  for select to authenticated using (
    exists (select 1 from public.auction_rooms r
      join public.auction_room_players p on p.room_id = r.id
      where r.id = auction_bids.room_id
        and r.bid_mode = 'open'
        and p.user_id = (select auth.uid()))
  );

revoke all on public.auction_categories, public.auction_items, public.auction_item_media,
  public.auction_rooms, public.auction_room_players, public.auction_bids from anon, authenticated;
grant select on public.auction_categories, public.auction_items, public.auction_item_media to anon, authenticated;
grant select on public.auction_rooms, public.auction_room_players, public.auction_bids to authenticated;

-- Public CDN delivery for approved catalog assets. No client upload policy is created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'auction-assets', 'auction-assets', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 8388608,
  allowed_mime_types = excluded.allowed_mime_types;

-- Atomic bid placement. Only the authenticated Edge Function's service role may call this.
create or replace function public.auction_place_bid(
  p_room_id uuid,
  p_actor_id uuid,
  p_amount bigint,
  p_expected_updated_at timestamptz
) returns public.auction_rooms
language plpgsql
security definer
set search_path = ''
as $auction_bid$
declare
  r public.auction_rooms;
  player public.auction_room_players;
  next_minimum bigint;
begin
  if p_actor_id is null or p_amount is null or p_amount <= 0 then
    raise exception using errcode = '22023', message = 'Invalid bid input';
  end if;

  select * into r from public.auction_rooms
    where id = p_room_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Auction room not found';
  end if;
  if r.status <> 'active' or r.current_item_id is null or r.current_ends_at is null
     or r.current_ends_at <= now() then
    raise exception using errcode = '55000', message = 'Auction is not accepting bids';
  end if;
  if p_expected_updated_at is not null and r.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'Auction state changed; refresh and retry';
  end if;

  select * into player from public.auction_room_players
    where room_id = p_room_id and user_id = p_actor_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'Bidder is not a room member';
  end if;

  next_minimum := coalesce(r.current_price, 0) + coalesce(r.min_increment, 1);
  if p_amount < next_minimum then
    raise exception using errcode = '22023', message = 'Bid is below the next minimum';
  end if;
  if p_amount > player.balance then
    raise exception using errcode = '22023', message = 'Bid exceeds remaining budget';
  end if;

  insert into public.auction_bids(room_id, item_id, bidder_id, amount)
    values (p_room_id, r.current_item_id, p_actor_id, p_amount);

  update public.auction_rooms set
    current_price = p_amount,
    highest_bidder_id = p_actor_id,
    current_ends_at = case
      when current_ends_at - now() < interval '8 seconds'
        then current_ends_at + interval '8 seconds'
      else current_ends_at
    end,
    updated_at = clock_timestamp()
  where id = p_room_id
  returning * into r;

  return r;
end;
$auction_bid$;

revoke all on function public.auction_place_bid(uuid, uuid, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.auction_place_bid(uuid, uuid, bigint, timestamptz) to service_role;
