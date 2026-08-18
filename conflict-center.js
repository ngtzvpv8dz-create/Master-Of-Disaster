/* ======================================
   V387 – LOCAL ↔ CLOUD KONFLIKTZENTRALE
   READ ONLY: KEIN AUTOMATISCHES ÜBERSCHREIBEN
====================================== */

(function () {

function normalizeConflictValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) return value.map(normalizeConflictValue);
  if (value && typeof value === "object") {
    const result = {};
    Object.keys(value).sort().forEach(key => {
      result[key] = normalizeConflictValue(value[key]);
    });
    return result;
  }
  return value;
}

function conflictEqual(a,b) {
  return JSON.stringify(normalizeConflictValue(a)) === JSON.stringify(normalizeConflictValue(b));
}

function latestIso(values) {
  let best = null;
  let bestMs = -1;
  (Array.isArray(values) ? values : []).flat(Infinity).forEach(value => {
    if (!value) return;
    const ms = new Date(value).getTime();
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  });
  return best;
}

function winner(localTime,cloudTime) {
  const l = localTime ? new Date(localTime).getTime() : NaN;
  const c = cloudTime ? new Date(cloudTime).getTime() : NaN;
  if (Number.isFinite(l) && Number.isFinite(c)) {
    if (Math.abs(l-c) < 1000) return "same-time";
    return l > c ? "local-newer" : "cloud-newer";
  }
  if (Number.isFinite(l)) return "local-time-only";
  if (Number.isFinite(c)) return "cloud-time-only";
  return "unknown";
}

function winnerLabel(value) {
  if (value === "local-newer") return "📱 LOKAL NEUER";
  if (value === "cloud-newer") return "☁️ CLOUD NEUER";
  if (value === "same-time") return "🕒 GLEICHER ZEITPUNKT";
  if (value === "local-time-only") return "📱 NUR LOKALER ZEITPUNKT";
  if (value === "cloud-time-only") return "☁️ NUR CLOUD-ZEITPUNKT";
  return "❔ ZEITPUNKT UNKLAR";
}

function formatConflictTime(value) {
  return value ? formatSupabaseSyncTimestamp(value) : "nicht sicher bestimmbar";
}

const labels = {
  text:"Text", status:"Status", type:"Typ", priority:"Priorität", optional:"Optional",
  dueMode:"Fälligkeit", dueDate:"Fälligkeitsdatum", todayDate:"Heute-Zuordnung", todayOrder:"Heute-Reihenfolge",
  planDurationMs:"Planzeit", startedAt:"Startzeit", pausedAt:"Pausenzeit", completedAt:"Abschlusszeit", abortedAt:"Abbruchzeit",
  pauseTotalMs:"Pausendauer", activeDurationMs:"Aktive Zeit", actualDurationMs:"Gesamtzeit", leisureDurationMs:"Freizeit",
  passiveDurationMs:"Passive Zeit", cookingActiveDurationMs:"Kochen aktiv", cookingPassiveDurationMs:"Kochen passiv",
  cookingMode:"Kochmodus", abortedActiveDurationMs:"Abbruch-Aktivzeit", activeSegments:"Aktivsegmente", cookingSegments:"Kochsegmente",
  completedDate:"Archivdatum", category:"Kategorie", weightKg:"Gewicht", phaseDate:"Gewichtsdatum", nextArchiveNumber:"Nächste Archivnummer"
};

function changedFields(localValue,cloudValue) {
  const keys = new Set([...Object.keys(localValue || {}),...Object.keys(cloudValue || {})]);
  return [...keys]
    .filter(key => !conflictEqual(localValue ? localValue[key] : null, cloudValue ? cloudValue[key] : null))
    .map(key => labels[key] || key);
}

function localTaskSegments(task,kind) {
  const source = kind === "cooking" ? task && task.cookingSegments : task && task.activeSegments;
  return (Array.isArray(source) ? source : []).map(segment => kind === "cooking"
    ? { mode:segment.mode || null, startedAt:segment.startedAt || null, endedAt:segment.endedAt || null, durationMs:importSegmentDurationMs(segment) }
    : { startedAt:segment.startedAt || null, endedAt:segment.endedAt || null, durationMs:importSegmentDurationMs(segment), weightKg:importPositiveNumberOrNull(segment.weightKg) }
  ).sort((a,b)=>String(a.startedAt||"").localeCompare(String(b.startedAt||"")));
}

function cloudSegments(rows,kind) {
  return (Array.isArray(rows) ? rows : []).map(row => kind === "cooking"
    ? { mode:row.mode || null, startedAt:row.started_at || null, endedAt:row.ended_at || null, durationMs:importNonNegativeNumberOrNull(row.duration_ms) }
    : { startedAt:row.started_at || null, endedAt:row.ended_at || null, durationMs:importNonNegativeNumberOrNull(row.duration_ms), weightKg:importPositiveNumberOrNull(row.weight_kg) }
  ).sort((a,b)=>String(a.startedAt||"").localeCompare(String(b.startedAt||"")));
}

function localTaskValue(task) {
  return {
    text:String(task && task.text || ""), status:task && task.status || "open", type:task && task.type || "work",
    priority:task && task.priority || "normal", optional:Boolean(task && task.optional), dueMode:task && task.dueMode || "none",
    dueDate:task && task.dueDate || null, todayDate:task && task.todayDate || null,
    todayOrder:Number.isInteger(Number(task && task.todayOrder)) ? Number(task.todayOrder) : null,
    planDurationMs:importNonNegativeNumberOrNull(task && task.planDurationMs), startedAt:task && task.startedAt || null,
    pausedAt:task && task.pausedAt || null, completedAt:task && task.completedAt || null, abortedAt:task && task.abortedAt || null,
    pauseTotalMs:importNonNegativeNumberOrNull(task && task.pauseTotalMs) || 0,
    activeDurationMs:importNonNegativeNumberOrNull(task && task.activeDurationMs), actualDurationMs:importNonNegativeNumberOrNull(task && task.actualDurationMs),
    leisureDurationMs:importNonNegativeNumberOrNull(task && task.leisureDurationMs), passiveDurationMs:importNonNegativeNumberOrNull(task && task.passiveDurationMs),
    cookingActiveDurationMs:importNonNegativeNumberOrNull(task && task.cookingActiveDurationMs), cookingPassiveDurationMs:importNonNegativeNumberOrNull(task && task.cookingPassiveDurationMs),
    cookingMode:task && task.cookingMode || "active", abortedActiveDurationMs:importNonNegativeNumberOrNull(task && task.abortedActiveDurationMs),
    activeSegments:localTaskSegments(task,"active"), cookingSegments:localTaskSegments(task,"cooking")
  };
}

function cloudTaskValue(row,active,cooking) {
  return {
    text:String(row && row.text || ""), status:row && row.status || "open", type:row && row.type || "work",
    priority:row && row.priority || "normal", optional:Boolean(row && row.optional), dueMode:row && row.due_mode || "none",
    dueDate:row && row.due_date || null, todayDate:row && row.today_date || null,
    todayOrder:Number.isInteger(Number(row && row.today_order)) ? Number(row.today_order) : null,
    planDurationMs:importNonNegativeNumberOrNull(row && row.plan_duration_ms), startedAt:row && row.started_at || null,
    pausedAt:row && row.paused_at || null, completedAt:row && row.completed_at || null, abortedAt:row && row.aborted_at || null,
    pauseTotalMs:importNonNegativeNumberOrNull(row && row.pause_total_ms) || 0,
    activeDurationMs:importNonNegativeNumberOrNull(row && row.active_duration_ms), actualDurationMs:importNonNegativeNumberOrNull(row && row.actual_duration_ms),
    leisureDurationMs:importNonNegativeNumberOrNull(row && row.leisure_duration_ms), passiveDurationMs:importNonNegativeNumberOrNull(row && row.passive_duration_ms),
    cookingActiveDurationMs:importNonNegativeNumberOrNull(row && row.cooking_active_duration_ms), cookingPassiveDurationMs:importNonNegativeNumberOrNull(row && row.cooking_passive_duration_ms),
    cookingMode:row && row.cooking_mode || "active", abortedActiveDurationMs:importNonNegativeNumberOrNull(row && row.aborted_active_duration_ms),
    activeSegments:active, cookingSegments:cooking
  };
}

function archiveValueLocal(item) {
  const segments=(Array.isArray(item && item.activeSegments)?item.activeSegments:[]).map(s=>({startedAt:s.startedAt||null,endedAt:s.endedAt||null,durationMs:importSegmentDurationMs(s)})).sort((a,b)=>String(a.startedAt||"").localeCompare(String(b.startedAt||"")));
  return {
    text:String(item && item.text || ""), status:item && item.status || "completed", type:item && item.type || "work",
    priority:item && item.priority || "normal", optional:Boolean(item && item.optional), dueMode:item && item.dueMode || "none",
    dueDate:item && item.dueDate || null, completedDate:item && item.completedDate || null, startedAt:item && item.startedAt || null,
    completedAt:item && item.completedAt || null, activeDurationMs:importNonNegativeNumberOrNull(item && item.activeDurationMs),
    actualDurationMs:importNonNegativeNumberOrNull(item && item.actualDurationMs), leisureDurationMs:importNonNegativeNumberOrNull(item && item.leisureDurationMs),
    cookingActiveDurationMs:importNonNegativeNumberOrNull(item && item.cookingActiveDurationMs), cookingPassiveDurationMs:importNonNegativeNumberOrNull(item && item.cookingPassiveDurationMs),
    pauseTotalMs:importNonNegativeNumberOrNull(item && item.pauseTotalMs) || 0, category:item && item.category || null, activeSegments:segments
  };
}

function archiveValueCloud(row,segments) {
  return {
    text:String(row && row.text || ""), status:row && row.status || "completed", type:row && row.type || "work",
    priority:row && row.priority || "normal", optional:Boolean(row && row.optional), dueMode:row && row.due_mode || "none",
    dueDate:row && row.due_date || null, completedDate:row && row.completed_date || null, startedAt:row && row.started_at || null,
    completedAt:row && row.completed_at || null, activeDurationMs:importNonNegativeNumberOrNull(row && row.active_duration_ms),
    actualDurationMs:importNonNegativeNumberOrNull(row && row.actual_duration_ms), leisureDurationMs:importNonNegativeNumberOrNull(row && row.leisure_duration_ms),
    cookingActiveDurationMs:importNonNegativeNumberOrNull(row && row.cooking_active_duration_ms), cookingPassiveDurationMs:importNonNegativeNumberOrNull(row && row.cooking_passive_duration_ms),
    pauseTotalMs:importNonNegativeNumberOrNull(row && row.pause_total_ms) || 0, category:row && row.category || null,
    activeSegments:cloudSegments(segments,"archive").map(s=>({startedAt:s.startedAt,endedAt:s.endedAt,durationMs:s.durationMs}))
  };
}

function summary(kind,value,key) {
  if (!value) return "NICHT VORHANDEN";
  if (kind === "task") return `${value.status || "?"} · ${value.text || "Unbenannte Aufgabe"}${value.activeDurationMs !== null && value.activeDurationMs !== undefined ? " · aktiv " + formatDuration(value.activeDurationMs) : ""}`;
  if (kind === "archive") return `A${String(key).padStart(3,"0")} · ${value.text || "Unbenannte Archivaufgabe"}${value.activeDurationMs !== null && value.activeDurationMs !== undefined ? " · aktiv " + formatDuration(value.activeDurationMs) : ""}`;
  if (kind === "weight") return `${value.weightKg || "?"} kg · ${value.startedAt ? formatConflictTime(value.startedAt) : "Start unklar"}${value.endedAt ? " → " + formatConflictTime(value.endedAt) : " · läuft"}`;
  if (kind === "app") return `Nächste Archivnummer A${value.nextArchiveNumber || "?"}`;
  return "";
}

function conflictCard(item) {
  const wClass=item.winner === "local-newer" ? "local" : item.winner === "cloud-newer" ? "cloud" : "unknown";
  return `
  <div class="cloud-conflict-item">
    <div class="cloud-conflict-head">
      <div><div class="cloud-conflict-kind">${escapeHtml(item.kindLabel)}</div><div class="cloud-conflict-title">${escapeHtml(item.title)}</div></div>
      <div class="cloud-conflict-winner ${wClass}">${escapeHtml(winnerLabel(item.winner))}</div>
    </div>
    <div class="cloud-conflict-fields">ABWEICHEND · ${escapeHtml(item.changed.join(" · ") || "Datensatz fehlt auf einer Seite")}</div>
    <div class="cloud-conflict-columns">
      <div class="cloud-conflict-side local"><div class="cloud-conflict-side-title">📱 LOKAL</div><div class="cloud-conflict-summary">${escapeHtml(item.localSummary)}</div><div class="cloud-conflict-time">Letzte erkennbare Änderung: ${escapeHtml(formatConflictTime(item.localTime))}</div></div>
      <div class="cloud-conflict-side cloud"><div class="cloud-conflict-side-title">☁️ CLOUD</div><div class="cloud-conflict-summary">${escapeHtml(item.cloudSummary)}</div><div class="cloud-conflict-time">Letzte erkennbare Änderung: ${escapeHtml(formatConflictTime(item.cloudTime))}</div></div>
    </div>
    <div class="cloud-conflict-actions"><button class="cloud-conflict-choice" disabled>📱 LOKAL ÜBERNEHMEN</button><button class="cloud-conflict-choice" disabled>☁️ CLOUD ÜBERNEHMEN</button></div>
    <div class="cloud-conflict-readonly">V387 · NUR VERGLEICH · NOCH KEIN ÜBERSCHREIBEN</div>
  </div>`;
}

function renderConflictCenter() {
  const button=document.querySelector(".supabase-startcheck-action");
  if (!button) return;
  const old=document.getElementById("cloudConflictCenter");
  if (old) old.remove();
  const conflicts=Array.isArray(supabaseCloudStartCheckState.conflicts) ? supabaseCloudStartCheckState.conflicts : null;
  if (!conflicts) return;
  const host=document.createElement("div");
  host.id="cloudConflictCenter";
  host.className="cloud-conflict-center " + (conflicts.length ? "warn" : "ok");
  host.innerHTML=conflicts.length
    ? `<div class="cloud-conflict-center-title">⚠️ KONFLIKTZENTRALE · ${conflicts.length} ABWEICHUNG${conflicts.length===1?"":"EN"}</div><div class="cloud-conflict-intro">Nichts wurde automatisch überschrieben. Die Zeitangabe ist jeweils die letzte sicher erkennbare Änderung. Wenn das nicht eindeutig feststellbar ist, steht es ausdrücklich dabei.</div>${conflicts.map(conflictCard).join("")}`
    : `<div class="cloud-conflict-center-title">🛡️ KONFLIKTZENTRALE</div><div class="cloud-conflict-empty">Keine inhaltlichen Abweichungen gefunden. Lokal und Cloud sind auf Datensatzebene synchron. ✅</div>`;
  button.insertAdjacentElement("afterend",host);
}

const originalRender=render;
render=function () {
  originalRender();
  if (currentTab === "dev") setTimeout(renderConflictCenter,0);
};

runSupabaseCloudStartCheck=async function (manual=true) {
  const client=getSupabaseClient();
  if (!client) {
    supabaseCloudStartCheckState={status:"warn",label:"OFFLINE / KEIN CLIENT ⚠️",detail:"Lokale Daten bleiben führend. Es wird nichts aus der Cloud geladen.",checkedAt:new Date().toISOString(),counts:null,conflicts:null};
    render();
    return supabaseCloudStartCheckState;
  }
  try {
    const {data:sessionData,error:sessionError}=await client.auth.getSession();
    if (sessionError || !sessionData || !sessionData.session || !sessionData.session.user) {
      supabaseCloudStartCheckState={status:"warn",label:"NICHT ANGEMELDET ⚠️",detail:"Kein Cloud-Vergleich möglich. Lokal bleibt Master.",checkedAt:new Date().toISOString(),counts:null,conflicts:null};
      render();
      return supabaseCloudStartCheckState;
    }
    const userId=sessionData.session.user.id;
    const tables=["app_state","tasks","task_active_segments","task_cooking_segments","archive_entries","archive_active_segments","weight_phases","legacy_metadata"];
    const cloud={};
    for (const table of tables) {
      const {data,error}=await client.from(table).select("*").eq("user_id",userId);
      if (error) throw new Error(table + ": " + error.message);
      cloud[table]=Array.isArray(data)?data:[];
    }
    const counts={};
    tables.forEach(table=>counts[table]=cloud[table].length);
    const conflicts=[];

    const activeByTask=new Map();
    cloud.task_active_segments.forEach(row=>{const list=activeByTask.get(row.task_id)||[];list.push(row);activeByTask.set(row.task_id,list);});
    const cookingByTask=new Map();
    cloud.task_cooking_segments.forEach(row=>{const list=cookingByTask.get(row.task_id)||[];list.push(row);cookingByTask.set(row.task_id,list);});
    const localTaskMap=new Map(tasks.filter(t=>!isTestTask(t)&&Number.isInteger(Number(t&&t.id))).map(t=>[Number(t.id),t]));
    const cloudTaskMap=new Map(cloud.tasks.filter(r=>Number.isInteger(Number(r&&r.legacy_task_id))).map(r=>[Number(r.legacy_task_id),r]));
    for (const key of [...new Set([...localTaskMap.keys(),...cloudTaskMap.keys()])].sort((a,b)=>a-b)) {
      const local=localTaskMap.get(key)||null;
      const row=cloudTaskMap.get(key)||null;
      const localValue=local?localTaskValue(local):null;
      const cloudValue=row?cloudTaskValue(row,cloudSegments(activeByTask.get(row.id)||[],"active"),cloudSegments(cookingByTask.get(row.id)||[],"cooking")):null;
      if (!conflictEqual(localValue,cloudValue)) {
        const localTime=local?latestIso([local.updatedAt,local.modifiedAt,local.completedAt,local.abortedAt,local.pausedAt,local.startedAt,(local.activeSegments||[]).map(s=>[s.endedAt,s.startedAt]),(local.cookingSegments||[]).map(s=>[s.endedAt,s.startedAt]),Number(local.id)>1577836800000?new Date(Number(local.id)).toISOString():null]):null;
        const cloudTime=row?latestIso([row.updated_at,row.modified_at,row.completed_at,row.aborted_at,row.paused_at,row.started_at,row.created_at]):null;
        conflicts.push({kindLabel:"AUFGABE",title:(localValue&&localValue.text)||(cloudValue&&cloudValue.text)||`Aufgabe ${key}`,changed:changedFields(localValue||{},cloudValue||{}),localSummary:summary("task",localValue,key),cloudSummary:summary("task",cloudValue,key),localTime,cloudTime,winner:winner(localTime,cloudTime)});
      }
    }

    const archiveSegById=new Map();
    cloud.archive_active_segments.forEach(row=>{const list=archiveSegById.get(row.archive_entry_id)||[];list.push(row);archiveSegById.set(row.archive_entry_id,list);});
    const localArchiveMap=new Map(getRealArchiveForSupabaseImport().filter(i=>Number.isInteger(Number(i&&i.archiveNumber))).map(i=>[Number(i.archiveNumber),i]));
    const cloudArchiveMap=new Map(cloud.archive_entries.filter(r=>Number.isInteger(Number(r&&r.archive_number))).map(r=>[Number(r.archive_number),r]));
    for (const key of [...new Set([...localArchiveMap.keys(),...cloudArchiveMap.keys()])].sort((a,b)=>a-b)) {
      const local=localArchiveMap.get(key)||null;
      const row=cloudArchiveMap.get(key)||null;
      const localValue=local?archiveValueLocal(local):null;
      const cloudValue=row?archiveValueCloud(row,archiveSegById.get(row.id)||[]):null;
      if (!conflictEqual(localValue,cloudValue)) {
        const localTime=local?latestIso([local.updatedAt,local.modifiedAt,local.archivedAt,local.completedAt,(local.activeSegments||[]).map(s=>[s.endedAt,s.startedAt])]):null;
        const cloudTime=row?latestIso([row.updated_at,row.modified_at,row.archived_at,row.completed_at,row.created_at]):null;
        conflicts.push({kindLabel:"ARCHIV",title:`A${String(key).padStart(3,"0")} · ${(localValue&&localValue.text)||(cloudValue&&cloudValue.text)||"Unbenannt"}`,changed:changedFields(localValue||{},cloudValue||{}),localSummary:summary("archive",localValue,key),cloudSummary:summary("archive",cloudValue,key),localTime,cloudTime,winner:winner(localTime,cloudTime)});
      }
    }

    const localWeightMap=new Map((Array.isArray(weightPhases)?weightPhases:[]).filter(p=>Number.isInteger(Number(p&&p.id))).map(p=>[Number(p.id),p]));
    const cloudWeightMap=new Map(cloud.weight_phases.filter(r=>Number.isInteger(Number(r&&r.legacy_phase_id))).map(r=>[Number(r.legacy_phase_id),r]));
    for (const key of [...new Set([...localWeightMap.keys(),...cloudWeightMap.keys()])].sort((a,b)=>a-b)) {
      const local=localWeightMap.get(key)||null;
      const row=cloudWeightMap.get(key)||null;
      const localValue=local?{weightKg:importPositiveNumberOrNull(local.weightKg),startedAt:local.startedAt||null,endedAt:local.endedAt||null,phaseDate:local.date||null}:null;
      const cloudValue=row?{weightKg:importPositiveNumberOrNull(row.weight_kg),startedAt:row.started_at||null,endedAt:row.ended_at||null,phaseDate:row.phase_date||null}:null;
      if (!conflictEqual(localValue,cloudValue)) {
        const localTime=local?latestIso([local.updatedAt,local.endedAt,local.startedAt]):null;
        const cloudTime=row?latestIso([row.updated_at,row.ended_at,row.started_at,row.created_at]):null;
        conflicts.push({kindLabel:"ZUSATZGEWICHT",title:`Gewichtsphase ${key}`,changed:changedFields(localValue||{},cloudValue||{}),localSummary:summary("weight",localValue,key),cloudSummary:summary("weight",cloudValue,key),localTime,cloudTime,winner:winner(localTime,cloudTime)});
      }
    }

    const cloudState=cloud.app_state.length?cloud.app_state[0]:null;
    const localState={nextArchiveNumber:Number(nextArchiveNumber)};
    const cloudStateValue=cloudState?{nextArchiveNumber:Number(cloudState.next_archive_number)}:null;
    if (!conflictEqual(localState,cloudStateValue)) {
      const cloudTime=cloudState?latestIso([cloudState.updated_at,cloudState.created_at]):null;
      conflicts.push({kindLabel:"APP-ZUSTAND",title:"Nächste Archivnummer",changed:changedFields(localState,cloudStateValue||{}),localSummary:summary("app",localState),cloudSummary:summary("app",cloudStateValue),localTime:null,cloudTime,winner:winner(null,cloudTime)});
    }

    const matches=conflicts.length===0;
    supabaseCloudStartCheckState={
      status:matches?"ok":"warn",
      label:matches?"LOCAL ↔ CLOUD VOLLVERGLEICH OK ✅":`${conflicts.length} ABWEICHUNG${conflicts.length===1?"":"EN"} ERKANNT ⚠️`,
      detail:matches?`Datensatzvergleich sauber: ${localTaskMap.size} Tasks · ${localArchiveMap.size} Archiv · ${localWeightMap.size} Gewichtsphasen. Es wurde nichts geschrieben.`:"Die Konfliktzentrale zeigt jede gefundene Abweichung einzeln. Es wird NICHTS automatisch überschrieben.",
      checkedAt:new Date().toISOString(),counts,conflicts
    };
    render();
    return supabaseCloudStartCheckState;
  } catch (error) {
    supabaseCloudStartCheckState={status:"error",label:"STARTCHECK-FEHLER ❌",detail:error&&error.message?error.message:"Unbekannter Fehler.",checkedAt:new Date().toISOString(),counts:null,conflicts:null};
    render();
    return supabaseCloudStartCheckState;
  }
};

})();
