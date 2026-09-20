import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "POST required" });

  const providedKey = req.headers.get("x-mod-health-key")?.trim();
  if (!providedKey || providedKey.length < 24) return reply(401, { ok: false, error: "Missing sync key" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return reply(500, { ok: false, error: "Server configuration missing" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const keyHash = await sha256Hex(providedKey);
  const { data: keyRow, error: keyError } = await admin
    .from("health_sync_keys")
    .select("id,user_id,is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (keyError) return reply(500, { ok: false, error: "Key lookup failed" });
  if (!keyRow) return reply(401, { ok: false, error: "Invalid sync key" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON" });
  }

  if (String(body.mode ?? "").trim().toLowerCase() === "ping") {
    await admin
      .from("health_sync_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRow.id);
    return reply(200, { ok: true, mode: "ping" });
  }

  const healthDate = String(body.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(healthDate)) {
    return reply(400, { ok: false, error: "date must be YYYY-MM-DD" });
  }

  const timezone = String(body.timezone ?? "Europe/Berlin").trim().slice(0, 80) || "Europe/Berlin";
  const weightKg = finiteNumber(body.weight_kg, 20, 500);
  const steps = finiteNumber(body.steps, 0, 200000);
  const exerciseMinutes = finiteNumber(body.exercise_minutes, 0, 1440);
  const runningDistanceKm = finiteNumber(body.running_distance_km, 0, 500);
  const runningDurationMinutes = finiteNumber(body.running_duration_minutes, 0, 1440);

  const suppliedMetricCount = [weightKg, steps, exerciseMinutes, runningDistanceKm, runningDurationMinutes]
    .filter((v) => v !== undefined).length;
  if (!suppliedMetricCount) return reply(400, { ok: false, error: "No valid health metrics supplied" });

  const row: Record<string, unknown> = {
    user_id: keyRow.user_id,
    health_date: healthDate,
    timezone,
    source: "apple_shortcuts",
    source_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (weightKg !== undefined) row.weight_kg = weightKg;
  if (steps !== undefined) row.steps = Math.round(steps);
  if (exerciseMinutes !== undefined) row.exercise_minutes = exerciseMinutes;
  if (runningDistanceKm !== undefined) row.running_distance_km = runningDistanceKm;
  if (runningDurationMinutes !== undefined) row.running_duration_minutes = runningDurationMinutes;

  const { error: upsertError } = await admin
    .from("progress_daily")
    .upsert(row, { onConflict: "user_id,health_date" });

  if (upsertError) return reply(500, { ok: false, error: "Health data write failed" });

  await admin
    .from("health_sync_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return reply(200, {
    ok: true,
    date: healthDate,
    metrics_received: suppliedMetricCount,
  });
});
