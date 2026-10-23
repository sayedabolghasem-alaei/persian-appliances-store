-- Secure order creation. Prices and stock are derived from database records, never client totals.
create or replace function public.create_order_secure(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_address jsonb,
  p_customer_note text default null,
  p_items jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_order_number bigint;
  v_subtotal bigint := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_available integer;
  v_count integer := 0;
  v_name text := trim(coalesce(p_customer_name,''));
  v_phone text := trim(coalesce(p_customer_phone,''));
  v_province text := trim(coalesce(p_address->>'province',''));
  v_city text := trim(coalesce(p_address->>'city',''));
  v_line text := trim(coalesce(p_address->>'address_line',''));
  v_postal text := trim(coalesce(p_address->>'postal_code',''));
begin
  if v_user_id is null then raise exception 'برای ثبت سفارش ابتدا وارد حساب شوید.'; end if;
  if length(v_name) < 2 or length(v_phone) < 10 then raise exception 'نام یا شماره تماس معتبر نیست.'; end if;
  if v_province = '' or v_city = '' or length(v_line) < 5 or length(v_postal) <> 10 then raise exception 'نشانی یا کد پستی معتبر نیست.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'اقلام سفارش معتبر نیستند.'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) as items(value) group by value->>'product_id' having count(*) > 1) then raise exception 'هر کالا باید فقط یک بار در فهرست سفارش ارسال شود.'; end if;

  -- Create order after all item checks; row locks prevent overselling.
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'تعداد کالا معتبر نیست.'; end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and is_published = true for update;
    if not found then raise exception 'یکی از کالاها موجود یا قابل فروش نیست.'; end if;
    select (quantity - reserved_quantity) into v_available from public.inventory where product_id = v_product.id for update;
    if not found or v_available < v_qty then raise exception 'موجودی کافی برای کالا: % نیست.', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price_toman * v_qty);
    v_count := v_count + 1;
  end loop;

  insert into public.orders(user_id, customer_name, customer_phone, customer_email, shipping_address_snapshot, subtotal_toman, discount_toman, shipping_toman, total_toman, customer_note)
  values(v_user_id, v_name, v_phone, nullif(trim(coalesce(p_customer_email,'')),''), jsonb_build_object('province',v_province,'city',v_city,'address_line',v_line,'postal_code',v_postal), v_subtotal, 0, 0, v_subtotal, nullif(trim(coalesce(p_customer_note,'')),''))
  returning id, order_number into v_order_id, v_order_number;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and is_published = true for update;
    update public.inventory set reserved_quantity = reserved_quantity + v_qty, updated_at = now() where product_id = v_product.id;
    insert into public.order_items(order_id, product_id, product_name_snapshot, sku_snapshot, unit_price_toman, quantity)
    values(v_order_id, v_product.id, v_product.name, v_product.sku, v_product.price_toman, v_qty);
  end loop;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values(v_user_id, 'order.created', 'order', v_order_id::text, jsonb_build_object('order_number',v_order_number,'item_count',v_count,'total_toman',v_subtotal));
  return jsonb_build_object('id',v_order_id,'order_number',v_order_number,'total_toman',v_subtotal,'payment_status','unpaid');
end;
$$;
revoke all on function public.create_order_secure(text,text,text,jsonb,text,jsonb) from public, anon;
grant execute on function public.create_order_secure(text,text,text,jsonb,text,jsonb) to authenticated;

-- Restrict direct status/payment mutation to privileged users. Order inserts remain server routine only.
revoke insert, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.payments from anon, authenticated;

-- Public-safe catalog view: expose only a stock availability boolean, never exact inventory counts.
create or replace view public.public_product_catalog as
select p.id, p.slug, p.name, p.sku, p.model, p.description, p.price_toman, p.compare_at_price_toman,
       p.created_at, b.name as brand_name, c.name as category_name, c.slug as category_slug,
       pi.image_url,
       coalesce(i.quantity - i.reserved_quantity, 0) > 0 as available
from public.products p
left join public.brands b on b.id = p.brand_id and b.is_active = true
left join public.categories c on c.id = p.category_id and c.is_active = true
left join lateral (select image_url from public.product_images where product_id = p.id order by sort_order asc, created_at asc limit 1) pi on true
left join public.inventory i on i.product_id = p.id
where p.is_published = true;
grant select on public.public_product_catalog to anon, authenticated;

-- Keep inventory reservations consistent when an order is cancelled or a trusted server verifies payment.
create or replace function public.sync_inventory_after_order_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item record;
begin
  if old.payment_status <> 'paid' and new.payment_status = 'paid' then
    for item in select product_id, quantity from public.order_items where order_id = new.id and product_id is not null loop
      update public.inventory
      set quantity = quantity - item.quantity,
          reserved_quantity = greatest(0, reserved_quantity - item.quantity),
          updated_at = now()
      where product_id = item.product_id and quantity >= item.quantity and reserved_quantity >= item.quantity;
      if not found then raise exception 'موجودی برای تکمیل پرداخت سفارش کافی نیست.'; end if;
    end loop;
  elsif old.status <> 'cancelled' and new.status = 'cancelled' and old.payment_status <> 'paid' then
    for item in select product_id, quantity from public.order_items where order_id = new.id and product_id is not null loop
      update public.inventory
      set reserved_quantity = greatest(0, reserved_quantity - item.quantity), updated_at = now()
      where product_id = item.product_id;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_inventory_transition on public.orders;
create trigger orders_inventory_transition
after update of status, payment_status on public.orders
for each row execute function public.sync_inventory_after_order_transition();
revoke all on function public.sync_inventory_after_order_transition() from public, anon, authenticated;
