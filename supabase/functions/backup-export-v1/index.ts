import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import postgres from "npm:postgres@3.4.7";

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

function quoteIdent(value: string) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

async function readAllRows(sql: any, schema: string, table: string, userId: string) {
  const fullName = quoteIdent(schema) + "." + quoteIdent(table);
  return await sql.unsafe("select * from " + fullName + " where user_id=$1", [userId]);
}

function jsonStringifySafe(value: unknown) {
  return JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return new Response(JSON.stringify({ error: "Missing user token" }), { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const dbUrl = Deno.env.get("SUPABASE_DB_URL") || "";
  const publishableKey = defaultPublishableKey();
  if (!supabaseUrl || !dbUrl || !publishableKey) {
    return new Response(jsonStringifySafe({ error: "Server configuration missing" }), { status: 500, headers: corsHeaders });
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } }
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.id) return new Response(JSON.stringify({ error: "Invalid user session" }), { status: 401, headers: corsHeaders });

  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 2 });
  try {
    const currentData: Record<string, unknown[]> = {};
    for (const [schema, table] of TABLES) {
      currentData[schema + "." + table] = await readAllRows(sql, schema, table, user.id);
    }

    const schemas = ["public", "mega_sortierung"];
    const columns = await sql`
      select table_schema,table_name,ordinal_position,column_name,data_type,udt_schema,udt_name,
             is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale
      from information_schema.columns
      where table_schema = any(${schemas})
      order by table_schema,table_name,ordinal_position
    `;
    const constraints = await sql`
      select n.nspname as schema_name,c.relname as table_name,con.conname as constraint_name,
             con.contype as constraint_type,pg_get_constraintdef(con.oid,true) as definition
      from pg_constraint con
      join pg_class c on c.oid=con.conrelid
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname = any(${schemas})
      order by n.nspname,c.relname,con.conname
    `;
    const indexes = await sql`
      select schemaname,tablename,indexname,indexdef
      from pg_indexes
      where schemaname = any(${schemas})
      order by schemaname,tablename,indexname
    `;
    const policies = await sql`
      select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
      from pg_policies
      where schemaname = any(${schemas})
      order by schemaname,tablename,policyname
    `;
    const triggers = await sql`
      select n.nspname as schema_name,c.relname as table_name,t.tgname as trigger_name,
             pg_get_triggerdef(t.oid,true) as definition
      from pg_trigger t
      join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace
      where not t.tgisinternal and n.nspname = any(${schemas})
      order by n.nspname,c.relname,t.tgname
    `;
    const views = await sql`
      select schemaname,viewname,definition
      from pg_views
      where schemaname = any(${schemas})
      order by schemaname,viewname
    `;
    const functions = await sql`
      select n.nspname as schema_name,p.proname as function_name,
             pg_get_function_identity_arguments(p.oid) as identity_args,
             pg_get_functiondef(p.oid) as definition
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','mega_sortierung','backup_internal')
      order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)
    `;
    const extensions = await sql`
      select extname,extversion
      from pg_extension
      order by extname
    `;
    const migrations = await sql`
      select version,name,statements
      from supabase_migrations.schema_migrations
      order by version
    `;

    return new Response(jsonStringifySafe({
      format: "Master of Disaster Current Data Backup",
      schema_version: 2,
      created_at: new Date().toISOString(),
      project_ref: "oktpzwhhndsbikkeelot",
      project_url: supabaseUrl,
      user_id: user.id,
      auth_user_reference: { id: user.id, email: user.email || null, created_at: user.created_at || null },
      current_data: currentData,
      exported_tables: TABLES.map(([schema, table]) => schema + "." + table),
      database_catalog: {
        columns,
        constraints,
        indexes,
        policies,
        triggers,
        views,
        functions,
        extensions,
        migrations
      },
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
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
});
