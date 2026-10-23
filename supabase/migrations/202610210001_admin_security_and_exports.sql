-- Hardening pass for the initial store. Apply only after reviewing in a staging project.
-- Add a distinct highest-privilege role. Existing admin accounts are not automatically promoted.
alter type public.app_role add value if not exists 'super_admin';

-- Keep the existing policy API, but make privileged roles hierarchical.
-- The text comparison avoids requiring a newly added enum literal in this migration.
create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case required_role::text
    when 'customer' then exists (
      select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'customer'
    )
    when 'staff' then exists (
      select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in ('staff','admin','super_admin')
    )
    when 'admin' then exists (
      select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text in ('admin','super_admin')
    )
    when 'super_admin' then exists (
      select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role::text = 'super_admin'
    )
    else false
  end;
$$;
revoke all on function public.has_role(public.app_role) from public;
grant execute on function public.has_role(public.app_role) to anon, authenticated;

-- Product + initial inventory are inserted in one transaction. No browser-side partial write.
create or replace function public.create_product_draft_secure(
  p_name text,
  p_slug text,
  p_sku text,
  p_price_toman bigint,
  p_initial_stock integer default 0
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_product_id uuid;
begin
  if v_user_id is null or not public.has_role('admin') then
    raise exception 'دسترسی مدیر لازم است.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_slug,''))) < 2
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or length(trim(coalesce(p_sku,''))) < 2 then
    raise exception 'نام، شناسه انگلیسی یا SKU معتبر نیست.';
  end if;
  if p_price_toman is null or p_price_toman < 0 or p_initial_stock is null or p_initial_stock < 0 then
    raise exception 'قیمت و موجودی باید عدد صحیح و غیرمنفی باشند.';
  end if;
  insert into public.products(name, slug, sku, price_toman, is_published, description, price_unit, currency_code)
  values(trim(p_name), trim(p_slug), trim(p_sku), p_price_toman, false, '', 'toman', 'IRR')
  returning id into v_product_id;
  insert into public.inventory(product_id, quantity, reserved_quantity, low_stock_threshold)
  values(v_product_id, p_initial_stock, 0, 3);
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, after_data)
  values(v_user_id, 'product.draft_created', 'product', v_product_id::text,
         jsonb_build_object('name',trim(p_name),'sku',trim(p_sku),'price_toman',p_price_toman,'initial_stock',p_initial_stock));
  return v_product_id;
end;
$$;
revoke all on function public.create_product_draft_secure(text,text,text,bigint,integer) from public, anon;
grant execute on function public.create_product_draft_secure(text,text,text,bigint,integer) to authenticated;

-- A staff/admin client may update fulfillment status, but must not mark payments paid.
-- Only trusted server-side payment verification should mutate payment_status.
revoke update on public.orders from anon, authenticated;
grant update(status) on public.orders to authenticated;

-- Explicitly retain no client-side write path for role assignments.
revoke insert, update, delete on public.user_roles from anon, authenticated;
