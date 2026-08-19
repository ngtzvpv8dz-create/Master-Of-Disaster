/* V397 · VOLLSTAENDIGES KOMPLETT-BACKUP (ZIP)
   - Ein Klick im DEV-Tab erzeugt eine ZIP-Datei.
   - APP/ enthaelt den kompletten aktuellen GitHub-Repo-Dateistand von main.
   - DATA/ enthaelt den aktuellen lokalen Komplett-Datenstand sowie relevante localStorage-Werte.
   - BACKUP-INFO.txt dokumentiert Build, Commit und Inhalt.
*/
(function () {
  const OWNER = "ngtzvpv8dz-create";
  const REPO = "Master-Of-Disaster";
  const BRANCH = "main";
  const BUILD_VERSION = "V397";
  let busy = false;

  function berlinStampParts() {
    const parts = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const map = Object.fromEntries(parts.map(p => [p.type,p.value]));
    return {
      human: `${map.day}.${map.month}.${map.year} ${map.hour}:${map.minute}:${map.second}`,
      file: `${map.year}-${map.month}-${map.day}_${map.hour}-${map.minute}-${map.second}`
    };
  }

  function collectRelevantLocalStorage() {
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith("masterOfDisaster")) result[key] = localStorage.getItem(key);
      }
    } catch (error) {
      result.__error = error && error.message ? error.message : String(error);
    }
    return result;
  }

  async function fetchRepoTree() {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`;
    const response = await fetch(url, { cache:"no-store", headers:{ "Accept":"application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub-Dateiliste konnte nicht geladen werden (${response.status}).`);
    const data = await response.json();
    if (!data || !Array.isArray(data.tree)) throw new Error("GitHub-Dateiliste ist ungueltig.");
    return data;
  }

  function rawUrl(path) {
    return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/` + path.split("/").map(encodeURIComponent).join("/");
  }

  async function fetchRepoFile(path) {
    const response = await fetch(rawUrl(path), { cache:"no-store" });
    if (!response.ok) throw new Error(`${path}: Download fehlgeschlagen (${response.status}).`);
    return response.arrayBuffer();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function setButtonState(text, disabled) {
    const button = document.getElementById("fullBackupV397");
    if (!button) return;
    button.textContent = text;
    button.disabled = Boolean(disabled);
  }

  async function createFullBackupZip() {
    if (busy) return;
    busy = true;
    setButtonState("⏳ BACKUP WIRD GEBAUT…", true);

    try {
      if (typeof JSZip !== "function") throw new Error("ZIP-Bibliothek wurde nicht geladen.");
      if (!navigator.onLine) throw new Error("Fuer das Code-Vollbackup wird kurz Internet benoetigt, damit der aktuelle GitHub-Dateistand mit ins ZIP kommt.");

      const stamp = berlinStampParts();
      const zip = new JSZip();
      const appFolder = zip.folder("APP");
      const dataFolder = zip.folder("DATA");

      const treeData = await fetchRepoTree();
      const files = treeData.tree.filter(item => item && item.type === "blob" && item.path);
      const failed = [];

      for (let i = 0; i < files.length; i += 1) {
        const item = files[i];
        setButtonState(`⏳ CODE ${i+1}/${files.length}…`, true);
        try {
          const bytes = await fetchRepoFile(item.path);
          appFolder.file(item.path, bytes, { binary:true });
        } catch (error) {
          failed.push(`${item.path} · ${error && error.message ? error.message : String(error)}`);
        }
      }

      const completePayload = createCompleteBackupPayload();
      completePayload.masterVersion = BUILD_VERSION;
      completePayload.fullBackupCreatedAt = new Date().toISOString();
      dataFolder.file("complete-data-backup.json", JSON.stringify(completePayload, null, 2));
      dataFolder.file("localstorage-master-of-disaster.json", JSON.stringify(collectRelevantLocalStorage(), null, 2));

      const info = [
        "MASTER OF DISASTER · VOLLSTAENDIGES KOMPLETT-BACKUP",
        "====================================================",
        `Build: ${BUILD_VERSION}`,
        `Erstellt: ${stamp.human} Europe/Berlin`,
        `GitHub: ${OWNER}/${REPO} · Branch ${BRANCH}`,
        `Git-Stand/Tree: ${treeData.sha || "unbekannt"}`,
        `Repo-Dateien gefunden: ${files.length}`,
        `Repo-Dateien erfolgreich im ZIP: ${files.length - failed.length}`,
        `Repo-Dateien fehlgeschlagen: ${failed.length}`,
        "",
        "INHALT",
        "APP/  = aktueller Programmcode und saemtliche Dateien des GitHub-Repositories",
        "DATA/complete-data-backup.json = kompletter App-Datenstand",
        "DATA/localstorage-master-of-disaster.json = zusaetzliche lokale Master-of-Disaster-Speicherwerte",
        "",
        failed.length ? "FEHLGESCHLAGENE DATEIEN:\n" + failed.join("\n") : "Keine fehlgeschlagenen Repo-Dateien.",
        "",
        `Aufgaben: ${Array.isArray(completePayload.state && completePayload.state.tasks) ? completePayload.state.tasks.length : 0}`,
        `Archiv: ${Array.isArray(completePayload.state && completePayload.state.archive) ? completePayload.state.archive.length : 0}`,
        `Gewichtsphasen: ${Array.isArray(completePayload.state && completePayload.state.weightPhases) ? completePayload.state.weightPhases.length : 0}`,
        `Naechste Archivnummer: A${String(Number(completePayload.state && completePayload.state.nextArchiveNumber) || 1).padStart(3,"0")}`
      ].join("\n");
      zip.file("BACKUP-INFO.txt", info);

      setButtonState("⏳ ZIP WIRD GEPACKT…", true);
      const blob = await zip.generateAsync({ type:"blob", compression:"DEFLATE", compressionOptions:{ level:6 } });
      const filename = `Master-of-Disaster_${BUILD_VERSION}_Vollbackup_${stamp.file}.zip`;
      downloadBlob(blob, filename);
      setButtonState("✅ VOLLSTAENDIGES KOMPLETT-BACKUP", false);

      const msg = failed.length
        ? `ZIP wurde erstellt. ${files.length-failed.length}/${files.length} Repo-Dateien wurden aufgenommen. ${failed.length} Datei(en) konnten nicht geladen werden; Details stehen in BACKUP-INFO.txt.`
        : `ZIP wurde erstellt: kompletter Repo-Code (${files.length} Dateien) plus kompletter lokaler App-Datenstand.`;
      showInfoModal("Vollbackup erstellt ✅", msg);
    } catch (error) {
      console.error("V397 Vollbackup fehlgeschlagen:", error);
      setButtonState("📦 VOLLSTAENDIGES KOMPLETT-BACKUP", false);
      showInfoModal("Vollbackup fehlgeschlagen", error && error.message ? error.message : String(error));
    } finally {
      busy = false;
    }
  }

  function addButton() {
    if (currentTab !== "dev") return;
    if (document.getElementById("fullBackupV397")) return;

    const candidates = Array.from(document.querySelectorAll("button"));
    const existingDataBackup = candidates.find(btn => /KOMPLETT-BACKUP|BACKUP ERSTELLEN|BACKUP/i.test(btn.textContent || ""));
    const devPanel = document.querySelector(".dev-panel") || document.getElementById("viewContainer");
    const anchorParent = existingDataBackup && existingDataBackup.parentElement ? existingDataBackup.parentElement : devPanel;
    if (!anchorParent) return;

    const wrap = document.createElement("div");
    wrap.id = "fullBackupWrapV397";
    wrap.style.cssText = "margin-top:14px;padding:12px;border:1px solid #3d3232;border-radius:12px;background:#171313;";
    wrap.innerHTML = `<div style="font-size:10px;font-weight:900;letter-spacing:.8px;margin-bottom:8px;">📦 VOLLBACKUP</div><div style="font-size:10px;line-height:1.5;margin-bottom:10px;opacity:.85;">Ein ZIP mit aktuellem Programmcode + komplettem lokalen App-Datenstand.</div>`;
    const button = document.createElement("button");
    button.id = "fullBackupV397";
    button.type = "button";
    button.className = existingDataBackup ? existingDataBackup.className : "supabase-dev-button primary";
    button.textContent = "📦 VOLLSTAENDIGES KOMPLETT-BACKUP";
    button.onclick = createFullBackupZip;
    wrap.appendChild(button);
    anchorParent.appendChild(wrap);
  }

  const originalRender = render;
  render = function () {
    originalRender();
    if (currentTab === "dev") setTimeout(addButton, 0);
  };
  window.addEventListener("load", () => setTimeout(addButton, 300));

  const applyBuildLabel = () => {
    document.querySelectorAll("*").forEach(el => {
      if (el.children.length) return;
      let text = el.textContent || "";
      if (text.includes("V396")) text = text.replaceAll("V396", "V397");
      if (text.includes("19.08.2026") && text.includes("09:12")) text = text.replace("09:12", "16:23");
      if (text !== el.textContent) el.textContent = text;
    });
  };
  new MutationObserver(applyBuildLabel).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  applyBuildLabel();
})();
