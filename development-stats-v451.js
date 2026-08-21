/* V451 · APP-ENTWICKLUNGSSTATISTIK
   Datenbasis: GitHub-Historie, rekonstruierbare Chat-Zeitstempel,
   Supabase/Postgres-Statistik und dokumentierte Cloud-Backups.
   Aktivitätsfenster sind bewusst keine behauptete Netto-Arbeitszeit.
*/
(function(){
  const BUILD_VERSION='V451';
  const SNAPSHOT_AT='21.08.2026 · 14:28';
  const PROJECT_START_ISO='2026-08-17T04:43:22+02:00';

  const DATA={
    repo:{
      created:'17.08.2026 · 04:43:22',
      firstFile:'17.08.2026 · 04:48:49',
      firstFileName:'index.html',
      firstFileLines:77,
      currentBuild:'V450',
      commitsAfterFirst:556,
      reachableCommits:557,
      pullRequests:50,
      mergedPullRequests:49,
      testOnlyPullRequests:1,
      currentFiles:31,
      rootFiles:28,
      workflowFiles:3,
      currentTextLines:22984,
      currentBytes:1253333,
      currentTextBytes:650607,
      currentImageBytes:602726,
      v431TouchedPaths:71,
      v431PathsGoneNow:63
    },
    supabase:{
      created:'18.08.2026 · 14:23:25',
      tables:9,
      currentRows:317,
      inserts:1507,
      updates:15460,
      deletes:1189,
      relationBytes:1482752,
      remoteCommands:17,
      remoteErrors:0,
      normalizedTasks:37,
      normalizedArchive:236,
      normalizedWeights:11,
      commandCounts:{ADD_TASK:5,START_TASK:4,COMPLETE_TASK:2,PAUSE_TASK:1,RESUME_TASK:1,START_WEIGHT:1,ADJUST_WEIGHT_START:1,REPORT_INTEGRITY:1,REPORT_TASK_DETAILS:1}
    },
    backups:[
      {at:'18.08.2026 · 23:07:27',name:'Initialimport',version:'V361',tasks:37,archive:236,weights:11,size:26703},
      {at:'19.08.2026 · 23:46:46',name:'Tages-Komplettbackup',version:'V400',tasks:37,archive:236,weights:11,size:26548},
      {at:'20.08.2026 · 23:38:13',name:'Tages-Komplettbackup',version:'V401',tasks:37,archive:236,weights:12,size:26954},
      {at:'21.08.2026 · 14:17:25',name:'Live-Komplettbackup',version:'V401',tasks:49,archive:237,weights:12,size:29606},
      {at:'21.08.2026 · 14:17:26',name:'Tages-Komplettbackup',version:'V401',tasks:49,archive:237,weights:12,size:29606}
    ],
    chatMilestones:[
      {at:'17.08.2026 · vor 04:43',title:'GitHub-Einstieg',detail:'Exakter Chatzeitpunkt nicht mehr sicher rekonstruierbar. Das Repository existiert ab 04:43:22, damit war GitHub spätestens zu diesem Zeitpunkt eingerichtet.',confidence:'rekonstruiert'},
      {at:'17.08.2026 · 04:48:49',title:'Erste App-Datei',detail:'Create index.html, 77 Zeilen. Das ist der erste harte technische Startpunkt.',confidence:'gesichert'},
      {at:'18.08.2026 · 01:56:06',title:'Web-App-Übergabe gestartet',detail:'Der Transfer aus dem Masterchat in den Web-App-Kontext wurde ausdrücklich gestartet.',confidence:'chat'},
      {at:'18.08.2026 · 02:21:38',title:'V361-Handoff',detail:'Der damalige Masterstand V361 wurde als fachliche Datenbasis dokumentiert.',confidence:'chat'},
      {at:'18.08.2026 · 13:09:34',title:'Masterchat-Neustart der Web-App',detail:'Expliziter Start der Web-App-Erstellung aus dem Masterchat heraus.',confidence:'chat'},
      {at:'18.08.2026 · 14:23:25',title:'Supabase-Projekt erstellt',detail:'Master Of Disaster Week-And-End To-Do-Dingsi in eu-west-1.',confidence:'gesichert'},
      {at:'18.08.2026 · 15:14:30',title:'PWA auf GitHub Pages',detail:'Manifest, Service Worker und App-Icons waren eingerichtet; Supabase war als Online-Datenbank vorgesehen.',confidence:'chat'},
      {at:'18.08.2026 · 23:07:27',title:'Erster kompletter Cloud-Import',detail:'V361-Snapshot mit 37 Aufgaben, 236 Archiv-Einträgen und 11 Gewichtphasen.',confidence:'gesichert'},
      {at:'19.08.2026 · 00:12:01',title:'GitHub-Integration direkt nutzbar',detail:'Repository konnte direkt gelesen und bearbeitet werden; V385 enthielt bereits Supabase-Import, Live-Sync und Backup/Restore.',confidence:'chat'},
      {at:'19.08.2026 · 00:15:00',title:'Mach-einfach-Modus',detail:'Autonomer Repo-Workflow für Analyse, Änderungen, Build-Versionierung, Tests und GitHub wurde akzeptiert.',confidence:'chat'},
      {at:'19.08.2026 · 06:21:04',title:'V394 Cloud → Local Restore',detail:'Vollständiger Supabase-Restore-Snapshot mit lokalem Sicherheitsbackup war live.',confidence:'chat'},
      {at:'20.08.2026 · 13:10:25',title:'Pull Request #1',detail:'V409 startete den heute verwendeten PR-basierten Änderungsworkflow.',confidence:'gesichert'},
      {at:'21.08.2026 · 00:16:25',title:'V431 Repository-Konsolidierung',detail:'Historische Patch-Schichten wurden gebündelt und der Repo-Wildwuchs massiv reduziert.',confidence:'gesichert'},
      {at:'21.08.2026 · 09:23:59',title:'Erster Remote-Befehl',detail:'Start des Supabase-Command-Bridge-Betriebs für Chat-/Sprachsteuerung.',confidence:'gesichert'},
      {at:'21.08.2026 · 13:54:25',title:'V450 Smart Remote Reuse',detail:'50. Pull Request: Remote-Aufgaben werden intelligent wiederverwendet oder als neue Wiederholung angelegt.',confidence:'gesichert'},
      {at:'21.08.2026 · 14:17:25',title:'Jüngster erfasster Komplettbackup-Stand',detail:'49 Aufgaben, 237 Archiv-Einträge und 12 Gewichtphasen im vollständigen Local-Master-Snapshot.',confidence:'gesichert'}
    ],
    activityWindows:[
      {date:'17.08.',windows:'04:48–14:21 · 22:45–23:12',span:'ca. 10:00 h',source:'GitHub'},
      {date:'18.08.',windows:'00:14–02:43 · 10:14–16:48 · 21:28–23:48',span:'ca. 11:23 h',source:'GitHub + Chat'},
      {date:'19.08.',windows:'00:12–06:21 · 22:50–23:53',span:'ca. 7:12 h',source:'GitHub + Chat'},
      {date:'20.08.',windows:'08:56–17:55 · 20:19–23:59',span:'ca. 12:39 h',source:'GitHub + Chat'},
      {date:'21.08.',windows:'00:00–00:34 · 07:15–14:28',span:'ca. 7:47 h',source:'GitHub + Chat'}
    ],
    grossActivityWindow:'ca. 49:01 h'
  };

  function esc(v){
    const s=String(v??'');
    return s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function fmtInt(v){return new Intl.NumberFormat('de-DE').format(Number(v)||0);}
  function fmtBytes(v){
    const n=Number(v)||0;
    if(n>=1048576)return (n/1048576).toFixed(2).replace('.',',')+' MiB';
    if(n>=1024)return (n/1024).toFixed(1).replace('.',',')+' KiB';
    return fmtInt(n)+' B';
  }
  function age(){
    const start=new Date(PROJECT_START_ISO),now=new Date();
    const ms=Math.max(0,now-start),days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000),mins=Math.floor(ms%3600000/60000);
    return `${days} T ${hours} h ${mins} min`;
  }
  function card(label,value,sub=''){
    return `<div class="statistics-card"><div class="statistics-label">${esc(label)}</div><div class="statistics-value">${esc(value)}</div>${sub?`<div class="statistics-sub">${esc(sub)}</div>`:''}</div>`;
  }
  function confidenceLabel(v){return v==='gesichert'?'GESICHERT':v==='chat'?'CHAT-ZEITSTEMPEL':'REKONSTRUIERT';}
  function ensureStyle(){
    if(document.getElementById('developmentStatsV451Style'))return;
    const s=document.createElement('style');s.id='developmentStatsV451Style';s.textContent=`
      #developmentStatsV451 .devstats-note{font-size:12px;line-height:1.45;opacity:.72;margin:8px 0 12px}
      #developmentStatsV451 .devstats-table{display:grid;gap:7px;margin-top:8px}
      #developmentStatsV451 .devstats-row{display:grid;grid-template-columns:minmax(72px,.55fr) minmax(0,2.1fr) minmax(78px,.7fr);gap:8px;align-items:start;padding:9px 10px;border:1px solid rgba(255,255,255,.10);border-radius:10px;background:rgba(255,255,255,.025)}
      #developmentStatsV451 .devstats-date{font-weight:800;font-size:12px}
      #developmentStatsV451 .devstats-main{font-size:12px;line-height:1.4;min-width:0}
      #developmentStatsV451 .devstats-span{text-align:right;font-size:12px;font-weight:800;white-space:nowrap}
      #developmentStatsV451 .devstats-event{padding:10px 11px;border-left:2px solid rgba(255,255,255,.26);margin-left:4px}
      #developmentStatsV451 .devstats-event-head{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
      #developmentStatsV451 .devstats-event-title{font-weight:800;font-size:13px}
      #developmentStatsV451 .devstats-event-time{font-size:11px;opacity:.68;white-space:nowrap}
      #developmentStatsV451 .devstats-event-detail{font-size:12px;line-height:1.45;opacity:.78;margin-top:3px}
      #developmentStatsV451 .devstats-confidence{display:inline-block;font-size:9px;font-weight:900;letter-spacing:.06em;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 6px;margin-top:6px;opacity:.72}
      #developmentStatsV451 details{margin-top:8px}
      #developmentStatsV451 summary{cursor:pointer;font-weight:800;font-size:12px;padding:8px 0}
      @media(max-width:520px){#developmentStatsV451 .devstats-row{grid-template-columns:68px 1fr}.devstats-span{grid-column:2;text-align:left!important}.devstats-event-head{display:block!important}.devstats-event-time{display:block;margin-top:2px}}
    `;document.head.appendChild(s);
  }
  function backupRows(){
    return DATA.backups.map(b=>`<div class="devstats-row"><div class="devstats-date">${esc(b.at.slice(0,10))}</div><div class="devstats-main"><strong>${esc(b.name)}</strong><br>${esc(b.at.slice(13))} · ${esc(b.version)} · ${fmtInt(b.tasks)} Aufgaben · ${fmtInt(b.archive)} Archiv · ${fmtInt(b.weights)} Gewichtphasen</div><div class="devstats-span">${fmtBytes(b.size)}</div></div>`).join('');
  }
  function timelineRows(){
    return DATA.chatMilestones.map(e=>`<div class="devstats-event"><div class="devstats-event-head"><div class="devstats-event-title">${esc(e.title)}</div><div class="devstats-event-time">${esc(e.at)}</div></div><div class="devstats-event-detail">${esc(e.detail)}</div><span class="devstats-confidence">${confidenceLabel(e.confidence)}</span></div>`).join('');
  }
  function activityRows(){
    return DATA.activityWindows.map(r=>`<div class="devstats-row"><div class="devstats-date">${esc(r.date)}</div><div class="devstats-main">${esc(r.windows)}<br><span style="opacity:.65">Quelle: ${esc(r.source)}</span></div><div class="devstats-span">${esc(r.span)}</div></div>`).join('');
  }
  function commandText(){
    return Object.entries(DATA.supabase.commandCounts).map(([k,v])=>`${k} ${v}×`).join(' · ');
  }
  function inject(container){
    if(!container||typeof currentTab!=='undefined'&&currentTab!=='statistics')return;
    ensureStyle();
    document.getElementById('developmentStatsV451')?.remove();
    const d=DATA.repo,s=DATA.supabase;
    const section=document.createElement('div');section.id='developmentStatsV451';section.className='statistics-wrapper';
    section.innerHTML=`
      <div class="statistics-group">
        <div class="statistics-section-title">APP-ENTWICKLUNG · ${BUILD_VERSION}</div>
        <div class="devstats-note">Stand ${SNAPSHOT_AT}. Datenbasis: GitHub, Chat-Zeitstempel, Supabase/Postgres und vollständige Cloud-Backups. Aktivitätsfenster zeigen nachweisbare Projektphasen, nicht die Netto-Arbeitszeit.</div>
        <div class="statistics-grid">
          ${card('PROJEKTALTER',age(),'seit Repo-Erstellung')}
          ${card('REPOSITORY START',d.created,'GitHub')}
          ${card('ERSTE APP-DATEI',d.firstFile,`${d.firstFileName} · ${fmtInt(d.firstFileLines)} Zeilen`)}
          ${card('COMMITS',fmtInt(d.reachableCommits),`${fmtInt(d.commitsAfterFirst)} nach dem ersten Commit`)}
          ${card('PULL REQUESTS',fmtInt(d.pullRequests),`${fmtInt(d.mergedPullRequests)} gemergt · ${fmtInt(d.testOnlyPullRequests)} Test-only`)}
          ${card('DATEIEN AKTUELL',fmtInt(d.currentFiles),`${d.rootFiles} Root · ${d.workflowFiles} Workflows`)}
          ${card('TEXTZEILEN AKTUELL',fmtInt(d.currentTextLines),'GitHub-Vergleich erster Commit → V450')}
          ${card('AKTUELLER DATEIUMFANG',fmtBytes(d.currentBytes),`${fmtBytes(d.currentTextBytes)} Text · ${fmtBytes(d.currentImageBytes)} Bilder`)}
          ${card('V431 AUFRÄUMAKTION',fmtInt(d.v431TouchedPaths)+' Pfade',`${fmtInt(d.v431PathsGoneNow)} davon heute nicht mehr vorhanden`)}
          ${card('AKTIVITÄTSRAHMEN',DATA.grossActivityWindow,'rekonstruierte Zeitfenster, keine Nettozeit')}
          ${card('SUPABASE START',s.created,'Projekt eu-west-1')}
          ${card('SUPABASE TABELLEN',fmtInt(s.tables),`${fmtInt(s.currentRows)} aktuelle relationale Zeilen`)}
          ${card('DB INSERTS',fmtInt(s.inserts),'Postgres Tabellenzähler')}
          ${card('DB UPDATES',fmtInt(s.updates),'Postgres Tabellenzähler')}
          ${card('DB DELETES',fmtInt(s.deletes),'vor allem Sync-/Neuaufbau-Churn')}
          ${card('DB-UMFANG',fmtBytes(s.relationBytes),'öffentliche Projekttabellen')}
          ${card('REMOTE-BEFEHLE',fmtInt(s.remoteCommands),`${fmtInt(s.remoteErrors)} Fehler`)}
          ${card('JÜNGSTER KOMPLETTBACKUP','21.08.2026 · 14:17:25','49 Aufgaben · 237 Archiv · 12 Gewichtphasen')}
        </div>
      </div>
      <div class="statistics-group"><div class="statistics-section-title">ENTWICKLUNGS-AKTIVITÄTSFENSTER</div><div class="devstats-note">Die Grenzen stammen aus GitHub-Aktivität und verfügbaren Chat-Zeitstempeln. Größere erkennbare Pausen sind getrennt. Innerhalb eines Fensters können natürlich weitere Pausen liegen.</div><div class="devstats-table">${activityRows()}</div></div>
      <div class="statistics-group"><div class="statistics-section-title">BACKUP-ENTWICKLUNG</div><div class="devstats-table">${backupRows()}</div><div class="devstats-note">Wichtig: Der vollständige Local-Master-Snapshot ist aktuell frischer als die normalisierten Domain-Tabellen. Deshalb zeigt der jüngste Komplettbackup 49 Aufgaben / 237 Archiv, während die normalisierten Tabellen noch 37 / 236 enthalten.</div></div>
      <div class="statistics-group"><div class="statistics-section-title">REMOTE-COMMAND-BRÜCKE</div><div class="devstats-note">${esc(commandText())}</div></div>
      <div class="statistics-group"><div class="statistics-section-title">ENTSTEHUNGSGESCHICHTE</div>${timelineRows()}<details><summary>Was ist exakt und was rekonstruiert?</summary><div class="devstats-note"><strong>GESICHERT</strong> = GitHub/Supabase/Backup-Zeitstempel. <strong>CHAT-ZEITSTEMPEL</strong> = wiedergefundene frühere Projekt-Nachrichten. <strong>REKONSTRUIERT</strong> = aus harten technischen Zeitpunkten abgeleitet, wenn der exakte Chat nicht mehr verfügbar ist. Der konkrete Satz, mit dem die GitHub-Anmeldung ursprünglich angestoßen wurde, ist derzeit nicht zuverlässig auffindbar; sicher ist nur, dass das Repository am 17.08.2026 um 04:43:22 bereits erstellt war.</div></details></div>
    `;
    container.appendChild(section);
  }

  const previous=typeof window.renderStatistics==='function'?window.renderStatistics:null;
  if(previous){window.renderStatistics=function(container){const r=previous.apply(this,arguments);inject(container);return r;};}
  window.__modDevelopmentStatsV451={version:BUILD_VERSION,snapshotAt:SNAPSHOT_AT,data:DATA,inject};
  if(typeof currentTab!=='undefined'&&currentTab==='statistics')setTimeout(()=>{const c=document.getElementById('viewContainer');if(c)inject(c);},0);
})();
