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

const SCHEMAS = ["public", "mega_sortierung"];
const EXCLUDED_TABLES = new Set([
  "backup_db_changes",
  "backup_log_entries",
  "backup_recovery_points",
  "legacy_metadata",
  "remote_commands",
  "health_sync_keys"
]);

function quoteIdent(value: string) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}

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
    return new Response(JSON.stringify({ error: "Server configuration missing" }), { status: 500, headers: corsHeaders });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user?.id) return new Response(JSON.stringify({ error: "Invalid user session" }), { status: 401, headers: corsHeaders });

  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 2 });
  try {
    const schemaList = SCHEMAS.map(s => "'" + s.replaceAll("'", "''") + "'").join(",");
    const tableMeta = await sql.unsafe(
      "select t.schemaname as schema_name, t.tablename as table_name, " +
      "exists (select 1 from information_schema.columns c where c.table_schema=t.schemaname and c.table_name=t.tablename and c.column_name='user_id') as has_user_id " +
      "from pg_tables t where t.schemaname in (" + schemaList + ") order by t.schemaname,t.tablename"
    );

    const data: Record<string, unknown[]> = {};
    const exportedTables: string[] = [];
    for (const item of tableMeta) {
      const schemaName = String(item.schema_name);
      const tableName = String(item.table_name);
      if (!item.has_user_id || EXCLUDED_TABLES.has(tableName) || tableName.startsWith("backup_")) continue;
      const fullName = quoteIdent(schemaName) + "." + quoteIdent(tableName);
      const rows = await sql.unsafe("select * from " + fullName + " where user_id=$1", [user.id]);
      const key = schemaName + "." + tableName;
      data[key] = jsonSafe(rows);
      exportedTables.push(key);
    }

    const body = {
      format: "Master of Disaster Current Data Backup",
      schema_version: 2,
      created_at: new Date().toISOString(),
      project_ref: "oktpzwhhndsbikkeelot",
      user_id: user.id,
      current_data: data,
      exported_tables: exportedTables,
      intentionally_excluded: {
        short_term_safety_net: ["public.backup_db_changes", "public.backup_log_entries", "public.backup_recovery_points"],
        transient_or_recreatable: ["public.legacy_metadata", "public.remote_commands", "public.health_sync_keys"],
        code_and_schema: "GitHub repository + versioned Supabase migrations",
        historical_backup_schemas: "not exported"
      }
    };

    return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("backup-export-v1", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: corsHeaders });
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
});
