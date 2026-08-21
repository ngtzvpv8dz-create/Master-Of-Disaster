/* V452 · GESAMTCHRONIK + EINKLAPPBARE STATISTIK
   Rekonstruktion aus autoritativen Archiv-/Master-Chats, V361-Importdaten,
   Supabase-Snapshots und GitHub-Historie. Unklare Punkte werden gekennzeichnet.
*/
(function(){
  const BUILD='V452';
  const SNAPSHOT='21.08.2026 · 15:01';
  const HISTORY={
    summary:{
      firstDocumentedDay:'12.06.2026',
      masterAtFirstRecoveredSnapshot:'V32',
      tasksAtV32:95,
      finalChatMaster:'V361',
      versionTransitionsV32ToV361:329,
      historicalTasksV361:273,
      taskGrowthFromV32:178,
      archiveV361:235,
      operatingDaysV361:23,
      archivedActiveV361:'77:45:47',
      recoveredRuleMilestones:22,
      ruleCatalogLinesV220:'ca. 124',
      compactRuleCodeLines:'ca. 24',
      firstRepo:'17.08.2026 · 04:43:22',
      firstAppFile:'17.08.2026 · 04:48:49',
      currentBuild:'V452',
      currentPullRequests:52,
      currentMergedPullRequests:51,
      currentFiles:33,
      currentCommits:559,
      daysSinceFirstRecord:70
    },
    importArchive:{
      rows:236,completed:235,aborted:1,activeDays:23,
      work:200,selfrunner:18,leisure:11,cooking:7,weightedRows:61
    },
    phases:[
      {
        title:'PHASE 1 · AUS EINER LISTE WIRD EIN SYSTEM',period:'12.–20.06.2026',tag:'CHAT + ARCHIV',
        cards:[['ERSTER DOKUMENTIERTER TAG','12.06.2026','Archiv 01–20'],['ERSTE TAGE','77 Archivaufgaben','bis einschließlich 20.06.'],['MASTERSTAND','V32','am 20.06. bereits 95 Aufgaben'],['STATUS V32','68 erledigt','5 in Arbeit · 22 offen']],
        events:[
          ['12.06.','Erster sicher rekonstruierter Nutzungstag','Archiv 01–20 enthält bereits 20 abgeschlossene Aufgaben. Die spätere Archivquelle bestätigt damit den tatsächlichen Start spätestens an diesem Tag.','gesichert'],
          ['13.–14.06.','Die Liste wächst sofort','Archiv 21–36 und 37–50 folgen an den nächsten beiden Nutzungstagen.','gesichert'],
          ['19.–20.06.','Archiv 51–77','Bis zum 20.06. sind 77 abgeschlossene Aufgaben aus fünf Nutzungstagen rekonstruierbar.','gesichert'],
          ['20.06.','V32 als früher Referenzstand','95 Aufgaben insgesamt: 68 erledigt, 5 in Arbeit, 22 offen. Nach jeder Änderung musste die komplette Liste ausgegeben werden; jede Änderung erzeugte V+1 und die vorige Version blieb Backup.','chat'],
          ['20.06.','Archivsystem eingeführt','Abgeschlossene vergangene Tage durften als vollständiger kopierbarer Block ausgelagert und danach aus der aktiven Liste entfernt werden.','chat'],
          ['20.06.','Backup-Regel schon wieder geändert','Die anfangs vorgesehenen Meilenstein-Backups wurden bei V33 ausdrücklich abgeschafft; der direkte Vorgänger blieb weiterhin Backup.','chat'],
          ['20.06.','Der Name bleibt hängen','„Week-and-End To-Do-Dingsi“ wird zum dauerhaften Namen des Systems.','chat']
        ]
      },
      {
        title:'PHASE 2 · REGELN, ARCHIV UND VERSIONSWAHNSINN',period:'21.06.–24.07.2026',tag:'CHAT-MASTER',
        cards:[['ARCHIV 24.07.','94 Aufgaben','9 vollständig archivierte Tage'],['MEILENSTEIN','V100','V99 blieb Backup'],['FORTSCHRITT V100','77,0 %','94 von 122 erledigt'],['AKTIVER REST','28 Aufgaben','8 begonnen · 20 offen']],
        events:[
          ['21.06.','Dynamische lückenlose Nummerierung','Nach jeder Änderung wurde die komplette aktive Liste wieder fortlaufend nummeriert. Erledigte Reihenfolgen blieben erhalten, offene/laufende Aufgaben konnten nachrücken.','chat'],
          ['02.07.','V53 bringt die Zeitstempel-Regel','Antworten zum Dingsi sollten einen sichtbaren Europe/Berlin-Zeitstempel tragen und zeitliche Aussagen auf die aktuelle Systemzeit beziehen.','chat'],
          ['Juli','Archiv wird zur zweiten Datenwelt','Aktive Nummern durften sich verschieben; archivierte Nummern wurden zunehmend als historische Referenz behandelt.','rekonstruiert'],
          ['14.07.','Ohne echte Dauer kein endgültiges Erledigt','Wenn eine Aufgabe als abgeschlossen gemeldet wurde, aber keine tatsächliche Dauer vorlag, musste vor dem finalen Abschluss nach der Zeit gefragt werden.','chat'],
          ['24.07.','V100','94 Aufgaben waren archiviert. Der aktive Bereich umfasste die damaligen Aufgaben 95–122; Aufgabe 121 war pausiert, Aufgabe 122 Kochen lief.','chat'],
          ['24.07.','Erster großer Übergabepunkt','V100 wurde als sauberer Referenzstand mit vollständigen Regeln, Aufgaben, Statistik und Backup-Logik in einen neuen Chat übergeben.','chat']
        ]
      },
      {
        title:'PHASE 3 · STATISTIK, ZEITARTEN UND ZUSATZGEWICHT',period:'25.07.–02.08.2026',tag:'CHAT + ARCHIV',
        cards:[['V220','203 Aufgaben','170 erledigt · 83,7 %'],['ARCHIV V220','149 Aufgaben','17 archivierte Nutzungstage'],['ZEIT V220','≈ 59:51–59:56 h','aktive Aufgabenzeit'],['REGELKATALOG','≈ 124 Zeilen','gegenüber ≈ 24 Zeilen Kurzcode']],
        events:[
          ['25.07.','Archiv und Statistik werden getrennt dargestellt','Vergangene Einzelaufgaben sollten im Dashboard nicht mehr ständig wiederholt werden; die vollständigen Tagesblöcke blieben trotzdem erhalten.','chat'],
          ['Ende Juli','Aufgabenarten werden fachlich getrennt','Arbeit, Freizeit, Kochen und Selfrunner bekommen unterschiedliche Zeitlogiken. Maschinenlaufzeit zählt nicht einfach als aktive Arbeitszeit.','rekonstruiert'],
          ['Ende Juli','Kochen wird zweigeteilt','Wo möglich werden aktive und passive Kochzeit getrennt. Nicht sauber trennbare historische Kochzeit bleibt als eigener Wert erhalten.','chat'],
          ['Ende Juli','Zusatzgewicht wird eigene Statistik','Gewicht, Tragephasen und gewichtete aktive Aufgabenzeit werden getrennt dokumentiert. Bloßes Tragen zählt nicht automatisch als Aufgabenzeit.','chat'],
          ['02.08.','V220 zeigt die Explosion','203 Aufgaben: 149 archiviert, 21 erledigt aber noch nicht archiviert, 8 begonnen/pausiert und 25 offen. Dazu Freizeit, Pausen, Gewicht und mehrere Prioritätsstufen.','chat'],
          ['02.08.','Der Chat wird sichtbar zu groß','Der vollständige Regelkatalog lag bei rund 124 Zeilen. Vollausgaben wiederholten Regeln, Archivstände, Zeiten, Gewichte und Statusdetails; frühere Chatwechsel waren bereits wegen der wachsenden Kontextmenge nötig.','chat']
        ]
      },
      {
        title:'PHASE 4 · DINGSI-KURZSCHRIFT UND KONTEXTKRISE',period:'02.–09.08.2026',tag:'DKS + BACKUPS',
        cards:[['DKS','V1.0 → V2.0','in rund einem Tag neu strukturiert'],['REFERENZ 02.08.','V220','später V227 / V230'],['A172','18 Einsatztage','54:58:55 aktive Zeit'],['A213','22 Einsatztage','67:07:47 aktive Zeit']],
        events:[
          ['02.08.','DKS V1.0','Die „Dingsi-Kurzschrift“ entsteht als eigener verbindlicher Regel-/Entwicklungsbereich mit Masterquelle, Versionierung, Schlüssel/Decoder und Backups.','chat'],
          ['02.08.','DKS V1.1','Die tägliche Ausgabe wird radikal verkürzt: kompakter Kopf, Kurzregelcode, aktive Aufgaben, Tagesblock, aktuelle/nächste Aufgabe. Detaildaten werden weiter gepflegt, aber nicht mehr jedes Mal ausgeschüttet.','chat'],
          ['02.08.','V220 als Größenwarnung','Die ausführlichen Regeln waren ungefähr fünfmal so lang wie der kompakte Kurzcode. Das Problem war nicht mehr die Aufgabenliste allein, sondern ihre Verwaltung.','rekonstruiert'],
          ['02.–03.08.','DKS V1.3 / V227','Sogar Sonderkonstrukte wie T_STEEL bekommen eigene Betriebsregeln und bleiben offen, bis ein mehrteiliger Zustand vollständig erfüllt ist.','chat'],
          ['03.08.','DKS V2.0 / V230','Regelquelle und Betriebszustand werden getrennt: MASTER-AKTUELL für Regeln, STATE-BACKUP-AKTUELL für Aufgaben-/Archivzustand. Ein weiterer Versuch, den Chat beherrschbar zu halten.','chat'],
          ['02.08. Stand','A172-Backup','172 archivierte Aufgaben, 18 Einsatztage, 54:58:55 aktive Zeit, 1:05:00 passive Zeit, 1:38:24 nicht getrennte Kochzeit und 19:08:00 Freizeit.','gesichert'],
          ['08.08. Stand','A213','213 archivierte Aufgaben, 22 Einsatztage, 67:07:47 aktive Zeit, ca. 1:20:00 passive Zeit und 19:18:00 Freizeit.','gesichert'],
          ['09.08.','V323','259 Aufgaben insgesamt: 213 archiviert, 10 begonnen/pausiert und 36 offen.','chat']
        ]
      },
      {
        title:'PHASE 5 · DER LETZTE CHAT-MASTER',period:'09.–18.08.2026',tag:'V361 + MIGRATION',
        cards:[['LETZTER CHAT-MASTER','V361','vor der Datenmigration'],['HISTORISCHE AUFGABEN','273','235 archiviert · 38 aktiv/abgebrochen'],['ARCHIV','A001–A235','23 Einsatztage'],['ARCHIV-AKTIVZEIT','77:45:47','V361-Referenz']],
        events:[
          ['09.08.','A235 wird später als korrigierter Endstand bestätigt','Der 09.08. ist vollständig archiviert: 235 Aufgaben, 23 Einsatztage, nächste Archivnummer A236.','chat'],
          ['Mitte August','Kategorien werden fachlicher','Beispielsweise wird „Angeln und Outdoor“ in zwei getrennte Kategorien aufgeteilt. Der Chat-Master verwaltet nun nicht nur Aufgaben und Zeit, sondern auch rückwirkende Datenklassifikation.','chat'],
          ['17.–18.08.','V361 als Migrationsmaster','273 historische Aufgaben: 235 archiviert, 38 im damaligen aktuellen Bestand; 28 offen, 9 pausiert, 1 abgebrochen. Keine laufende Aufgabe und keine aktive Gewichtsphase.','chat'],
          ['V361','Regelwerk kurz vor der App','Aktive Nummern dynamisch, Archivnummern dauerhaft; echte Zeit darf nicht geraten werden; Planzeit ist nicht Istzeit; Selfrunner/Maschinenlaufzeit, passive Kochzeit und Freizeit zählen nicht als aktive Arbeit; Gewichtsphasen und gewichtete Aktivzeit bleiben getrennt.','chat'],
          ['18.08.','Import-/Integritätslogik','Der vollständige Zustand wird für die App in strukturierte Aufgaben-, Archiv-, Gewichts- und Zustandsdaten zerlegt. Ein Initialimport-Manifest bestätigt später 37 aktive Tasks, 236 Archiveinträge inklusive Test/Abbruch-Eintrag, 11 Gewichtsphasen und fehlerfreie lokale Integritätsprüfung.','gesichert']
        ]
      },
      {
        title:'PHASE 6 · AUS DEM CHAT WIRD EINE WEB-APP',period:'17.–21.08.2026',tag:'GITHUB + SUPABASE',
        cards:[['REPO START','17.08. · 04:43','GitHub'],['ERSTE DATEI','04:48:49','index.html · 77 Zeilen'],['APP-BUILD','V452','heutiger Stand'],['PRs','52','51 gemergt · 1 Test-only']],
        events:[
          ['17.08.','Das Repository entsteht','Noch während der Chat-Master weiter finalisiert wird, startet die technische App-Schiene auf GitHub.','gesichert'],
          ['17.08.','Die erste App ist lächerlich klein','Eine einzige index.html mit 77 Zeilen bildet den Startpunkt.','gesichert'],
          ['18.08.','PWA und strukturierte Migration','Die Liste wird zu einer installierbaren Web-App mit persistentem lokalen Zustand.','rekonstruiert'],
          ['18.08.','Supabase','Das Cloud-Projekt wird angelegt. Später folgen normalisierte Tabellen, Live-Sync, Restore und vollständige Backups.','gesichert'],
          ['19.–20.08.','GitHub wird zum Entwicklungsworkflow','Änderungen laufen zunehmend über Branches, Pull Requests, Build-Guard und Regressionstests statt über manuelles Ersetzen einzelner Dateien.','gesichert'],
          ['21.08.','Fernsteuerung','Supabase-Remote-Kommandos erlauben Start, Pause, Fortsetzen, Abschluss, Today-Markierung und Gewichtssteuerung aus dem Chat.','gesichert'],
          ['21.08.','V451/V452','Die App dokumentiert schließlich sogar ihre eigene Entstehung. V452 ergänzt die komplette Vorgeschichte und macht alle Statistikblöcke einklappbar.','gesichert']
        ]
      }
    ],
    ruleMilestones:[
      ['20.06.','Komplette Liste nach jeder Änderung'],['20.06.','Jede Änderung erzeugt V+1; Vorgänger bleibt Backup'],['20.06.','Keine Nummernlücken'],['20.06.','Meilenstein-Backups wieder abgeschafft'],['20.06.','Abgeschlossene Tage als vollständige Archivblöcke auslagern'],['21.06.','Aktive Liste dynamisch lückenlos neu nummerieren'],['02.07.','Europe/Berlin-Zeitstempel für Dingsi-Antworten'],['14.07.','Kein endgültiges Erledigt ohne tatsächliche Dauer'],['Juli','Nur vollständig abgeschlossene Aufgaben/Tage archivieren'],['Juli','Maschinenlaufzeit nicht als zusätzliche aktive Arbeit zählen'],['Juli','Kochen aktiv/passiv trennen'],['Juli','Freizeit separat ausweisen'],['Juli','Gewichtsphasen separat erfassen'],['Juli','Gewichtstragen allein ist keine Aufgabenzeit'],['Aug.','Neue El-Porcador-Aktivierungen = 0 Minuten'],['02.08.','DKS als eigene versionierte Regelquelle'],['02.08.','Tägliche Ausgabe auf Kurzcode reduzieren'],['03.08.','MASTER-AKTUELL und STATE-BACKUP-AKTUELL trennen'],['V361','Aktive Nummern dynamisch, Archivnummern dauerhaft unabhängig'],['V361','Istzeiten niemals raten'],['V361','Planzeit und tatsächliche Zeit strikt trennen'],['V361','Freitags-Backup als Pflichtregel']
    ]
  };

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtInt(v){return new Intl.NumberFormat('de-DE').format(Number(v)||0);}
  function card(label,value,sub=''){return `<div class="statistics-card"><div class="statistics-label">${esc(label)}</div><div class="statistics-value">${esc(value)}</div>${sub?`<div class="statistics-sub">${esc(sub)}</div>`:''}</div>`;}
  function badge(source){return `<span class="history-source-v452 ${source}">${source==='gesichert'?'GESICHERT':source==='chat'?'CHAT':'REKONSTRUIERT'}</span>`;}
  function eventRows(events){return `<div class="history-events-v452">${events.map(([date,title,detail,source])=>`<div class="history-event-v452"><div class="history-event-date-v452">${esc(date)}</div><div class="history-event-main-v452"><div class="history-event-title-v452">${esc(title)}</div><div class="history-event-detail-v452">${esc(detail)}</div>${badge(source)}</div></div>`).join('')}</div>`;}
  function phaseGroup(p){return `<div class="statistics-group history-phase-v452"><div class="statistics-section-title">${esc(p.title)}</div><div class="history-phase-meta-v452">${esc(p.period)} · ${esc(p.tag)}</div><div class="statistics-grid">${p.cards.map(c=>card(...c)).join('')}</div>${eventRows(p.events)}</div>`;}

  function ensureStyle(){
    if(document.getElementById('projectHistoryV452Style'))return;
    const style=document.createElement('style');style.id='projectHistoryV452Style';style.textContent=`
      .statistics-collapse-toolbar-v452{position:sticky;top:0;z-index:7;display:flex;gap:7px;padding:8px 0 10px;background:linear-gradient(to bottom,#0b0d0f 72%,transparent)}
      .statistics-collapse-toolbar-v452 button{flex:1;min-height:34px;border:1px solid rgba(255,255,255,.13);border-radius:10px;background:rgba(255,255,255,.045);color:inherit;font-size:11px;font-weight:800;letter-spacing:.04em}
      details.statistics-collapsible-v452{margin:0 0 9px;border:1px solid rgba(255,255,255,.10);border-radius:13px;background:rgba(255,255,255,.018);overflow:hidden}
      details.statistics-collapsible-v452>summary{list-style:none;cursor:pointer;padding:12px 13px;font-size:13px;font-weight:900;letter-spacing:.035em;display:flex;align-items:center;gap:8px}
      details.statistics-collapsible-v452>summary::-webkit-details-marker{display:none}
      details.statistics-collapsible-v452>summary:before{content:'›';font-size:19px;line-height:1;opacity:.62;transform:rotate(0deg);transition:transform .15s ease}
      details.statistics-collapsible-v452[open]>summary:before{transform:rotate(90deg)}
      details.statistics-collapsible-v452>.statistics-group{margin:0;border:0;border-top:1px solid rgba(255,255,255,.08);border-radius:0}
      #projectHistoryV452 .history-overview-note-v452,#projectHistoryV452 .history-phase-meta-v452,#projectHistoryV452 .history-source-note-v452{font-size:12px;line-height:1.45;opacity:.72;margin:7px 0 11px}
      #projectHistoryV452 .history-events-v452{display:grid;gap:7px;margin-top:10px}
      #projectHistoryV452 .history-event-v452{display:grid;grid-template-columns:72px minmax(0,1fr);gap:9px;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.02)}
      #projectHistoryV452 .history-event-date-v452{font-size:11px;font-weight:900;opacity:.75}
      #projectHistoryV452 .history-event-title-v452{font-size:12px;font-weight:900}
      #projectHistoryV452 .history-event-detail-v452{font-size:12px;line-height:1.43;opacity:.78;margin-top:3px}
      #projectHistoryV452 .history-source-v452{display:inline-block;margin-top:6px;padding:2px 6px;border:1px solid rgba(255,255,255,.14);border-radius:999px;font-size:9px;font-weight:900;letter-spacing:.055em;opacity:.70}
      #projectHistoryV452 .history-rule-list-v452{display:grid;gap:6px;margin-top:8px}
      #projectHistoryV452 .history-rule-v452{display:grid;grid-template-columns:58px 1fr;gap:8px;font-size:12px;line-height:1.4;padding:7px 8px;border-bottom:1px solid rgba(255,255,255,.06)}
      #projectHistoryV452 .history-rule-v452 strong{font-size:10px;opacity:.65}
      @media(max-width:520px){#projectHistoryV452 .history-event-v452{grid-template-columns:62px minmax(0,1fr)}.statistics-collapse-toolbar-v452{top:0}}
    `;document.head.appendChild(style);
  }

  function inject(container){
    if(!container||typeof currentTab!=='undefined'&&currentTab!=='statistics')return;
    document.getElementById('projectHistoryV452')?.remove();
    const s=HISTORY.summary,a=HISTORY.importArchive;
    const wrapper=document.createElement('div');wrapper.id='projectHistoryV452';wrapper.className='statistics-wrapper';
    wrapper.innerHTML=`
      <div class="statistics-group"><div class="statistics-section-title">GESAMTCHRONIK · ${BUILD}</div><div class="history-overview-note-v452">Stand ${SNAPSHOT}. Rekonstruiert aus wiederhergestellten Projektchats, autoritativen Archiv-/Masterständen, dem V361-Import, Supabase und GitHub. Wo eine exakte Gesamtzahl nicht mehr sicher ableitbar ist, wird bewusst mit Mindestwerten oder gekennzeichneten Rekonstruktionen gearbeitet.</div><div class="statistics-grid">
        ${card('ERSTER SICHERER TAG',s.firstDocumentedDay,'frühester Archivtag')}${card('FRÜHER SNAPSHOT','V32',`${s.tasksAtV32} Aufgaben am 20.06.`)}${card('LETZTER CHAT-MASTER',s.finalChatMaster,`${s.historicalTasksV361} historische Aufgaben`)}${card('VERSIONSSPRÜNGE',fmtInt(s.versionTransitionsV32ToV361),'V32 → V361')}${card('AUFGABENWACHSTUM','+'+fmtInt(s.taskGrowthFromV32),`${s.tasksAtV32} → ${s.historicalTasksV361}`)}${card('ARCHIV V361','A001–A235',`${s.operatingDaysV361} Einsatztage`)}${card('ARCHIV-AKTIVZEIT',s.archivedActiveV361,'V361 Referenz')}${card('REGEL-MEILENSTEINE',fmtInt(s.recoveredRuleMilestones),'wiedergefundene große Entscheidungen')}${card('REGELKATALOG V220',s.ruleCatalogLinesV220,`Kurzcode ${s.compactRuleCodeLines}`)}${card('ERSTE APP-DATEI',s.firstAppFile,'index.html · 77 Zeilen')}${card('APP-PRs V452',fmtInt(s.currentPullRequests),`${s.currentMergedPullRequests} gemergt`)}${card('APP-COMMITS V452',fmtInt(s.currentCommits),'erreichbare Main-Historie')}
      </div></div>
      ${HISTORY.phases.map(phaseGroup).join('')}
      <div class="statistics-group"><div class="statistics-section-title">REGEL-EVOLUTION · WIEDERGEFUNDENE MEILENSTEINE</div><div class="history-source-note-v452">Das ist bewusst keine behauptete vollständige Zahl aller Regeländerungen. Es sind ${HISTORY.ruleMilestones.length} größere Regelentscheidungen, die sich aus den wiederhergestellten Verläufen konkret rekonstruieren lassen. Die Masterversion selbst liefert die bessere Änderungsmetrik: allein V32 → V361 entspricht 329 versionierten Zustandsänderungen.</div><div class="history-rule-list-v452">${HISTORY.ruleMilestones.map(([d,t])=>`<div class="history-rule-v452"><strong>${esc(d)}</strong><span>${esc(t)}</span></div>`).join('')}</div></div>
      <div class="statistics-group"><div class="statistics-section-title">V361-IMPORT · HISTORISCHER DATENBESTAND</div><div class="statistics-grid">${card('ARCHIVZEILEN',fmtInt(a.rows),`${a.completed} erledigt · ${a.aborted} abgebrochen`)}${card('NUTZUNGSTAGE',fmtInt(a.activeDays),'12.06.–09.08. im Import')}${card('ARBEIT',fmtInt(a.work),'Archivzeilen')}${card('SELFRUNNER',fmtInt(a.selfrunner),'Archivzeilen')}${card('FREIZEIT',fmtInt(a.leisure),'Archivzeilen')}${card('KOCHEN',fmtInt(a.cooking),'Archivzeilen')}${card('MIT GEWICHTSDATEN',fmtInt(a.weightedRows),'Archivzeilen')}</div><div class="history-source-note-v452">Der Import enthält 236 Archivzeilen, weil neben A001–A235 ein späterer Test-/Abbruch-Eintrag mitgeführt wurde. Für den eigentlichen letzten Chat-Master bleibt A001–A235 der historische Archivstand.</div></div>
      <div class="statistics-group"><div class="statistics-section-title">QUELLENLAGE & GRENZEN</div><div class="history-source-note-v452">Exakte Gesamtzahlen für jede einzelne Umbenennung, Löschung oder Regelkorrektur der frühen Chat-Liste sind nicht seriös rekonstruierbar, weil die Liste dynamisch neu nummeriert und alte Zustände nicht wie Git-Diffs gespeichert wurden. Belastbar sind dagegen Versionsstände, Aufgaben-/Archiv-Meilensteine, viele konkrete Regeländerungen, Zeit-/Gewichtsstatistiken, die V361-Migration sowie die komplette GitHub-Historie ab 17.08. Bei Konflikten wurde ein später ausdrücklich bestätigter Master-/Archivstand gegenüber einer älteren Einzelnotiz bevorzugt.</div></div>`;
    container.appendChild(wrapper);
  }

  function groupTitle(group,index){
    const title=group.querySelector(':scope > .statistics-section-title, :scope > h2, :scope > h3');
    if(title)return {text:(title.textContent||'').trim()||`STATISTIKBLOCK ${index+1}`,node:title};
    const label=group.querySelector('.statistics-label');
    return {text:(label?.textContent||'').trim()||`STATISTIKBLOCK ${index+1}`,node:null};
  }
  function collapseGroups(container){
    if(!container)return;
    const groups=[...container.querySelectorAll('.statistics-group')];
    groups.forEach((group,index)=>{
      if(group.closest('details.statistics-collapsible-v452'))return;
      const parent=group.parentNode;if(!parent)return;
      const title=groupTitle(group,index);
      const details=document.createElement('details');details.className='statistics-collapsible-v452';details.dataset.defaultCollapsed='true';
      const summary=document.createElement('summary');summary.textContent=title.text;
      parent.insertBefore(details,group);details.appendChild(summary);details.appendChild(group);
      if(title.node)title.node.remove();
    });
  }
  function toolbar(container){
    if(!container)return;
    container.querySelector('.statistics-collapse-toolbar-v452')?.remove();
    const bar=document.createElement('div');bar.className='statistics-collapse-toolbar-v452';
    bar.innerHTML='<button type="button" data-stat-open-v452>ALLE AUFKLAPPEN</button><button type="button" data-stat-close-v452>ALLE ZUKLAPPEN</button>';
    bar.querySelector('[data-stat-open-v452]').onclick=()=>container.querySelectorAll('details.statistics-collapsible-v452').forEach(d=>d.open=true);
    bar.querySelector('[data-stat-close-v452]').onclick=()=>container.querySelectorAll('details.statistics-collapsible-v452').forEach(d=>d.open=false);
    container.prepend(bar);
  }
  function apply(container){ensureStyle();inject(container);collapseGroups(container);toolbar(container);}

  const previous=typeof window.renderStatistics==='function'?window.renderStatistics:null;
  if(previous)window.renderStatistics=function(container){const r=previous.apply(this,arguments);apply(container);return r;};
  window.__modProjectHistoryV452={version:BUILD,snapshot:SNAPSHOT,history:HISTORY,inject,collapseGroups,toolbar,apply};
  if(typeof currentTab!=='undefined'&&currentTab==='statistics')setTimeout(()=>{const c=document.getElementById('viewContainer');if(c)apply(c);},0);
})();
