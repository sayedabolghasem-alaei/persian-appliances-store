// Generic product-feed endpoint. Verify Torob's current merchant specifications before submission.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
serve(async (req) => {
  const expected = Deno.env.get('TOROB_FEED_TOKEN')
  if (!expected || req.headers.get('Authorization') !== `Bearer ${expected}`) return new Response('Unauthorized', { status: 401 })
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return new Response('Server not configured', { status: 500 })
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await supabase.from('products').select('id,name,slug,sku,model,description,price_toman,compare_at_price_toman,brands(name),product_images(image_url),inventory(quantity,reserved_quantity)').eq('is_published', true).order('updated_at', { ascending: false })
  if (error) return new Response('Could not load products', { status: 500 })
  const origin = Deno.env.get('PUBLIC_SITE_URL')
  if (!origin) return new Response('PUBLIC_SITE_URL is required', { status: 500 })
  const rows = (data ?? []).map((p: any) => ({ id: p.sku, title: p.name, price: Number(p.price_toman), availability: (Number(p.inventory?.[0]?.quantity ?? p.inventory?.quantity ?? 0) - Number(p.inventory?.[0]?.reserved_quantity ?? p.inventory?.reserved_quantity ?? 0)) > 0 ? 'in_stock' : 'out_of_stock', url: `${origin.replace(/\/$/, '')}/product/${p.slug}`, image_url: p.product_images?.[0]?.image_url ?? '', brand: p.brands?.name ?? '', description: p.description ?? '', model: p.model ?? '' }))
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
})
