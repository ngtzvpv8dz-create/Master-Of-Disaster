/* MULTI-DEVICE SYNC FIX
   Distinguishes three-way sync states using the last safe baseline:
   1) local unchanged + cloud changed => automatically pull cloud
   2) local changed + cloud unchanged => normal local->cloud sync
   3) local changed + cloud changed => keep existing conflict stop
*/
(function () {
  const DIRTY_KEY = "masterOfDisasterCloudSyncPendingV396";
  const BASELINE_KEY = "masterOfDisasterCloudBaselineHashV396";
  const LAST_OK_KEY = "masterOfDisasterCloudLastSafeSyncV396";
  const LIVE_KEY = "live_complete_backup_v1";
  let preflightBusy = false;

  function domainState(state) {
    state = state && typeof state === "object" ? state : {};
    return {
      tasks: Array.isArray(state.tasks) ? state.tasks : [],
      archive: Array.isArray(state.archive) ? state.archive : [],
      nextArchiveNumber: Number(state.nextArchiveNumber) || 1,
      weightState: state.weightState && typeof state.weightState === "object" ? state.weightState : {},
      weightPhases: Array.isArray(state.weightPhases) ? state.weightPhases : []
    };
  }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).sort().forEach(key => { out[key] = canonical(value[key]); });
      return out;
    }
    return value === undefined ? null : value;
  }

  async function sha256(text) {
    if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
      const data = new TextEncoder().encode(text);
      const hash = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
    }
    let h = 2166136261;
    for (let i=0;i<text.length;i+=1) { h ^= text.charCodeAt(i); h = Math.imul(h,16777619); }
    return "fnv1a-" + (h >>> 0).toString(16).padStart(8,"0");
  }

  async function hashState(state) {
    return sha256(JSON.stringify(canonical(domainState(state))));
  }

  async function localHash() {
    const payload = createCompleteBackupPayload();
    return hashState(payload && payload.state ? payload.state : {});
  }

  async function remoteSnapshot() {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data:sessionData, error:sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData && sessionData.session && sessionData.session.user;
    if (!user || !user.id) return null;
    const { data, error } = await client.from("legacy_metadata")
      .select("payload")
      .eq("user_id", user.id)
      .eq("key", LIVE_KEY)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row || !row.payload || !row.payload.state) return null;
    return { payload:row.payload, hash:await hashState(row.payload.state) };
  }

  function applyRemoteState(payload) {
    const state = payload && payload.state;
    if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.archive) || !Array.isArray(state.weightPhases) || !state.weightState) {
      throw new Error("Cloud-Snapshot ist unvollständig.");
    }
    const next = Number(state.nextArchiveNumber);
    if (!Number.isInteger(next) || next < 1) throw new Error("Cloud-Snapshot hat ungültige Archivnummer.");

    const serializedTasks = JSON.stringify(state.tasks);
    const serializedArchive = JSON.stringify(state.archive);
    const serializedWeight = JSON.stringify(state.weightState);
    const serializedPhases = JSON.stringify(state.weightPhases);
    const ok = [
      safeStorageSet("masterOfDisasterTasks", serializedTasks),
      safeStorageSet("masterOfDisasterArchive", serializedArchive),
      safeStorageSet("masterOfDisasterWeightState", serializedWeight),
      safeStorageSet("masterOfDisasterWeightPhases", serializedPhases),
      safeStorageSet("masterOfDisasterNextArchiveNumber", String(next)),
      safeStorageSet("masterOfDisasterMasterV361ActiveTasksImported", "done")
    ].every(Boolean);
    if (!ok) throw new Error("Cloud-Stand konnte lokal nicht vollständig gespeichert werden.");

    tasks = JSON.parse(serializedTasks);
    archive = JSON.parse(serializedArchive);
    weightState = JSON.parse(serializedWeight);
    weightPhases = JSON.parse(serializedPhases);
    nextArchiveNumber = next;
  }

  async function preflightAndMaybePull() {
    if (preflightBusy || !navigator.onLine) return { handled:false };
    preflightBusy = true;
    try {
      const remote = await remoteSnapshot();
      if (!remote) return { handled:false };
      const local = await localHash();
      const baseline = safeStorageGet(BASELINE_KEY);

      /* First clean encounter: identical states establish a baseline. */
      if (!baseline && local === remote.hash) {
        safeStorageSet(BASELINE_KEY, remote.hash);
        safeStorageSet(DIRTY_KEY, "0");
        safeStorageSet(LAST_OK_KEY, new Date().toISOString());
        return { handled:true, pulled:false };
      }

      if (!baseline) return { handled:false };

      /* Nothing differs. Also clears a stale dirty flag left from an older session. */
      if (local === remote.hash) {
        safeStorageSet(BASELINE_KEY, remote.hash);
        safeStorageSet(DIRTY_KEY, "0");
        safeStorageSet(LAST_OK_KEY, new Date().toISOString());
        return { handled:true, pulled:false };
      }

      /* Critical case: this device has NOT changed since baseline, only cloud has. */
      if (local === baseline && remote.hash !== baseline) {
        applyRemoteState(remote.payload);
        const integrity = typeof collectDataIntegrityReport === "function" ? collectDataIntegrityReport() : {ok:true};
        if (integrity && integrity.ok === false) throw new Error("Automatisch übernommener Cloud-Stand besteht die Datenprüfung nicht.");
        safeStorageSet(BASELINE_KEY, remote.hash);
        safeStorageSet(DIRTY_KEY, "0");
        safeStorageSet(LAST_OK_KEY, new Date().toISOString());
        supabaseLiveSyncState = {
          ...supabaseLiveSyncState,
          status:"ok",
          label:"CLOUD-ÄNDERUNG AUTOMATISCH ÜBERNOMMEN ✅",
          detail:"Dieses Gerät war lokal unverändert. Der neuere Cloud-Stand wurde automatisch lokal übernommen.",
          lastReason:"cloud-only-auto-pull"
        };
        if (typeof renderWeightPanel === "function") renderWeightPanel();
        if (typeof render === "function") render();
        return { handled:true, pulled:true };
      }

      /* local != baseline and remote == baseline => local-only change; existing sync may push safely.
         local != baseline and remote != baseline => true parallel change; existing V398 guard handles it. */
      return { handled:false };
    } finally {
      preflightBusy = false;
    }
  }

  const guardedRun = runSupabaseLiveSync;
  runSupabaseLiveSync = async function (manual=false) {
    try {
      const result = await preflightAndMaybePull();
      if (result.handled) return;
    } catch (error) {
      console.warn("Multi-device preflight failed; existing safe sync guard takes over:", error);
    }
    return guardedRun(manual);
  };

  async function checkCloudOnlyChange() {
    try { await preflightAndMaybePull(); }
    catch (error) { console.warn("Cloud-only check failed:", error); }
  }

  window.addEventListener("load", () => setTimeout(checkCloudOnlyChange, 900));
  window.addEventListener("focus", () => setTimeout(checkCloudOnlyChange, 350));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(checkCloudOnlyChange, 350);
  });
})();
