// Supabase Edge Function: server-side price preview.
// Deploy with Supabase CLI; this function intentionally does not publish price changes.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "روش درخواست پشتیبانی نمی‌شود." }, { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL"); const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return Response.json({ error: "پیکربندی سرور ناقص است." }, { status: 500, headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth) return Response.json({ error: "احراز هویت لازم است." }, { status: 401, headers: cors });
  const supabase = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "نشست معتبر نیست." }, { status: 401, headers: cors });
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin"]).maybeSingle();
  if (!role) return Response.json({ error: "دسترسی مدیر لازم است." }, { status: 403, headers: cors });
  let input: { foreignCost?: number; exchangeRate?: number; additionalCostToman?: number; marginPercent?: number; roundingStepToman?: number };
  try { input = await req.json(); } catch { return Response.json({ error: "بدنه درخواست معتبر نیست." }, { status: 400, headers: cors }); }
  const vals = [input.foreignCost, input.exchangeRate, input.additionalCostToman, input.marginPercent, input.roundingStepToman];
  if (!vals.every(v => typeof v === "number" && Number.isFinite(v)) || input.foreignCost! < 0 || input.exchangeRate! <= 0 || input.additionalCostToman! < 0 || input.marginPercent! < 0 || input.marginPercent! > 500 || !Number.isInteger(input.roundingStepToman) || input.roundingStepToman! < 1) {
    return Response.json({ error: "ورودی‌های قیمت‌گذاری معتبر نیستند." }, { status: 400, headers: cors });
  }
  const cost = input.foreignCost! * input.exchangeRate! + input.additionalCostToman!;
  const priceToman = Math.ceil(cost * (1 + input.marginPercent! / 100) / input.roundingStepToman!) * input.roundingStepToman!;
  return Response.json({ priceToman, currency: "IRR", unit: "toman", isPreview: true, message: "این فقط پیش‌نمایش است؛ برای انتشار قیمت باید عملیات جداگانه با ثبت تاریخچه و تأیید مدیر پیاده‌سازی شود." }, { headers: { ...cors, "Content-Type": "application/json" } });
});