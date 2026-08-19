/* V396 · OFFLINE-FIRST SYNC-SCHUTZ
   - Jede lokale Aenderung wird dauerhaft als ausstehend markiert.
   - Offline bleibt die App voll lokal nutzbar; kein Cloud-Fehler-Spam.
   - Bei Rueckkehr der Verbindung wird automatisch nachsynchronisiert.
   - Vor einem Push wird geprueft, ob sich der Cloud-Snapshot seit dem letzten sicheren Sync veraendert hat.
   - Hat sich die Cloud parallel veraendert, wird NICHT blind ueberschrieben, sondern die Konfliktzentrale gestartet.
*/
(function () {
  const DIRTY_KEY = "masterOfDisasterCloudSyncPendingV396";
  const BASELINE_KEY = "masterOfDisasterCloudBaselineHashV396";
  const LAST_OK_KEY = "masterOfDisasterCloudLastSafeSyncV396";
  const LIVE_KEY = "live_complete_backup_v1";
  let resumeRunning = false;

  function isDirty() {
    return safeStorageGet(DIRTY_KEY) === "1";
  }

  function setDirty(value) {
    safeStorageSet(DIRTY_KEY, value ? "1" : "0");
  }

  function syncDomainState(state) {
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
    /* Fallback nur fuer sehr alte WebViews. */
    let h = 2166136261;
    for (let i=0;i<text.length;i+=1) { h ^= text.charCodeAt(i); h = Math.imul(h,16777619); }
    return "fnv1a-" + (h >>> 0).toString(16).padStart(8,"0");
  }

  async function hashState(state) {
    return sha256(JSON.stringify(canonical(syncDomainState(state))));
  }

  async function currentLocalHash() {
    const payload = createCompleteBackupPayload();
    return hashState(payload && payload.state ? payload.state : {});
  }

  async function readRemoteLiveSnapshot() {
    const client = getSupabaseClient();
    const { data:sessionData, error:sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData && sessionData.session ? sessionData.session : null;
    if (!session || !session.user || !session.user.id) return { ready:false, reason:"Supabase-Login fehlt." };
    const { data, error } = await client.from("legacy_metadata")
      .select("payload")
      .eq("user_id",session.user.id)
      .eq("key",LIVE_KEY)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row || !row.payload || !row.payload.state) return { ready:false, reason:"Kein Live-Cloud-Snapshot vorhanden." };
    return { ready:true, hash:await hashState(row.payload.state), payload:row.payload };
  }

  function setOfflineState(detail) {
    supabaseLiveSyncState = {
      ...supabaseLiveSyncState,
      status:"warn",
      label:"OFFLINE · LOKAL GESPEICHERT 📱",
      detail:detail || "Aenderungen sind lokal sicher gespeichert und fuer die automatische Nachsynchronisierung vorgemerkt.",
      lastReason:"offline-pending"
    };
    if (currentTab === "dev") render();
  }

  async function cloudChangedSinceBaseline() {
    const remote = await readRemoteLiveSnapshot();
    if (!remote.ready) return { safe:false, reason:remote.reason, remote:null };
    const baseline = safeStorageGet(BASELINE_KEY);

    if (!baseline) {
      /* Erster V396-Lauf: Vollvergleich als sichere Baseline-Ermittlung. */
      if (typeof runSupabaseCloudStartCheck === "function") {
        const check = await runSupabaseCloudStartCheck(false);
        const conflicts = check && Array.isArray(check.conflicts) ? check.conflicts : null;
        if (conflicts && conflicts.length > 0) return { safe:false, reason:"Cloud und Local weichen bereits voneinander ab.", remote };
        if (check && check.status === "error") return { safe:false, reason:check.detail || "Cloud-Vergleich fehlgeschlagen.", remote };
      }
      safeStorageSet(BASELINE_KEY, remote.hash);
      return { safe:true, remote };
    }

    if (baseline !== remote.hash) {
      if (typeof runSupabaseCloudStartCheck === "function") await runSupabaseCloudStartCheck(false);
      return { safe:false, reason:"Die Cloud wurde seit dem letzten sicheren Sync veraendert. Automatisches Ueberschreiben wurde blockiert.", remote };
    }
    return { safe:true, remote };
  }

  const originalSchedule = scheduleSupabaseLiveSync;
  scheduleSupabaseLiveSync = function (reason="local-save") {
    setDirty(true);
    if (!navigator.onLine) {
      if (reason) supabaseLiveSyncReasons.add(String(reason));
      setOfflineState();
      return;
    }
    return originalSchedule(reason);
  };

  const originalRun = runSupabaseLiveSync;
  runSupabaseLiveSync = async function (manual=false) {
    if (!navigator.onLine) {
      setDirty(true);
      setOfflineState("Keine Internetverbindung erkannt. Lokal wird normal weitergearbeitet; der Cloud-Sync wartet.");
      return;
    }

    const needsProtection = isDirty();
    if (needsProtection) {
      try {
        const guard = await cloudChangedSinceBaseline();
        if (!guard.safe) {
          supabaseLiveSyncState = {
            ...supabaseLiveSyncState,
            status:"warn",
            label:"SYNC ANGEHALTEN · CLOUD GEÄNDERT ⚠️",
            detail:(guard.reason || "Parallele Cloud-Aenderung erkannt.") + " Bitte LOCAL ↔ CLOUD VERGLEICHEN und Konflikte aufloesen.",
            lastReason:"cloud-change-guard"
          };
          if (currentTab === "dev") render();
          return;
        }
      } catch (error) {
        setDirty(true);
        const text = error && error.message ? error.message : String(error || "Netzwerkfehler");
        supabaseLiveSyncState = {
          ...supabaseLiveSyncState,
          status:"warn",
          label:"CLOUD NICHT ERREICHBAR · LOKAL SICHER 📱",
          detail:"Die lokale Aenderung bleibt vorgemerkt. Cloud-Pruefung nicht moeglich: " + text,
          lastReason:"cloud-unreachable"
        };
        if (currentTab === "dev") render();
        return;
      }
    }

    await originalRun(manual);

    if (supabaseLiveSyncState && supabaseLiveSyncState.status === "ok") {
      setDirty(false);
      try {
        safeStorageSet(BASELINE_KEY, await currentLocalHash());
        safeStorageSet(LAST_OK_KEY, new Date().toISOString());
      } catch (error) {
        console.warn("V396 Sync-Baseline konnte nicht gespeichert werden:", error);
      }
    } else if (needsProtection) {
      setDirty(true);
    }
  };

  async function resumePending(reason) {
    if (resumeRunning || !isDirty() || !navigator.onLine) return;
    resumeRunning = true;
    try {
      supabaseLiveSyncReasons.add(reason || "online-wiederhergestellt");
      await runSupabaseLiveSync(false);
    } finally {
      resumeRunning = false;
    }
  }

  window.addEventListener("offline", () => {
    if (isDirty()) setOfflineState("Internetverbindung verloren. Bereits lokale und kommende Aenderungen bleiben auf dem Geraet erhalten.");
  });
  window.addEventListener("online", () => setTimeout(() => resumePending("online-wiederhergestellt"), 700));
  window.addEventListener("focus", () => setTimeout(() => resumePending("app-fokus"), 300));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(() => resumePending("app-sichtbar"), 300);
  });

  function addOfflineSyncStatus() {
    if (currentTab !== "dev") return;
    const existing = document.getElementById("offlineSyncStatusV396");
    if (existing) existing.remove();
    const syncButton = Array.from(document.querySelectorAll("button")).find(btn => /JETZT SYNCHRONISIEREN/i.test(btn.textContent || ""));
    if (!syncButton || !syncButton.parentElement) return;
    const box = document.createElement("div");
    box.id = "offlineSyncStatusV396";
    box.style.cssText = "margin-top:10px;padding:10px;border:1px solid #30383e;border-radius:10px;background:#0f1315;font-size:10px;line-height:1.55;";
    const last = safeStorageGet(LAST_OK_KEY);
    box.innerHTML = `<strong>📱 OFFLINE-FIRST V396</strong><br>` +
      `NETZ · ${navigator.onLine ? "ONLINE ✅" : "OFFLINE ⚠️"}<br>` +
      `AUSSTEHENDER CLOUD-SYNC · ${isDirty() ? "JA ⚠️" : "NEIN ✅"}` +
      (last ? `<br>LETZTER SICHERER SYNC · ${escapeHtml(formatSupabaseSyncTimestamp(last))}` : "");
    syncButton.insertAdjacentElement("afterend",box);
  }

  const originalRender = render;
  render = function () {
    originalRender();
    if (currentTab === "dev") setTimeout(addOfflineSyncStatus,0);
  };
  window.addEventListener("load", () => setTimeout(addOfflineSyncStatus,250));

  /* Sichtbare Build-Metadaten auf V396 anheben. */
  const applyBuildLabel = () => {
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length) return;
      let text = el.textContent || "";
      if (text.includes("V395")) text = text.replaceAll("V395","V396");
      if (text.includes("19.08.2026") && text.includes("08:23")) text = text.replace("08:23","09:12");
      if (text !== el.textContent) el.textContent = text;
    });
  };
  new MutationObserver(applyBuildLabel).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  applyBuildLabel();
})();
