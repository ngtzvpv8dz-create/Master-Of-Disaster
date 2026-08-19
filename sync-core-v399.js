/*
  V399 · AUTHORITATIVE SYNC CORE
  One source of truth for Local ↔ Supabase sync.
  Replaces the stacked V396/V398 sync wrappers.
*/
(function () {
  const LIVE_KEY = "live_complete_backup_v1";
  const BASELINE_KEY = "masterOfDisasterSyncBaselineV399";
  const PENDING_KEY = "masterOfDisasterSyncPendingV399";
  const LAST_OK_KEY = "masterOfDisasterSyncLastSafeV399";
  const PRE_PULL_KEY = "masterOfDisasterPrePullV399";
  const POLL_MS = 3000;
  let busy = false;
  let timer = null;

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
      const bytes = new TextEncoder().encode(text);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "fnv1a-" + (h >>> 0).toString(16).padStart(8, "0");
  }

  async function hashState(state) {
    return sha256(JSON.stringify(canonical(domainState(state))));
  }

  function localPayload() {
    const payload = createCompleteBackupPayload();
    if (!payload || !payload.state) throw new Error("Lokaler Komplett-Snapshot fehlt.");
    return payload;
  }

  async function localSnapshot() {
    const payload = localPayload();
    return { payload, hash: await hashState(payload.state) };
  }

  async function session() {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase-Client fehlt.");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data && data.session && data.session.user;
    if (!user || !user.id) return null;
    return { client, userId: user.id };
  }

  async function remoteSnapshot() {
    const s = await session();
    if (!s) return null;
    const { data, error } = await s.client.from("legacy_metadata")
      .select("payload")
      .eq("user_id", s.userId)
      .eq("key", LIVE_KEY)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row || !row.payload || !row.payload.state) return { ...s, payload:null, hash:null };
    return { ...s, payload:row.payload, hash:await hashState(row.payload.state) };
  }

  function applyRemote(payload) {
    const state = payload && payload.state;
    if (!state || !Array.isArray(state.tasks) || !Array.isArray(state.archive) || !Array.isArray(state.weightPhases) || !state.weightState) {
      throw new Error("Cloud-Snapshot ist unvollständig.");
    }
    const next = Number(state.nextArchiveNumber);
    if (!Number.isInteger(next) || next < 1) throw new Error("Cloud-Snapshot hat ungültige Archivnummer.");
    try { safeStorageSet(PRE_PULL_KEY, JSON.stringify(createCompleteBackupPayload())); } catch (_) {}
    const values = {
      masterOfDisasterTasks: JSON.stringify(state.tasks),
      masterOfDisasterArchive: JSON.stringify(state.archive),
      masterOfDisasterWeightState: JSON.stringify(state.weightState),
      masterOfDisasterWeightPhases: JSON.stringify(state.weightPhases),
      masterOfDisasterNextArchiveNumber: String(next)
    };
    if (!Object.entries(values).map(([k,v]) => safeStorageSet(k,v)).every(Boolean)) throw new Error("Cloud-Stand konnte lokal nicht vollständig gespeichert werden.");
    safeStorageSet("masterOfDisasterMasterV361ActiveTasksImported", "done");
    tasks = JSON.parse(values.masterOfDisasterTasks);
    archive = JSON.parse(values.masterOfDisasterArchive);
    weightState = JSON.parse(values.masterOfDisasterWeightState);
    weightPhases = JSON.parse(values.masterOfDisasterWeightPhases);
    nextArchiveNumber = next;
  }

  function setPending(value) { safeStorageSet(PENDING_KEY, value ? "1" : "0"); }
  function isPending() { return safeStorageGet(PENDING_KEY) === "1"; }
  function baseline() { return safeStorageGet(BASELINE_KEY); }
  function markSafe(hash) {
    safeStorageSet(BASELINE_KEY, hash);
    setPending(false);
    safeStorageSet(LAST_OK_KEY, new Date().toISOString());
  }

  function setState(status, label, detail, reason) {
    supabaseLiveSyncState = { ...(supabaseLiveSyncState || {}), status, label, detail, lastReason:reason, lastSyncAt:new Date().toISOString() };
    if (currentTab === "dev" && typeof render === "function") render();
  }

  function decide(localHash, remoteHash, baseHash, pending) {
    if (!remoteHash) return pending ? "push" : "initialize-push";
    if (localHash === remoteHash) return "equal";
    if (!baseHash) return "conflict";
    const localChanged = localHash !== baseHash;
    const remoteChanged = remoteHash !== baseHash;
    if (!localChanged && remoteChanged) return "pull";
    if (localChanged && !remoteChanged) return "push";
    if (localChanged && remoteChanged) return "conflict";
    return "conflict";
  }

  window.__modSyncDecisionV399 = decide;

  async function pushAllDomainTables(client, userId) {
    if (typeof syncTasksToSupabase !== "function" || typeof syncArchiveToSupabase !== "function" || typeof syncWeightToSupabase !== "function" || typeof syncAppStateToSupabase !== "function") {
      throw new Error("Supabase-Syncfunktionen sind nicht vollständig geladen.");
    }
    const taskCounts = await syncTasksToSupabase(client, userId);
    const archiveCounts = await syncArchiveToSupabase(client, userId);
    const weightCounts = await syncWeightToSupabase(client, userId);
    /* cloud-backup-restore-v394 wraps this function and writes the complete LIVE_KEY snapshot after app_state. */
    const stateCounts = await syncAppStateToSupabase(client, userId);
    const expected = { ...stateCounts, ...taskCounts, ...archiveCounts, ...weightCounts };
    if (typeof verifySupabaseLiveSync === "function") await verifySupabaseLiveSync(client, userId, expected);
    return expected;
  }

  async function pushLocal(remote) {
    const s = remote && remote.client ? remote : await session();
    if (!s) throw new Error("Supabase-Login fehlt.");
    await pushAllDomainTables(s.client, s.userId);
    const verifyRemote = await remoteSnapshot();
    const local = await localSnapshot();
    if (!verifyRemote || !verifyRemote.hash || verifyRemote.hash !== local.hash) throw new Error("Cloud-Verifikation nach Upload fehlgeschlagen. Local und Cloud sind danach nicht identisch.");
    markSafe(local.hash);
    setState("ok", "LOCAL ↔ CLOUD SYNCHRON ✅", "Alle Supabase-Domänentabellen und der vollständige Cloud-Snapshot wurden geschrieben und anschließend gegen Local verifiziert.", "v399-push-verified");
  }

  async function pullRemote(remote) {
    if (!remote || !remote.payload || !remote.hash) throw new Error("Cloud-Snapshot fehlt.");
    applyRemote(remote.payload);
    const report = typeof collectDataIntegrityReport === "function" ? collectDataIntegrityReport() : {ok:true};
    if (report && report.ok === false) throw new Error("Cloud-Stand besteht nach Local-Pull die Datenprüfung nicht.");
    const local = await localSnapshot();
    if (local.hash !== remote.hash) throw new Error("Local-Verifikation nach Cloud-Pull fehlgeschlagen.");
    markSafe(remote.hash);
    if (typeof renderWeightPanel === "function" && (currentTab === "all" || currentTab === "today")) renderWeightPanel();
    if (typeof render === "function") render();
    setState("ok", "CLOUD-ÄNDERUNG AUTOMATISCH ÜBERNOMMEN ✅", "Dieses Gerät war lokal unverändert. Der neuere vollständige Cloud-Stand wurde übernommen und verifiziert.", "v399-pull-verified");
  }

  async function exposeConflict() {
    let count = null;
    try {
      if (typeof runSupabaseCloudStartCheck === "function") {
        const check = await runSupabaseCloudStartCheck(false);
        count = check && Array.isArray(check.conflicts) ? check.conflicts.length : null;
      }
    } catch (error) { console.warn("V399 Konfliktdetail-Check fehlgeschlagen:", error); }
    setState("warn", "SYNC ANGEHALTEN · ECHTER STANDUNTERSCHIED ⚠️", count === 0
      ? "Der vollständige Local-/Cloud-Snapshot ist unterschiedlich, obwohl der ältere Detailfilter keine fachliche Abweichung meldet. Es wird bewusst NICHT automatisch überschrieben."
      : "Local und Cloud haben sich seit der letzten sicheren Basis beide verändert. Es wird NICHT automatisch überschrieben.", "v399-conflict");
  }

  async function syncOnce(manual=false) {
    if (busy || !navigator.onLine) {
      if (!navigator.onLine && isPending()) setState("warn", "OFFLINE · LOKAL GESPEICHERT 📱", "Lokale Änderungen warten auf die automatische Nachsynchronisierung.", "v399-offline");
      return;
    }
    busy = true;
    try {
      const [local, remote] = await Promise.all([localSnapshot(), remoteSnapshot()]);
      if (!remote) {
        setState("warn", "SUPABASE-LOGIN FEHLT", "Lokale Daten bleiben erhalten. Cloud-Sync wartet auf eine gültige Sitzung.", "v399-no-session");
        return;
      }
      const action = decide(local.hash, remote.hash, baseline(), isPending());
      if (action === "equal") {
        markSafe(local.hash);
        setState("ok", "LOCAL ↔ CLOUD SYNCHRON ✅", "Vollständiger Local- und Cloud-Snapshot sind inhaltlich identisch.", "v399-equal");
      } else if (action === "pull") {
        await pullRemote(remote);
      } else if (action === "push" || action === "initialize-push") {
        await pushLocal(remote);
      } else {
        await exposeConflict();
      }
    } catch (error) {
      setPending(true);
      const text = error && error.message ? error.message : String(error || "Unbekannter Sync-Fehler");
      setState("warn", "CLOUD-SYNC WARTET · LOKAL SICHER 📱", text, "v399-error");
      console.warn("V399 syncOnce:", error);
    } finally {
      busy = false;
      addStatusBox();
    }
  }

  function schedule(reason="local-save") {
    setPending(true);
    if (reason) { try { supabaseLiveSyncReasons.add(String(reason)); } catch (_) {} }
    if (!navigator.onLine) {
      setState("warn", "OFFLINE · LOKAL GESPEICHERT 📱", "Änderung ist lokal gespeichert und für späteren Cloud-Sync vorgemerkt.", "v399-offline-pending");
      addStatusBox();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; syncOnce(false); }, 450);
  }

  try {
    if (typeof supabaseLiveSyncTimer !== "undefined" && supabaseLiveSyncTimer) { clearTimeout(supabaseLiveSyncTimer); supabaseLiveSyncTimer = null; }
    if (typeof supabaseLiveSyncReasons !== "undefined" && supabaseLiveSyncReasons && typeof supabaseLiveSyncReasons.clear === "function") supabaseLiveSyncReasons.clear();
  } catch (_) {}

  scheduleSupabaseLiveSync = schedule;
  runSupabaseLiveSync = async function(manual=false) { return syncOnce(Boolean(manual)); };

  function addStatusBox() {
    if (currentTab !== "dev") return;
    const old = document.getElementById("offlineSyncStatusV396"); if (old) old.remove();
    const existing = document.getElementById("syncStatusV399"); if (existing) existing.remove();
    const button = Array.from(document.querySelectorAll("button")).find(btn => /JETZT SYNCHRONISIEREN/i.test(btn.textContent || ""));
    if (!button || !button.parentElement) return;
    const box = document.createElement("div");
    box.id = "syncStatusV399";
    box.style.cssText = "margin-top:10px;padding:10px;border:1px solid #30383e;border-radius:10px;background:#0f1315;font-size:10px;line-height:1.55;";
    const last = safeStorageGet(LAST_OK_KEY);
    const lastText = last && typeof formatSupabaseSyncTimestamp === "function" ? formatSupabaseSyncTimestamp(last) : (last || "NOCH KEINER");
    box.innerHTML = `<strong>📱 OFFLINE-FIRST · SYNC CORE V399</strong><br>NETZ · ${navigator.onLine ? "ONLINE ✅" : "OFFLINE ⚠️"}<br>AUSSTEHENDER CLOUD-SYNC · ${isPending() ? "JA ⚠️" : "NEIN ✅"}<br>LETZTER SICHERER SYNC · ${escapeHtml(String(lastText))}`;
    button.insertAdjacentElement("afterend", box);
  }

  const previousRender = render;
  render = function () {
    previousRender();
    const weight = document.getElementById("weightContainer");
    if (weight) weight.style.display = (currentTab === "all" || currentTab === "today") ? "" : "none";
    if (currentTab === "dev") setTimeout(addStatusBox, 0);
  };

  async function runReadOnlyDiagnostics() {
    try { if (typeof runSupabaseCloudStartCheck === "function") await runSupabaseCloudStartCheck(false); }
    catch (error) { console.warn("V399 Read-only Cloud-Check:", error); }
  }

  function foregroundCheck() {
    if (!navigator.onLine) { addStatusBox(); return; }
    syncOnce(false);
    runReadOnlyDiagnostics();
  }

  window.addEventListener("load", () => setTimeout(foregroundCheck, 500));
  window.addEventListener("online", () => setTimeout(foregroundCheck, 500));
  window.addEventListener("focus", () => setTimeout(foregroundCheck, 250));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") setTimeout(foregroundCheck, 250); });
  setInterval(() => { if (document.visibilityState !== "hidden") syncOnce(false); }, POLL_MS);

  window.__modSyncCoreV399 = {
    syncOnce,
    localSnapshot,
    remoteSnapshot,
    decide,
    isPending,
    baseline:() => baseline(),
    lastSafe:() => safeStorageGet(LAST_OK_KEY)
  };
})();
