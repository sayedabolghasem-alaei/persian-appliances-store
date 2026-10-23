// Deliberately fails closed until a supported Iranian payment provider is configured.
// Never trust a browser callback; implement provider-specific server verification before marking an order paid.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://example.invalid', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' }
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: cors })
  const auth = req.headers.get('Authorization')
  if (!auth) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
  const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 500, headers: cors })
  const client = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await client.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: cors })
  const provider = Deno.env.get('PAYMENT_PROVIDER')
  if (!provider || !Deno.env.get('PAYMENT_MERCHANT_ID') || !Deno.env.get('PAYMENT_SECRET')) {
    return new Response(JSON.stringify({ error: 'payment_provider_not_configured', message: 'درگاه پرداخت هنوز تنظیم نشده؛ وضعیت سفارش پرداخت‌نشده باقی می‌ماند.' }), { status: 503, headers: cors })
  }
  // TODO: implement the selected provider's documented request/verification flow server-side.
  // This endpoint intentionally does not fabricate a payment URL or mark orders paid.
  return new Response(JSON.stringify({ error: 'provider_adapter_required', provider }), { status: 501, headers: cors })
})
