/* V388: Konfliktfilter – technische Import-/Sync-Zeitstempel sind kein Inhaltskonflikt. */
(function(){
  const technicalLabels = new Set(["Startzeit","Abschlusszeit","Pausenzeit","Abbruchzeit"]);
  const originalRun = runSupabaseCloudStartCheck;

  function isOnlyTechnicalTimestampConflict(item){
    if(!item || !Array.isArray(item.changed) || !item.changed.length) return false;
    if(item.kindLabel !== "ARCHIV") return false;
    return item.changed.every(label => technicalLabels.has(label));
  }

  function cleanState(){
    if(!supabaseCloudStartCheckState || !Array.isArray(supabaseCloudStartCheckState.conflicts)) return;
    const all = supabaseCloudStartCheckState.conflicts;
    const ignored = all.filter(isOnlyTechnicalTimestampConflict);
    const real = all.filter(item => !isOnlyTechnicalTimestampConflict(item));
    supabaseCloudStartCheckState.conflicts = real;
    supabaseCloudStartCheckState.ignoredTechnicalConflicts = ignored.length;
    if(real.length === 0){
      supabaseCloudStartCheckState.status = "ok";
      supabaseCloudStartCheckState.label = "LOCAL ↔ CLOUD INHALTSVERGLEICH OK ✅";
      supabaseCloudStartCheckState.detail = ignored.length
        ? `Keine echten Inhaltsabweichungen. ${ignored.length} reine Import-/Sync-Zeitstempel-Abweichungen wurden bewusst ignoriert. Es wurde nichts geschrieben.`
        : "Keine echten Inhaltsabweichungen gefunden. Es wurde nichts geschrieben.";
    } else {
      supabaseCloudStartCheckState.status = "warn";
      supabaseCloudStartCheckState.label = `${real.length} ECHTE ABWEICHUNG${real.length===1?"":"EN"} ERKANNT ⚠️`;
      supabaseCloudStartCheckState.detail = `${real.length} inhaltliche Abweichung${real.length===1?"":"en"}. ${ignored.length ? ignored.length + " reine Import-/Sync-Zeitstempel-Abweichungen wurden ausgeblendet. " : ""}Es wird NICHTS automatisch überschrieben.`;
    }
  }

  runSupabaseCloudStartCheck = async function(manual=true){
    const result = await originalRun(manual);
    cleanState();
    render();
    return supabaseCloudStartCheckState;
  };
})();
