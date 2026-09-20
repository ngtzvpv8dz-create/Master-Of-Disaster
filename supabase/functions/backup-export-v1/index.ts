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

const SCHEMAS = ["public", "mega_sortierung", "backup_pre_xtraining_20260919_1918"];
const LEGACY_KEYS = ["live_complete_backup_v1", "previous_complete_backup_v1", "initial_import_manifest_v1"];

function quoteIdent(value: string) {
  return '"' + String(value).replaceAll('"', '""') + '"';
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item));
}

function base64(bytes: Uint8Array) {
  let out = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) out += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(out);
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

function defaultSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const keys = JSON.parse(raw);
      if (keys?.default) return String(keys.default);
    } catch (_) {}
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
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
      "from pg_tables t where t.schemaname in (" + schemaList + ") and t.tablename not like '__mod_backup_%' order by t.schemaname,t.tablename"
    );

    const data: Record<string, unknown[]> = {};
    for (const item of tableMeta) {
      const schemaName = String(item.schema_name);
      const tableName = String(item.table_name);
      if (!item.has_user_id) continue;
      const fullName = quoteIdent(schemaName) + "." + quoteIdent(tableName);
      let rows;
      if (schemaName === "public" && tableName === "legacy_metadata") {
        rows = await sql.unsafe(
          "select * from " + fullName + " where user_id=$1 and key=any($2::text[]) order by created_at",
          [user.id, LEGACY_KEYS]
        );
      } else {
        rows = await sql.unsafe("select * from " + fullName + " where user_id=$1", [user.id]);
      }
      data[schemaName + "." + tableName] = jsonSafe(rows);
    }

    const migrations = await sql.unsafe("select version,name,statements from supabase_migrations.schema_migrations order by version");
    const columns = await sql.unsafe(
      "select table_schema,table_name,ordinal_position,column_name,data_type,udt_schema,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale " +
      "from information_schema.columns where table_schema in (" + schemaList + ") order by table_schema,table_name,ordinal_position"
    );
    const policies = await sql.unsafe(
      "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies " +
      "where schemaname in (" + schemaList + ") order by schemaname,tablename,policyname"
    );
    const indexes = await sql.unsafe(
      "select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in (" + schemaList + ") order by schemaname,tablename,indexname"
    );
    const constraints = await sql.unsafe(
      "select n.nspname as schema_name,c.relname as table_name,con.conname as constraint_name,con.contype as constraint_type,pg_get_constraintdef(con.oid,true) as definition " +
      "from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace " +
      "where n.nspname in (" + schemaList + ") order by n.nspname,c.relname,con.conname"
    );
    const triggers = await sql.unsafe(
      "select n.nspname as schema_name,c.relname as table_name,t.tgname as trigger_name,pg_get_triggerdef(t.oid,true) as definition " +
      "from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace " +
      "where not t.tgisinternal and n.nspname in (" + schemaList + ") order by n.nspname,c.relname,t.tgname"
    );
    const views = await sql.unsafe(
      "select schemaname,viewname,definition from pg_views where schemaname in (" + schemaList + ") order by schemaname,viewname"
    );
    const functions = await sql.unsafe(
      "select n.nspname as schema_name,p.proname as function_name,pg_get_function_identity_arguments(p.oid) as identity_args,pg_get_functiondef(p.oid) as definition " +
      "from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','mega_sortierung','backup_internal') " +
      "order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)"
    );
    const authUsers = await sql.unsafe("select id,email,created_at,updated_at from auth.users where id=$1::uuid", [user.id]);
    const storageObjects = await sql.unsafe(
      "select id,bucket_id,name,owner_id,created_at,updated_at,last_accessed_at,metadata from storage.objects where owner_id::text=$1 order by bucket_id,name",
      [user.id]
    );
    const storageBuckets = await sql.unsafe(
      "select distinct b.* from storage.buckets b join storage.objects o on o.bucket_id=b.id where o.owner_id::text=$1 order by b.id",
      [user.id]
    );

    const warnings: string[] = [];
    const storageFiles: Array<Record<string, unknown>> = [];
    const secretKey = defaultSecretKey();
    if (storageObjects.length && secretKey) {
      const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
      let totalBytes = 0;
      const maxBytes = 50 * 1024 * 1024;
      for (const object of storageObjects) {
        try {
          const { data: blob, error } = await admin.storage.from(String(object.bucket_id)).download(String(object.name));
          if (error) throw error;
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (totalBytes + bytes.byteLength > maxBytes) {
            warnings.push("Storage-Dateien überschreiten 50 MB; weitere Binärdateien wurden nicht eingebettet.");
            break;
          }
          totalBytes += bytes.byteLength;
          storageFiles.push({ bucket_id: object.bucket_id, name: object.name, size: bytes.byteLength, content_base64: base64(bytes) });
        } catch (error) {
          warnings.push("Storage-Datei konnte nicht exportiert werden: " + String(object.bucket_id) + "/" + String(object.name) + " · " + String(error?.message || error));
        }
      }
    } else if (storageObjects.length) {
      warnings.push("Storage-Metadaten vorhanden, aber kein Server-Secret für Binärdownload verfügbar.");
    }

    const body = {
      format: "Master of Disaster Unified Supabase Backup",
      schema_version: 1,
      created_at: new Date().toISOString(),
      project_ref: "oktpzwhhndsbikkeelot",
      user_id: user.id,
      current_data: data,
      migrations: jsonSafe(migrations),
      catalog: {
        columns: jsonSafe(columns),
        policies: jsonSafe(policies),
        indexes: jsonSafe(indexes),
        constraints: jsonSafe(constraints),
        triggers: jsonSafe(triggers),
        views: jsonSafe(views),
        functions: jsonSafe(functions)
      },
      auth_user_reference: jsonSafe(authUsers),
      storage: { buckets: jsonSafe(storageBuckets), objects: jsonSafe(storageObjects), files: storageFiles },
      warnings
    };
    return new Response(JSON.stringify(body), { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("backup-export-v1", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), { status: 500, headers: corsHeaders });
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
});