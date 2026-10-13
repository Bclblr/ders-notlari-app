import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-location-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST isteği gerekli." }, 405);

  const expectedToken = Deno.env.get("LOCATION_ACCESS_TOKEN");
  const suppliedToken = req.headers.get("x-location-token");
  if (!expectedToken || !suppliedToken || suppliedToken.length < 32 || suppliedToken !== expectedToken) {
    return json({ error: "Erişim reddedildi. Konum paneli erişim anahtarını kontrol et." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Sunucu yapılandırması eksik." }, 503);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (body?.action === "update") {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const accuracy = body.accuracy == null ? null : Number(body.accuracy);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
          (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0))) {
        return json({ error: "Konum koordinatları geçersiz." }, 400);
      }
      const recordedAt = typeof body.recordedAt === "string" && !Number.isNaN(Date.parse(body.recordedAt))
        ? new Date(body.recordedAt).toISOString() : new Date().toISOString();
      const { error } = await supabase.from("device_location_current").upsert({
        id: "personal-iphone", latitude, longitude, accuracy_m: accuracy,
        recorded_at: recordedAt, updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) {
        console.error("location update failed", error.message);
        return json({ error: "Konum kaydedilemedi." }, 500);
      }
      return json({ ok: true, recordedAt });
    }

    if (body?.action === "latest") {
      const { data, error } = await supabase.from("device_location_current")
        .select("latitude,longitude,accuracy_m,recorded_at,updated_at")
        .eq("id", "personal-iphone").maybeSingle();
      if (error) {
        console.error("location read failed", error.message);
        return json({ error: "Konum okunamadı." }, 500);
      }
      return json({ location: data ?? null });
    }
    return json({ error: "Geçersiz işlem." }, 400);
  } catch (_error) {
    return json({ error: "İstek işlenemedi." }, 400);
  }
});