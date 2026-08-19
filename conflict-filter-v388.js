/* V389: Semantischer Konfliktfilter – technische Archiv-Zeit-/Segmentabweichungen sind kein Inhaltskonflikt. */
(function(){
  const technicalLabels = new Set(["Startzeit","Abschlusszeit","Pausenzeit","Abbruchzeit","Aktivsegmente"]);
  const originalRun = runSupabaseCloudStartCheck;

  function isTechnicalArchiveConflict(item){
    if(!item || item.kindLabel !== "ARCHIV" || !Array.isArray(item.changed) || !item.changed.length) return false;
    if(!item.changed.every(label => technicalLabels.has(label))) return false;
    // Nur ausblenden, wenn die fachliche Kurzfassung identisch ist.
    // Damit bleiben Text-, Status-, Dauer-, Kategorie- und Datumsabweichungen sichtbar.
    return String(item.localSummary || "") === String(item.cloudSummary || "");
  }

  function cleanState(){
    if(!supabaseCloudStartCheckState || !Array.isArray(supabaseCloudStartCheckState.conflicts)) return;
    const all = supabaseCloudStartCheckState.conflicts;
    const ignored = all.filter(isTechnicalArchiveConflict);
    const real = all.filter(item => !isTechnicalArchiveConflict(item));

    supabaseCloudStartCheckState.conflicts = real;
    supabaseCloudStartCheckState.ignoredTechnicalConflicts = ignored.length;

    if(real.length === 0){
      supabaseCloudStartCheckState.status = "ok";
      supabaseCloudStartCheckState.label = "LOCAL ↔ CLOUD INHALTSVERGLEICH OK ✅";
      supabaseCloudStartCheckState.detail = ignored.length
        ? `Keine echten Inhaltsabweichungen. ${ignored.length} technische Archiv-Zeit-/Segmentabweichungen wurden bewusst ignoriert. Es wurde nichts geschrieben.`
        : "Keine echten Inhaltsabweichungen gefunden. Es wurde nichts geschrieben.";
    } else {
      supabaseCloudStartCheckState.status = "warn";
      supabaseCloudStartCheckState.label = `${real.length} ECHTE ABWEICHUNG${real.length===1?"":"EN"} ERKANNT ⚠️`;
      supabaseCloudStartCheckState.detail = `${real.length} inhaltliche Abweichung${real.length===1?"":"en"}. ${ignored.length ? ignored.length + " technische Archiv-Zeit-/Segmentabweichungen wurden ausgeblendet. " : ""}Es wird NICHTS automatisch überschrieben.`;
    }
  }

  runSupabaseCloudStartCheck = async function(manual=true){
    const result = await originalRun(manual);
    cleanState();
    render();
    return supabaseCloudStartCheckState;
  };
})();
