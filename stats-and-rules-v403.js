/* V404 · LOESCHREGELN + ERWEITERTE STATISTIK
   - Nie gestartete normale Aufgaben duerfen vollstaendig geloescht werden.
   - Sobald eine normale Aufgabe jemals gestartet / Zeit erfasst wurde, ist Loeschen gesperrt; dann bleibt nur Abbrechen.
   - (TEST)-Aufgaben bleiben als administrative Ausnahme jederzeit vollstaendig loeschbar, damit Testdaten Archiv/Statistik nicht verunreinigen.
   - Erweiterte, formatneutrale Statistikbasis fuer spaetere Diagramme/Poster/Reports.
*/
(function(){
  const BUILD_VERSION="V404";
  let extPeriod="all";

  function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
  function hasStarted(task){
    if(!task) return false;
    if(task.startedAt || task.pausedAt || task.completedAt || task.abortedAt) return true;
    if(task.status && task.status!=="open") return true;
    const numericFields=["activeDurationMs","actualDurationMs","leisureDurationMs","passiveDurationMs","cookingActiveDurationMs","cookingPassiveDurationMs","abortedActiveDurationMs","pauseTotalMs","importedHistoricalProgressDurationMs","historicalAlreadyArchivedDurationMs","historicalUnallocatedAccountingMs"];
    if(numericFields.some(k=>num(task[k])>0)) return true;
    if(Array.isArray(task.activeSegments)&&task.activeSegments.length) return true;
    if(Array.isArray(task.cookingSegments)&&task.cookingSegments.length) return true;
    return false;
  }
  function isAdministrativeTest(task){
    if(typeof isTestTask==="function") return Boolean(isTestTask(task));
    return Boolean(task&&/\(\s*test\s*\)/i.test(String(task.text||"")));
  }

  const originalDeleteTask=typeof deleteTask==="function"?deleteTask:null;
  if(originalDeleteTask){
    deleteTask=function(id){
      const task=typeof getTask==="function"?getTask(id):(Array.isArray(tasks)?tasks.find(t=>t&&t.id===id):null);
      if(!task) return originalDeleteTask(id);
      if(hasStarted(task) && !isAdministrativeTest(task)){
        if(typeof showInfoModal==="function") showInfoModal("Löschen nicht mehr möglich","Diese Aufgabe wurde bereits gestartet oder enthält erfasste Zeit. Sie bleibt deshalb dokumentierbar und kann nur noch abgebrochen werden.");
        return;
      }
      return originalDeleteTask(id);
    };
  }

  function dateKey(item){
    if(item&&item.completedDate) return String(item.completedDate).slice(0,10);
    const raw=item&&(item.completedAt||item.abortedAt||item.archivedAt);
    if(!raw) return null;
    const d=new Date(raw); if(!Number.isFinite(d.getTime())) return null;
    try{return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}catch(_){return d.toISOString().slice(0,10);}
  }
  function berlinToday(){
    try{return new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}catch(_){return new Date().toISOString().slice(0,10);}
  }
  function dateFromKey(k){ return k?new Date(k+"T12:00:00Z"):null; }
  function inPeriod(item){
    const k=dateKey(item); if(!k) return extPeriod==="all";
    const today=berlinToday();
    if(extPeriod==="all") return true;
    if(extPeriod==="today") return k===today;
    const d=dateFromKey(k), t=dateFromKey(today); if(!d||!t) return false;
    const diff=Math.floor((t-d)/86400000);
    if(extPeriod==="7") return diff>=0&&diff<7;
    if(extPeriod==="30") return diff>=0&&diff<30;
    if(extPeriod==="90") return diff>=0&&diff<90;
    if(extPeriod==="year") return k.slice(0,4)===today.slice(0,4);
    if(extPeriod==="month") return k.slice(0,7)===today.slice(0,7);
    return true;
  }
  function activeMs(item){
    try{ if(typeof getArchiveAccountingActiveMs==="function") return num(getArchiveAccountingActiveMs(item)); }catch(_){}
    return num(item&&item.archiveAccountingActiveDurationMs)||num(item&&item.activeDurationMs)||num(item&&item.actualDurationMs);
  }
  function weightedMs(item){
    if(item&&Number.isFinite(Number(item.weightedActiveDurationMs))) return num(item.weightedActiveDurationMs);
    return num(item&&item.historicalWeightKg)>0?activeMs(item):0;
  }
  function weightKg(item){ return num(item&&item.historicalWeightKg)||num(item&&item.weightInfo&&item.weightInfo.weightKg)||0; }
  function fmt(ms){ return typeof formatDuration==="function"?formatDuration(Math.max(0,Math.round(ms))):Math.round(ms/60000)+" min"; }
  function pct(a,b){ return b>0?(a/b*100).toFixed(1).replace(".",",")+" %":"0,0 %"; }
  function median(values){ if(!values.length)return 0; const a=[...values].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
  function esc(v){ return typeof escapeHtml==="function"?escapeHtml(String(v??"")):String(v??""); }

  function streak(keys){
    const s=[...new Set(keys.filter(Boolean))].sort(); if(!s.length)return {longest:0,current:0};
    let longest=1,run=1;
    for(let i=1;i<s.length;i++){ const diff=(dateFromKey(s[i])-dateFromKey(s[i-1]))/86400000; run=diff===1?run+1:1; longest=Math.max(longest,run); }
    let current=0, cursor=dateFromKey(berlinToday()); const set=new Set(s);
    while(set.has(cursor.toISOString().slice(0,10))){ current++; cursor=new Date(cursor.getTime()-86400000); }
    return {longest,current};
  }
  function topEntries(map,n=5){ return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n); }

  function compute(){
    const rows=(Array.isArray(archive)?archive:[]).filter(inPeriod);
    const completed=rows.filter(x=>x&&x.status!=="aborted");
    const aborted=rows.filter(x=>x&&x.status==="aborted");
    const durations=rows.map(activeMs).filter(v=>v>0);
    const totalActive=durations.reduce((a,b)=>a+b,0);
    const totalPause=rows.reduce((s,x)=>s+num(x&&x.pauseTotalMs),0);
    const cookingPassive=rows.reduce((s,x)=>s+num(x&&x.cookingPassiveDurationMs),0);
    const leisure=rows.reduce((s,x)=>s+num(x&&x.leisureDurationMs),0);
    const weighted=rows.reduce((s,x)=>s+weightedMs(x),0);
    const kgHours=rows.reduce((s,x)=>s+(weightedMs(x)/3600000)*weightKg(x),0);
    const dates=rows.map(dateKey).filter(Boolean);
    const activeDays=new Set(dates).size;
    const perDay=new Map(); const perDayTime=new Map(); const categories=new Map(); const types=new Map(); const priorities=new Map(); const months=new Map(); const names=new Map();
    rows.forEach(x=>{
      const k=dateKey(x); if(k){perDay.set(k,(perDay.get(k)||0)+1);perDayTime.set(k,(perDayTime.get(k)||0)+activeMs(x));months.set(k.slice(0,7),(months.get(k.slice(0,7))||0)+activeMs(x));}
      const c=String(x&&x.category||"Ohne Kategorie"); categories.set(c,(categories.get(c)||0)+1);
      const ty=String(x&&x.type||"work"); types.set(ty,(types.get(ty)||0)+1);
      const pr=String(x&&x.priority||"normal"); priorities.set(pr,(priorities.get(pr)||0)+1);
      const name=String(x&&x.text||"Unbenannt").trim(); const old=names.get(name)||{count:0,time:0}; old.count++; old.time+=activeMs(x); names.set(name,old);
    });
    const longestTask=[...rows].sort((a,b)=>activeMs(b)-activeMs(a))[0]||null;
    const fastestTask=[...rows].filter(x=>activeMs(x)>0).sort((a,b)=>activeMs(a)-activeMs(b))[0]||null;
    const topDayCount=topEntries(perDay,1)[0]||null; const topDayTime=topEntries(perDayTime,1)[0]||null;
    const st=streak(dates);
    const repeat=[...names.entries()].sort((a,b)=>b[1].count-a[1].count||b[1].time-a[1].time).slice(0,5);
    return {rows,completed,aborted,durations,totalActive,totalPause,cookingPassive,leisure,weighted,kgHours,activeDays,categories,types,priorities,months,longestTask,fastestTask,topDayCount,topDayTime,st,repeat};
  }

  function card(label,value,sub=""){ return `<div class="statistics-card"><div class="statistics-label">${esc(label)}</div><div class="statistics-value">${esc(value)}</div>${sub?`<div class="statistics-sub">${esc(sub)}</div>`:""}</div>`; }
  function list(title,entries,formatter){
    return `<div class="statistics-group"><div class="statistics-section-title">${esc(title)}</div><div class="statistics-toplist">${entries.length?entries.map((e,i)=>`<div class="statistics-topitem"><div class="statistics-toprank">#${i+1}</div><div class="statistics-topname">${esc(e[0])}</div><div class="statistics-topvalue">${esc(formatter(e))}</div></div>`).join(""):`<div class="statistics-empty-small">Noch keine Daten.</div>`}</div></div>`;
  }
  function inject(container){
    if(!container||currentTab!=="statistics")return;
    const old=document.getElementById("extendedStatsV403"); if(old)old.remove();
    const s=compute();
    const section=document.createElement("div"); section.id="extendedStatsV403"; section.className="statistics-wrapper";
    const periodButtons=[["all","GESAMT"],["today","HEUTE"],["7","7 TAGE"],["30","30 TAGE"],["90","90 TAGE"],["month","MONAT"],["year","JAHR"]];
    const typeLabels={work:"ARBEIT",leisure:"FREIZEIT",selfrunner:"SELBSTLÄUFER",cooking:"KOCHEN"};
    const topCats=topEntries(s.categories,8); const topTypes=topEntries(s.types,8).map(([k,v])=>[typeLabels[k]||k,v]); const topPr=topEntries(s.priorities,8);
    const avg=s.durations.length?s.totalActive/s.durations.length:0;
    const completionRate=pct(s.completed.length,s.rows.length);
    section.innerHTML=`
      <div class="statistics-group"><div class="statistics-section-title">📊 ERWEITERTE AUSWERTUNG · ${BUILD_VERSION}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px;">${periodButtons.map(([k,l])=>`<button class="option-button ${extPeriod===k?"selected":""}" data-ext-period="${k}">${l}</button>`).join("")}</div>
        <div class="statistics-grid">
          ${card("ARCHIV-EINTRÄGE",s.rows.length,"im gewählten Zeitraum")}${card("ERLEDIGT",s.completed.length,completionRate+" Abschlussquote")}${card("ABGEBROCHEN",s.aborted.length,pct(s.aborted.length,s.rows.length)+" Abbruchquote")}${card("AKTIVE TAGE",s.activeDays,"Tage mit dokumentierter Aktivität")}
          ${card("AKTIVE ZEIT",fmt(s.totalActive),"Summe dokumentierter Aktivzeit")}${card("Ø PRO AUFGABE",fmt(avg),"Mittelwert")}${card("MEDIAN",fmt(median(s.durations)),"robuster typischer Wert")}${card("Ø PRO AKTIVEM TAG",fmt(s.activeDays?s.totalActive/s.activeDays:0),"Aktivzeit je Nutzungstag")}
          ${card("PAUSEN",fmt(s.totalPause),"dokumentierte Pausen")}${card("KOCHEN PASSIV",fmt(s.cookingPassive),"passive Kochzeit")}${card("FREIZEIT",fmt(s.leisure),"dokumentierte Freizeit")}${card("MIT ZUSATZGEWICHT",fmt(s.weighted),pct(s.weighted,s.totalActive)+" der Aktivzeit")}
          ${card("KG-STUNDEN",s.kgHours.toFixed(1).replace(".",","),"Gewicht × aktive Tragezeit")}${card("LÄNGSTE SERIE",s.st.longest+" Tage","aufeinanderfolgende aktive Tage")}${card("AKTUELLE SERIE",s.st.current+" Tage","bis heute")}
          ${card("REKORD · AUFGABEN/TAG",s.topDayCount?s.topDayCount[1]+"":"—",s.topDayCount?s.topDayCount[0]:"")}${card("REKORD · ZEIT/TAG",s.topDayTime?fmt(s.topDayTime[1]):"—",s.topDayTime?s.topDayTime[0]:"")}
        </div>
      </div>
      <div class="statistics-group"><div class="statistics-section-title">🏆 AUFGABEN-REKORDE</div><div class="statistics-grid">
        ${card("LÄNGSTE AUFGABE",s.longestTask?fmt(activeMs(s.longestTask)):"—",s.longestTask?s.longestTask.text:"")}${card("KÜRZESTE AUFGABE",s.fastestTask?fmt(activeMs(s.fastestTask)):"—",s.fastestTask?s.fastestTask.text:"")}
      </div></div>
      ${list("TOP KATEGORIEN",topCats,e=>e[1]+"×")}
      ${list("AUFGABENARTEN",topTypes,e=>e[1]+"×")}
      ${list("PRIORITÄTEN",topPr,e=>e[1]+"×")}
      ${list("HÄUFIGSTE WIEDERKEHRENDE AUFGABEN",s.repeat.map(([k,v])=>[k,v]),e=>e[1].count+"× · "+fmt(e[1].time))}
      ${list("STÄRKSTE MONATE NACH AKTIVZEIT",topEntries(s.months,12),e=>fmt(e[1]))}
      <div class="statistics-group"><div class="statistics-section-title">🧱 REPORT-BASIS</div><div class="statistics-empty-small">Diese Kennzahlen werden aus den Archivdaten berechnet und sind bewusst formatneutral aufgebaut. Sie können später für Diagramme, Poster, PDFs oder größere Jahres-/Projektübersichten weiterverwendet werden.</div></div>`;
    container.appendChild(section);
    section.querySelectorAll("[data-ext-period]").forEach(btn=>btn.addEventListener("click",()=>{extPeriod=btn.dataset.extPeriod; if(typeof render==="function")render();}));
  }

  const originalRenderStatistics=typeof renderStatistics==="function"?renderStatistics:null;
  if(originalRenderStatistics){
    renderStatistics=function(container){ originalRenderStatistics(container); inject(container); };
  }
  window.__modStatsV403={compute,hasStarted,isAdministrativeTest,setPeriod:(p)=>{extPeriod=p;}};
})();
