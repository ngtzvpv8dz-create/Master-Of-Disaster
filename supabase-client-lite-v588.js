/* V588 · standalone Supabase client for lazy-loaded non-TO-DO areas */
(function(){
  'use strict';
  if(typeof window.getSupabaseClient==='function')return;
  let client=null;
  window.getSupabaseClient=function(){
    if(client)return client;
    if(!window.supabase||typeof window.supabase.createClient!=='function'){
      throw new Error('Supabase-Bibliothek wurde nicht geladen.');
    }
    const config=window.SUPABASE_CONFIG||{};
    if(!config.url||!config.publishableKey){
      throw new Error('Supabase-Konfiguration fehlt.');
    }
    client=window.supabase.createClient(config.url,config.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  };
  window.__modSupabaseClientLiteV588=true;
})();