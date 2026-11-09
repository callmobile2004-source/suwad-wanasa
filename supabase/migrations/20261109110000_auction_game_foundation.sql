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
grant select on public.auction_categories, public.auction_items, public.auction_item_media to anon, authenticated;
grant select on public.auction_rooms, public.auction_room_players, public.auction_bids to authenticated;

-- Public CDN delivery for approved catalog assets. No client upload policy is created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'auction-assets', 'auction-assets', true, 8388608,
  array['image/jpeg','image/png','image/webp','image/avif','image/gif']
)
on conflict (id) do nothing;

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

create or replace function public.auction_join_room(p_actor_id uuid,p_room_code text,p_display_name text)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; next_seat integer;
begin
 if p_actor_id is null or p_display_name is null or char_length(btrim(p_display_name)) not between 2 and 24 or p_room_code !~ '^[A-Z0-9]{6} then raise exception using errcode='22023',message='Invalid join details'; end if;
 select * into r from public.auction_rooms where room_code=upper(p_room_code) for update;
 if not found then raise exception using errcode='P0002',message='Room not found'; end if;
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

create or replace function public.auction_close_lot(p_room_id uuid,p_actor_id uuid)
returns public.auction_rooms language plpgsql security definer set search_path='' as $fn$
declare r public.auction_rooms; top_price bigint; winner uuid; lot_round integer; total_rounds integer; next_item public.auction_items; player public.auction_room_players;
begin
 select * into r from public.auction_rooms where id=p_room_id for update;
 if not found then raise exception using errcode='P0002',message='Room not found'; end if;
 if not exists(select 1 from public.auction_room_players p where p.room_id=r.id and p.user_id=p_actor_id) then raise exception using errcode='42501',message='Not a member'; end if;
 if r.host_id<>p_actor_id and r.current_ends_at>now() then raise exception using errcode='42501',message='Only host may close early'; end if;
 if r.status<>'active' then raise exception using errcode='55000',message='Room not active'; end if;
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
revoke all on function public.auction_join_room(uuid,text,text) from public,anon,authenticated;
revoke all on function public.auction_start_room(uuid,uuid) from public,anon,authenticated;
revoke all on function public.auction_close_lot(uuid,uuid) from public,anon,authenticated;
revoke all on function public.auction_place_bid(uuid,uuid,bigint,timestamptz) from public,anon,authenticated;
grant execute on function public.auction_create_room(uuid,text,text,smallint,bigint,text,integer,integer) to service_role;
grant execute on function public.auction_join_room(uuid,text,text) to service_role;
grant execute on function public.auction_start_room(uuid,uuid) to service_role;
grant execute on function public.auction_close_lot(uuid,uuid) to service_role;
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
