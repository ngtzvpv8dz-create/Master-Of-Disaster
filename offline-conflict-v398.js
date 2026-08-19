/* V398 · OFFLINE-RECONNECT KONFLIKTSTOPP
   - Konflikt-UI wird nur noch fuer einen AKTUELL bestaetigten echten Parallelkonflikt geoeffnet.
   - Alte/stale cloud-change-guard-Zustaende aus V396/V398 loesen beim App-Start KEIN Popup mehr aus.
   - Der Multi-Device-Preflight entscheidet zuerst, ob Cloud-only automatisch uebernommen werden kann.
*/
(function () {
  const originalRun = runSupabaseLiveSync;
  let conflictUiBusy = false;
  let confirmedConflictThisRun = false;

  function isCloudChangeStop() {
    const state = supabaseLiveSyncState || {};
    return state.lastReason === "cloud-change-guard" || /CLOUD GEÄNDERT|CLOUD GEAENDERT|SYNC ANGEHALTEN/i.test(String(state.label || ""));
  }

  function activateDevTab() {
    currentTab = "dev";
    document.querySelectorAll(".tab-button").forEach(button => {
      button.classList.toggle("active", button.dataset.tab === "dev");
    });
    const inputPanel = document.getElementById("inputPanel");
    if (inputPanel) inputPanel.style.display = "none";
    render();
  }

  async function exposeConflictCenter() {
    if (conflictUiBusy || !confirmedConflictThisRun) return;
    conflictUiBusy = true;
    try {
      if (typeof runSupabaseCloudStartCheck === "function") {
        await runSupabaseCloudStartCheck(false);
      }
      activateDevTab();
      setTimeout(() => {
        const center = document.getElementById("cloudConflictCenter");
        if (center && typeof center.scrollIntoView === "function") center.scrollIntoView({ behavior:"smooth", block:"start" });
      }, 120);
      showInfoModal(
        "Sync angehalten · Konflikt erkannt ⚠️",
        "Lokal und Cloud wurden seit dem letzten sicheren Sync parallel veraendert. Es wurde NICHTS automatisch ueberschrieben. Die App hat die Konfliktzentrale geoeffnet. Bitte dort pro Abweichung entscheiden, welcher Stand uebernommen werden soll."
      );
    } catch (error) {
      console.warn("V398 Konfliktzentrale konnte nicht automatisch geoeffnet werden:", error);
    } finally {
      conflictUiBusy = false;
    }
  }

  runSupabaseLiveSync = async function (manual=false) {
    /* Ein alter UI-State darf niemals schon vor dem aktuellen Sync-Lauf ein Popup erzeugen. */
    confirmedConflictThisRun = false;
    if (isCloudChangeStop()) {
      supabaseLiveSyncState = {
        ...supabaseLiveSyncState,
        status:"warn",
        label:"SYNC-STATUS WIRD GEPRÜFT …",
        detail:"Lokaler und Cloud-Stand werden neu bewertet.",
        lastReason:"preflight-recheck"
      };
    }

    await originalRun(manual);

    confirmedConflictThisRun = isCloudChangeStop();
    if (confirmedConflictThisRun) await exposeConflictCenter();
  };

  const originalRender = render;
  render = function () {
    originalRender();
    if (currentTab === "dev" && confirmedConflictThisRun && isCloudChangeStop()) {
      setTimeout(() => {
        const center = document.getElementById("cloudConflictCenter");
        if (center) center.classList.add("warn");
      }, 0);
    }
  };

  const applyBuildLabel = () => {
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length) return;
      let text = el.textContent || "";
      if (text.includes("V397")) text = text.replaceAll("V397","V398");
      if (text.includes("19.08.2026") && text.includes("16:23")) text = text.replace("16:23","16:32");
      if (text !== el.textContent) el.textContent = text;
    });
  };
  new MutationObserver(applyBuildLabel).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  applyBuildLabel();
})();
