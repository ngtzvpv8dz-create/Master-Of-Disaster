/* V394 · CLOUD SNAPSHOT BACKUP + RESTORE
   - Jeder erfolgreiche Live-Sync schreibt einen vollständigen aktuellen App-Snapshot nach Supabase.
   - DEV bekommt einen manuellen CLOUD → LOCAL Restore mit Fallback auf den initialen Komplett-Backup.
   - Lokal bleibt die Arbeitskopie; Restore überschreibt erst nach ausdrücklicher Bestätigung.
*/
(function () {
  const LIVE_KEY = "live_complete_backup_v1";
  const INITIAL_KEY = "initial_import_complete_backup_v1";
  let restoreBusy = false;

  async function getCloudSession() {
    const client = getSupabaseClient();
    if (!client) throw new Error("Kein Supabase-Client verfügbar.");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data && data.session && data.session.user;
    if (!user || !user.id) throw new Error("Supabase-Login fehlt.");
    return { client, userId: user.id };
  }

  async function writeLiveSnapshot(client, userId) {
    const payload = createCompleteBackupPayload();
    if (!payload || !payload.state) throw new Error("Lokaler Komplett-Snapshot konnte nicht erstellt werden.");
    payload.masterVersion = "V394";
    payload.cloudSnapshotVersion = 1;
    payload.cloudSnapshotSavedAt = new Date().toISOString();

    let result = await client.from("legacy_metadata")
      .delete()
      .eq("user_id", userId)
      .eq("key", LIVE_KEY);
    if (result.error) throw result.error;

    result = await client.from("legacy_metadata").insert([{ user_id:userId, key:LIVE_KEY, payload }]);
    if (result.error) throw result.error;
    return payload;
  }

  /* In den bestehenden Live-Sync einklinken. So bleibt LOCAL-first unverändert,
     aber nach jedem Cloud-Sync existiert zusätzlich ein vollständiger Restore-Punkt. */
  if (typeof syncAppStateToSupabase === "function") {
    const originalSyncAppState = syncAppStateToSupabase;
    syncAppStateToSupabase = async function (client, userId) {
      const counts = await originalSyncAppState(client, userId);
      await writeLiveSnapshot(client, userId);
      return counts;
    };
  }

  function validateBackupPayload(payload) {
    if (!payload || typeof payload !== "object" || !payload.state || typeof payload.state !== "object") {
      throw new Error("Cloud-Backup hat kein gültiges App-State-Format.");
    }
    const state = payload.state;
    if (!Array.isArray(state.tasks) || !Array.isArray(state.archive) || !Array.isArray(state.weightPhases)) {
      throw new Error("Cloud-Backup ist unvollständig (Tasks/Archiv/Gewichtsphasen fehlen).");
    }
    if (!state.weightState || typeof state.weightState !== "object") {
      throw new Error("Cloud-Backup enthält keinen gültigen Zusatzgewichtsstatus.");
    }
    const next = Number(state.nextArchiveNumber);
    if (!Number.isInteger(next) || next < 1) throw new Error("Cloud-Backup enthält keine gültige nächste Archivnummer.");
    return state;
  }

  async function readBestCloudSnapshot(client, userId) {
    let result = await client.from("legacy_metadata")
      .select("key,payload")
      .eq("user_id", userId)
      .eq("key", LIVE_KEY)
      .limit(1);
    if (result.error) throw result.error;
    let row = Array.isArray(result.data) ? result.data[0] : null;
    if (row && row.payload) return { key:LIVE_KEY, payload:row.payload };

    result = await client.from("legacy_metadata")
      .select("key,payload")
      .eq("user_id", userId)
      .eq("key", INITIAL_KEY)
      .limit(1);
    if (result.error) throw result.error;
    row = Array.isArray(result.data) ? result.data[0] : null;
    if (row && row.payload) return { key:INITIAL_KEY, payload:row.payload };
    throw new Error("In Supabase wurde noch kein vollständiger Restore-Snapshot gefunden. Bitte zuerst einmal erfolgreich synchronisieren.");
  }

  function localSummary() {
    return `${Array.isArray(tasks)?tasks.length:0} Aufgaben · ${Array.isArray(archive)?archive.length:0} Archiv · ${Array.isArray(weightPhases)?weightPhases.length:0} Gewichtsphasen`;
  }

  function snapshotSummary(payload) {
    const state = validateBackupPayload(payload);
    return `${state.tasks.length} Aufgaben · ${state.archive.length} Archiv · ${state.weightPhases.length} Gewichtsphasen · nächste A${String(state.nextArchiveNumber).padStart(3,"0")}`;
  }

  function persistRestoredState(state) {
    /* Absichtlich direkt in localStorage schreiben. Erst nach vollständigem Schreiben
       werden die In-Memory-Werte gesetzt. Dadurch gibt es keinen halben Restore. */
    const serialized = {
      tasks: JSON.stringify(state.tasks),
      archive: JSON.stringify(state.archive),
      weightState: JSON.stringify(state.weightState),
      weightPhases: JSON.stringify(state.weightPhases),
      nextArchiveNumber: String(Number(state.nextArchiveNumber))
    };
    const ok = [
      safeStorageSet("masterOfDisasterTasks", serialized.tasks),
      safeStorageSet("masterOfDisasterArchive", serialized.archive),
      safeStorageSet("masterOfDisasterWeightState", serialized.weightState),
      safeStorageSet("masterOfDisasterWeightPhases", serialized.weightPhases),
      safeStorageSet("masterOfDisasterNextArchiveNumber", serialized.nextArchiveNumber)
    ].every(Boolean);
    if (!ok) throw new Error("Lokaler Speicher konnte nicht vollständig geschrieben werden.");

    tasks = JSON.parse(serialized.tasks);
    archive = JSON.parse(serialized.archive);
    weightState = JSON.parse(serialized.weightState);
    weightPhases = JSON.parse(serialized.weightPhases);
    nextArchiveNumber = Number(serialized.nextArchiveNumber);
  }

  async function restoreCloudToLocal() {
    if (restoreBusy) return;
    restoreBusy = true;
    try {
      const { client, userId } = await getCloudSession();
      const found = await readBestCloudSnapshot(client, userId);
      const state = validateBackupPayload(found.payload);
      const cloudText = snapshotSummary(found.payload);
      const sourceLabel = found.key === LIVE_KEY ? "aktueller Live-Snapshot" : "initialer Import-Snapshot (Fallback)";
      const ok = window.confirm(
        `CLOUD → LOCAL WIEDERHERSTELLEN?\n\nCloud (${sourceLabel}):\n${cloudText}\n\nAktuell lokal:\n${localSummary()}\n\nDer lokale App-Zustand wird vollständig durch diesen Cloud-Snapshot ersetzt. Supabase selbst wird dabei NICHT verändert.`
      );
      if (!ok) return;

      /* Sicherheitskopie des jetzigen Local-Standes für diese Browser-Sitzung. */
      try {
        safeStorageSet("masterOfDisasterPreCloudRestoreBackup", JSON.stringify(createCompleteBackupPayload()));
      } catch (e) {
        console.warn("Pre-Restore-Sicherung konnte nicht geschrieben werden:", e);
      }

      persistRestoredState(state);
      const integrity = collectDataIntegrityReport();
      if (!integrity || !integrity.ok) {
        throw new Error("Cloud-Daten wurden lokal geschrieben, aber die Datenprüfung meldet Fehler: " + (integrity && integrity.errors ? integrity.errors.join(" | ") : "unbekannt"));
      }

      renderWeightPanel();
      render();
      showInfoModal("Cloud-Restore erfolgreich ✅", `${cloudText}\n\nQuelle: ${sourceLabel}.\nLokale Datenprüfung: sauber. Die App wird jetzt neu geladen.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      console.error("Cloud → Local Restore fehlgeschlagen:", error);
      showInfoModal("Cloud-Restore fehlgeschlagen", error && error.message ? error.message : String(error));
    } finally {
      restoreBusy = false;
    }
  }

  function addRestoreButton() {
    if (currentTab !== "dev") return;
    if (document.getElementById("cloudRestoreV394")) return;
    const syncButton = Array.from(document.querySelectorAll("button")).find(btn => /JETZT SYNCHRONISIEREN/i.test(btn.textContent || ""));
    const compareButton = document.querySelector(".supabase-startcheck-action");
    const anchor = syncButton || compareButton;
    if (!anchor || !anchor.parentElement) return;
    const button = document.createElement("button");
    button.id = "cloudRestoreV394";
    button.className = anchor.className || "option-button";
    button.type = "button";
    button.textContent = "☁️ CLOUD → LOCAL WIEDERHERSTELLEN";
    button.style.marginTop = "10px";
    button.onclick = restoreCloudToLocal;
    anchor.insertAdjacentElement("afterend", button);
  }

  const originalRender = render;
  render = function () {
    originalRender();
    if (currentTab === "dev") setTimeout(addRestoreButton, 0);
  };
  window.addEventListener("load", () => setTimeout(addRestoreButton, 200));

  /* V394 sichtbare Build-Info, solange app.js als großer Kern nicht für einen Metadaten-Bump neu geschrieben werden muss. */
  const applyBuildLabel = () => {
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length) return;
      let text = el.textContent || "";
      if (text.includes("V393")) text = text.replaceAll("V393", "V394");
      if (text.includes("19.08.2026") && text.includes("05:38")) text = text.replace("05:38", "06:18");
      if (text !== el.textContent) el.textContent = text;
    });
  };
  new MutationObserver(applyBuildLabel).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  applyBuildLabel();
})();
