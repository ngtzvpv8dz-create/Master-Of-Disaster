/* V401 · DEV CLEANUP
   Schlanker DEV-Bereich fuer den iPhone-Local-Master-Betrieb.
   Entfernt aus der sichtbaren Oberflaeche: Erstimport, Migration, Cloud-Vergleich,
   alte Live-Sync-Diagnose und manuelle Verbindungstests.
   Supabase-Login bleibt nur als Notfall-Aktion sichtbar, wenn keine persistierte Sitzung erkannt ist.
*/
(function(){
  const BUILD_VERSION="V401";
  const BUILD_LABEL="19.08.2026 · 23:49 Uhr";

  function loggedIn(){
    return Boolean(supabaseDevState && supabaseDevState.email);
  }

  function authCard(){
    const ok=loggedIn();
    return `
      <div class="supabase-dev-card" style="margin-top:14px;">
        <div class="supabase-dev-title">☁️ CLOUD-SICHERUNG</div>
        <div class="supabase-status-line">
          <span class="supabase-status-dot ${ok?"ok":"warn"}"></span>
          <span>${ok?"SUPABASE-ZUGANG AKTIV ✅":"SUPABASE-LOGIN ERFORDERLICH ⚠️"}</span>
        </div>
        <div class="supabase-status-detail">
          ${ok
            ? `Angemeldet${supabaseDevState.email?" als "+escapeHtml(supabaseDevState.email):""}. Die Sitzung wird auf diesem iPhone gespeichert und automatisch erneuert. Im normalen Betrieb musst du dich nicht erneut anmelden.`
            : `Aktuell ist keine gespeicherte Supabase-Sitzung erkannt. Lokal funktioniert die App weiter; Cloud-Backups warten, bis du dich einmal anmeldest.`}
        </div>
        ${ok?"":`<div class="supabase-dev-actions"><button class="supabase-dev-button primary" onclick="showSupabaseLoginModal()">🔐 SUPABASE ANMELDEN</button></div>`}
      </div>`;
  }

  renderDev=function(container){
    const integrity=collectDataIntegrityReport();
    const panel=document.createElement("div");
    panel.className="dev-panel";
    panel.innerHTML=`
      <div class="dev-title">🧪 DEVELOPER / DIAGNOSE</div>

      <div class="dev-build-card" style="margin-bottom:14px;padding:12px;border:1px solid #3a2a2a;border-radius:12px;background:#171313;">
        <div class="dev-build-title" style="margin-bottom:10px;font-size:10px;font-weight:900;letter-spacing:.8px;color:#f0e9e9;">APP-INFO</div>
        <div class="dev-build-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;">
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">VERSION</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${BUILD_VERSION}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">BUILD</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${BUILD_LABEL}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">ARCHIVSTAND</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">A${String(Math.max(0,nextArchiveNumber-1)).padStart(3,"0")}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">NÄCHSTE ARCHIVNR.</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">A${String(nextArchiveNumber).padStart(3,"0")}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">AUFGABENBESTAND</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${tasks.length}</div></div>
          <div class="dev-build-item" style="min-width:0;padding:10px;border:1px solid #3d3232;border-radius:10px;background:linear-gradient(135deg,#1d1818,#141212);"><div class="dev-build-label" style="margin-bottom:4px;font-size:7px;font-weight:900;letter-spacing:.65px;color:#a99292;">DATENPRÜFUNG</div><div class="dev-build-value" style="font-size:12px;font-weight:900;">${integrity.ok?"✅ SAUBER":"❌ FEHLER"}</div></div>
        </div>
      </div>

      ${authCard()}

      <div class="dev-build-card" style="margin-top:14px;">
        <div class="dev-build-title">📱 IPHONE / CLOUD-BACKUP</div>
        <div class="supabase-status-detail" style="margin-bottom:10px;">Das iPhone ist Master. Änderungen werden lokal sofort gespeichert und nach 10 Sekunden Ruhe automatisch als verifiziertes Komplett-Backup nach Supabase gesichert.</div>
        <div class="dev-buttons">
          <button class="dev-button" onclick="runSupabaseLiveSync(true)">☁️ JETZT SICHERN · SOFORT</button>
          <button class="dev-button" onclick="selectBackupForRestore()">♻️ LOKALES BACKUP WIEDERHERSTELLEN</button>
        </div>
      </div>

      <div class="dev-build-card" style="margin-top:14px;">
        <div class="dev-build-title">🔧 DIAGNOSE / TEST</div>
        <div class="dev-buttons">
          <button class="dev-button" onclick="runDataIntegrityCheck(true)">🔍 DATEN PRÜFEN</button>
          <button class="dev-button" onclick="simulateDayTransitionForTesting()">🕛 TAGESWECHSEL SIMULIEREN</button>
        </div>
      </div>`;
    container.appendChild(panel);
  };

  let authRefreshBusy=false;
  async function refreshAuthQuiet(){
    if(authRefreshBusy) return;
    authRefreshBusy=true;
    try{ await refreshSupabaseSessionStatus(); }
    catch(e){ console.warn("V401 auth refresh:",e); }
    finally{ authRefreshBusy=false; }
  }
  window.addEventListener("load",()=>setTimeout(refreshAuthQuiet,250));
  window.addEventListener("focus",()=>setTimeout(refreshAuthQuiet,250));
})();
