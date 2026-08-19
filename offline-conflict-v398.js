/* V398 · OFFLINE-RECONNECT KONFLIKTSTOPP · hotfix 7
   Popup nur, wenn der AKTUELLE Inhaltsvergleich echte Konflikte liefert.
   Ein cloud-change-guard allein reicht nicht mehr als Popup-Beweis.
*/
(function () {
  const originalRun = runSupabaseLiveSync;
  let conflictUiBusy = false;

  function isCloudChangeStop() {
    const state = supabaseLiveSyncState || {};
    return state.lastReason === "cloud-change-guard" || /CLOUD GEÄNDERT|CLOUD GEAENDERT|SYNC ANGEHALTEN/i.test(String(state.label || ""));
  }

  function activateDevTab() {
    currentTab = "dev";
    document.querySelectorAll(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.tab === "dev"));
    const inputPanel = document.getElementById("inputPanel");
    if (inputPanel) inputPanel.style.display = "none";
    render();
  }

  async function currentConflicts() {
    if (typeof runSupabaseCloudStartCheck !== "function") return [];
    const check = await runSupabaseCloudStartCheck(false);
    return check && Array.isArray(check.conflicts) ? check.conflicts : [];
  }

  async function exposeConflictCenter(conflicts) {
    if (conflictUiBusy || !Array.isArray(conflicts) || conflicts.length === 0) return;
    conflictUiBusy = true;
    try {
      activateDevTab();
      setTimeout(() => {
        const center = document.getElementById("cloudConflictCenter");
        if (center && typeof center.scrollIntoView === "function") center.scrollIntoView({behavior:"smooth",block:"start"});
      },120);
      showInfoModal("Sync angehalten · Konflikt erkannt ⚠️","Lokal und Cloud wurden seit dem letzten sicheren Sync parallel verändert. Es wurde NICHTS automatisch überschrieben. Die App hat die Konfliktzentrale geöffnet. Bitte dort pro Abweichung entscheiden, welcher Stand übernommen werden soll.");
    } catch(error) {
      console.warn("V398 Konfliktzentrale konnte nicht automatisch geöffnet werden:",error);
    } finally { conflictUiBusy=false; }
  }

  runSupabaseLiveSync = async function(manual=false) {
    if (isCloudChangeStop()) {
      supabaseLiveSyncState={...supabaseLiveSyncState,status:"warn",label:"SYNC-STATUS WIRD GEPRÜFT …",detail:"Lokaler und Cloud-Stand werden neu bewertet.",lastReason:"preflight-recheck"};
    }
    await originalRun(manual);
    if (!isCloudChangeStop()) return;

    let conflicts=[];
    try { conflicts=await currentConflicts(); }
    catch(error){ console.warn("Aktueller Konfliktvergleich fehlgeschlagen:",error); return; }

    if (conflicts.length === 0) {
      /* Guard war stale: kein Popup, kein angeblicher Konflikt. Der Multi-Device-Poller kann danach Baseline/Status normalisieren. */
      supabaseLiveSyncState={...supabaseLiveSyncState,status:"ok",label:"LOCAL ↔ CLOUD SYNCHRON ✅",detail:"Aktueller Inhaltsvergleich zeigt keine Abweichungen. Ein alter Konfliktstatus wurde verworfen.",lastReason:"conflict-check-equal",lastSyncAt:new Date().toISOString()};
      if (currentTab === "dev") render();
      return;
    }
    await exposeConflictCenter(conflicts);
  };
})();
