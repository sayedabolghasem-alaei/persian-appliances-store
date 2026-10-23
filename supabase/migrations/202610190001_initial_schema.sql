-- Initial schema for Khanehgi. Monetary values are integer TOMAN; never use float.
create extension if not exists pgcrypto;

create type public.app_role as enum ('customer','staff','admin');
create type public.order_status as enum ('pending','confirmed','processing','shipped','delivered','cancelled');
create type public.payment_status as enum ('unpaid','pending','paid','failed','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  primary key(user_id, role)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  slug text not null unique,
  name text not null,
  sku text not null unique,
  model text,
  description text,
  price_toman bigint not null check(price_toman >= 0),
  compare_at_price_toman bigint check(compare_at_price_toman is null or compare_at_price_toman >= price_toman),
  currency_code char(3) not null default 'IRR',
  price_unit text not null default 'toman' check(price_unit = 'toman'),
  pricing_mode text not null default 'manual' check(pricing_mode in ('manual','exchange_rate')),
  foreign_cost numeric(20,4) check(foreign_cost is null or foreign_cost >= 0),
  foreign_currency char(3),
  margin_percent numeric(7,3) not null default 0 check(margin_percent between 0 and 500),
  additional_cost_toman bigint not null default 0 check(additional_cost_toman >= 0),
  is_published boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_published_idx on public.products(category_id, is_published);
create index products_brand_published_idx on public.products(brand_id, is_published);
create index products_updated_idx on public.products(updated_at desc);
create index products_name_search_idx on public.products using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(model,'') || ' ' || coalesce(sku,'')));

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  options jsonb not null default '{}'::jsonb,
  price_delta_toman bigint not null default 0,
  is_active boolean not null default true
);
create table public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  value_type text not null default 'text' check(value_type in ('text','number','boolean'))
);
create table public.product_attribute_values (
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_id uuid not null references public.product_attributes(id) on delete cascade,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  primary key(product_id, attribute_id)
);
create table public.inventory (
  product_id uuid primary key references public.products(id) on delete cascade,
  quantity integer not null default 0 check(quantity >= 0),
  reserved_quantity integer not null default 0 check(reserved_quantity >= 0 and reserved_quantity <= quantity),
  low_stock_threshold integer not null default 3 check(low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  previous_price_toman bigint not null check(previous_price_toman >= 0),
  new_price_toman bigint not null check(new_price_toman >= 0),
  source text not null,
  exchange_rate_record_id uuid,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.exchange_rate_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider_kind text not null check(provider_kind in ('manual','api')),
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.exchange_rate_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.exchange_rate_sources(id) on delete restrict,
  base_currency char(3) not null,
  quote_currency char(3) not null default 'IRR',
  rate numeric(20,6) not null check(rate > 0),
  observed_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','stale')),
  entered_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check(base_currency <> quote_currency)
);
create index exchange_rate_lookup_idx on public.exchange_rate_records(base_currency,quote_currency,status,observed_at desc);
alter table public.price_history add constraint price_history_exchange_rate_fk foreign key(exchange_rate_record_id) references public.exchange_rate_records(id) on delete set null;

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  guest_token_hash text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) <> (guest_token_hash is not null))
);
create table public.cart_items (
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null check(quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  id uuid primary key default gen_random_uuid(),
  unique(cart_id, product_id, variant_id)
);
create unique index cart_items_variant_unique_idx on public.cart_items(cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.wishlist_items (
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(wishlist_id, product_id)
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'منزل',
  recipient_name text not null,
  phone text not null,
  province text not null,
  city text not null,
  address_line text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses(user_id);
create table public.shipping_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price_toman bigint not null default 0 check(price_toman >= 0),
  is_enabled boolean not null default false,
  estimated_days_min integer,
  estimated_days_max integer,
  created_at timestamptz not null default now()
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_kind text not null check(discount_kind in ('fixed','percent')),
  discount_value bigint not null check(discount_value > 0),
  max_redemptions integer,
  redeemed_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default false,
  check(discount_kind <> 'percent' or discount_value <= 100)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  user_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  shipping_address_snapshot jsonb not null,
  shipping_method_id uuid references public.shipping_methods(id) on delete set null,
  subtotal_toman bigint not null check(subtotal_toman >= 0),
  discount_toman bigint not null default 0 check(discount_toman >= 0),
  shipping_toman bigint not null default 0 check(shipping_toman >= 0),
  total_toman bigint not null check(total_toman >= 0),
  currency_code char(3) not null default 'IRR',
  price_unit text not null default 'toman' check(price_unit = 'toman'),
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(total_toman = subtotal_toman - discount_toman + shipping_toman)
);
create index orders_user_created_idx on public.orders(user_id,created_at desc);
create index orders_status_created_idx on public.orders(status,created_at desc);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  sku_snapshot text not null,
  variant_snapshot jsonb not null default '{}'::jsonb,
  unit_price_toman bigint not null check(unit_price_toman >= 0),
  quantity integer not null check(quantity between 1 and 99),
  line_total_toman bigint generated always as (unit_price_toman * quantity) stored
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_reference text,
  amount_toman bigint not null check(amount_toman >= 0),
  status public.payment_status not null default 'pending',
  verified_at timestamptz,
  raw_callback jsonb,
  created_at timestamptz not null default now()
);
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  discount_toman bigint not null check(discount_toman >= 0),
  created_at timestamptz not null default now(),
  unique(coupon_id,order_id)
);
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id,created_at desc);

-- Helper is SECURITY DEFINER but has a fixed search_path and is only used by RLS.
create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists(select 1 from public.user_roles where user_id = auth.uid() and role = required_role) $$;
revoke all on function public.has_role(public.app_role) from public;
grant execute on function public.has_role(public.app_role) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_attributes enable row level security;
alter table public.product_attribute_values enable row level security;
alter table public.inventory enable row level security;
alter table public.price_history enable row level security;
alter table public.exchange_rate_sources enable row level security;
alter table public.exchange_rate_records enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read own" on public.profiles for select to authenticated using(id = auth.uid() or public.has_role('admin'));
create policy "profiles update own" on public.profiles for update to authenticated using(id = auth.uid()) with check(id = auth.uid());
create policy "profiles insert own" on public.profiles for insert to authenticated with check(id = auth.uid());
create policy "roles read own or admin" on public.user_roles for select to authenticated using(user_id = auth.uid() or public.has_role('admin'));
-- Intentionally no client insert/update/delete policy for user_roles.
create policy "public read active categories" on public.categories for select to anon,authenticated using(is_active or public.has_role('admin'));
create policy "admin manage categories" on public.categories for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read active brands" on public.brands for select to anon,authenticated using(is_active or public.has_role('admin'));
create policy "admin manage brands" on public.brands for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read published products" on public.products for select to anon,authenticated using(is_published or public.has_role('admin') or public.has_role('staff'));
create policy "admin manage products" on public.products for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read images for published products" on public.product_images for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.is_published) or public.has_role('admin') or public.has_role('staff'));
create policy "staff manage product images" on public.product_images for all to authenticated using(public.has_role('admin') or public.has_role('staff')) with check(public.has_role('admin') or public.has_role('staff'));
create policy "public read active variants" on public.product_variants for select to anon,authenticated using(is_active and exists(select 1 from public.products p where p.id=product_id and p.is_published) or public.has_role('admin') or public.has_role('staff'));
create policy "admin manage variants" on public.product_variants for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read attribute definitions" on public.product_attributes for select to anon,authenticated using(true);
create policy "public read attributes for published products" on public.product_attribute_values for select to anon,authenticated using(exists(select 1 from public.products p where p.id=product_id and p.is_published));
create policy "admin manage attributes" on public.product_attributes for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "admin manage attribute values" on public.product_attribute_values for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
-- Inventory quantities are not directly exposed to public clients. Publish only a derived availability signal via a controlled view/API.
create policy "staff manage inventory" on public.inventory for all to authenticated using(public.has_role('admin') or public.has_role('staff')) with check(public.has_role('admin') or public.has_role('staff'));
create policy "admin read price history" on public.price_history for select to authenticated using(public.has_role('admin') or public.has_role('staff'));
create policy "admin read exchange sources" on public.exchange_rate_sources for select to authenticated using(public.has_role('admin'));
create policy "admin manage exchange sources" on public.exchange_rate_sources for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "admin read exchange records" on public.exchange_rate_records for select to authenticated using(public.has_role('admin') or public.has_role('staff'));
create policy "admin manage exchange records" on public.exchange_rate_records for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "customer own cart" on public.carts for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy "customer own cart items" on public.cart_items for all to authenticated using(exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid())) with check(exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid()));
create policy "customer own wishlist" on public.wishlists for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy "customer own wishlist items" on public.wishlist_items for all to authenticated using(exists(select 1 from public.wishlists w where w.id=wishlist_id and w.user_id=auth.uid())) with check(exists(select 1 from public.wishlists w where w.id=wishlist_id and w.user_id=auth.uid()));
create policy "customer own addresses" on public.addresses for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy "customer read own orders or staff" on public.orders for select to authenticated using(user_id = auth.uid() or public.has_role('staff') or public.has_role('admin'));
-- Order creation and status/payment transitions are intended for server-side functions only.
create policy "staff update orders" on public.orders for update to authenticated using(public.has_role('staff') or public.has_role('admin')) with check(public.has_role('staff') or public.has_role('admin'));
create policy "customer read own order items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_role('staff') or public.has_role('admin'))));
create policy "customer read own payments" on public.payments for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_role('staff') or public.has_role('admin'))));
create policy "public read active coupons" on public.coupons for select to anon,authenticated using(is_active and (starts_at is null or starts_at <= now()) and (expires_at is null or expires_at > now()));
create policy "staff read coupon redemptions" on public.coupon_redemptions for select to authenticated using(public.has_role('staff') or public.has_role('admin'));
create policy "public read enabled shipping methods" on public.shipping_methods for select to anon,authenticated using(is_enabled);
create policy "admin manage shipping methods" on public.shipping_methods for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "public read public settings" on public.site_settings for select to anon,authenticated using(key in ('store_name','support_hours','public_contact'));
create policy "admin manage settings" on public.site_settings for all to authenticated using(public.has_role('admin')) with check(public.has_role('admin'));
create policy "staff read audit logs" on public.audit_logs for select to authenticated using(public.has_role('admin') or public.has_role('staff'));
-- No client write policy on audit_logs. Write via trusted server/database routines.
