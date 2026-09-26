import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const TABLES = [
  ["mega_sortierung", "containers"],
  ["mega_sortierung", "items"],
  ["public", "app_state"],
  ["public", "backup_db_changes"],
  ["public", "backup_log_entries"],
  ["public", "backup_recovery_points"],
  ["public", "archive_active_segments"],
  ["public", "archive_entries"],
  ["public", "finance_items"],
  ["public", "finance_transactions"],
  ["public", "food_ingredient_preference_aliases"],
  ["public", "food_ingredient_preferences"],
  ["public", "food_inventory"],
  ["public", "food_inventory_aliases"],
  ["public", "food_inventory_movements"],
  ["public", "food_leftovers"],
  ["public", "food_meal_ingredients"],
  ["public", "food_meals"],
  ["public", "food_recipe_ingredients"],
  ["public", "food_recipes"],
  ["public", "food_shopping_cart_state"],
  ["public", "food_shopping_items"],
  ["public", "progress_daily"],
  ["public", "project_brain"],
  ["public", "legacy_metadata"],
  ["public", "sport_activities"],
  ["public", "sport_activity_participants"],
  ["public", "sport_course_catalog"],
  ["public", "sport_course_plans"],
  ["public", "sport_equipment_catalog"],
  ["public", "sport_exercise_catalog"],
  ["public", "sport_exercise_sets"],
  ["public", "sport_session_exercises"],
  ["public", "sport_session_participants"],
  ["public", "sport_sessions"],
  ["public", "task_active_segments"],
  ["public", "task_cooking_segments"],
  ["public", "tasks"],
  ["public", "weight_phases"]
] as const;

function defaultPublishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (keys?.default) return String(keys.default);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || "";
}

async function readAllRows(client: any, schema: string, table: string, userId: string) {
  const rows: unknown[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const query = client.schema(schema).from(table).select("*").eq("user_id", userId).range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) throw new Error(schema + "." + table + ": " + error.message);
    const part = Array.isArray(data) ? data : [];
    rows.push(...part);
    if (part.length < pageSize) break;
  }
  return rows;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return new Response(JSON.stringify({ error: "Missing user token" }), { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = defaultPublishableKey();
  if (!supabaseUrl || !publishableKey) {
    return new Response(JSON.stringify({ error: "Server configuration missing" }), { status: 500, headers: corsHeaders });
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } }
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.id) return new Response(JSON.stringify({ error: "Invalid user session" }), { status: 401, headers: corsHeaders });

  try {
    const currentData: Record<string, unknown[]> = {};
    for (const [schema, table] of TABLES) {
      currentData[schema + "." + table] = await readAllRows(client, schema, table, user.id);
    }

    return new Response(JSON.stringify({
      format: "Master of Disaster Current Data Backup",
      schema_version: 2,
      created_at: new Date().toISOString(),
      project_ref: "oktpzwhhndsbikkeelot",
      project_url: supabaseUrl,
      user_id: user.id,
      auth_user_reference: { id: user.id, email: user.email || null, created_at: user.created_at || null },
      current_data: currentData,
      exported_tables: TABLES.map(([schema, table]) => schema + "." + table),
      recovery_notes: {
        short_term_safety_net: "48-hour audit/history included",
        live_previous: "legacy_metadata included",
        database_structure: "GitHub source archive contains versioned Supabase migrations"
      },
      intentionally_excluded: {
        transient_or_sensitive: ["public.remote_commands", "public.health_sync_keys"],
        historical_backup_schemas: "not exported"
      }
    }), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("backup-export-v1", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: corsHeaders });
  }
});
