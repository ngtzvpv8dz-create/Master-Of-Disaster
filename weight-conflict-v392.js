/* V392: Zusatzgewichts-Konflikte werden über stabile Startzeit-Identität statt Legacy-ID 0 zugeordnet. */
(function () {
  const previousRun = runSupabaseCloudStartCheck;

  function isoKey(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? new Date(ms).toISOString() : String(value);
  }

  function normalize(value) {
    if (value === undefined || value === null) return null;
    return value;
  }

  function weightValueLocal(phase) {
    return phase ? {
      weightKg: importPositiveNumberOrNull(phase.weightKg),
      startedAt: isoKey(phase.startedAt),
      endedAt: isoKey(phase.endedAt),
      phaseDate: phase.date || null
    } : null;
  }

  function weightValueCloud(row) {
    return row ? {
      weightKg: importPositiveNumberOrNull(row.weight_kg),
      startedAt: isoKey(row.started_at),
      endedAt: isoKey(row.ended_at),
      phaseDate: row.phase_date || null
    } : null;
  }

  function sameWeightValue(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function changedWeightFields(a, b) {
    const labels = { weightKg:"Gewicht", startedAt:"Startzeit", endedAt:"Endzeit", phaseDate:"Gewichtsdatum" };
    const keys = ["weightKg","startedAt","endedAt","phaseDate"];
    return keys.filter(k => normalize(a && a[k]) !== normalize(b && b[k])).map(k => labels[k]);
  }

  function latestIso(values) {
    let best = null, bestMs = -1;
    for (const value of values) {
      if (!value) continue;
      const ms = new Date(value).getTime();
      if (Number.isFinite(ms) && ms > bestMs) { bestMs = ms; best = new Date(ms).toISOString(); }
    }
    return best;
  }

  function winner(localTime, cloudTime) {
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

  function summary(value) {
    if (!value) return "NICHT VORHANDEN";
    const start = value.startedAt ? formatSupabaseSyncTimestamp(value.startedAt) : "Start unklar";
    const end = value.endedAt ? " → " + formatSupabaseSyncTimestamp(value.endedAt) : " · läuft";
    return `${value.weightKg || "?"} kg · ${start}${end}`;
  }

  function titleFor(key, localValue, cloudValue) {
    const value = localValue || cloudValue;
    const when = value && value.startedAt ? formatSupabaseSyncTimestamp(value.startedAt) : key;
    return `Gewichtsphase · ${when}`;
  }

  async function rebuildWeightConflicts() {
    if (!supabaseCloudStartCheckState || !Array.isArray(supabaseCloudStartCheckState.conflicts)) return;
    const client = getSupabaseClient();
    if (!client) return;
    const { data:sessionData, error:sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData || !sessionData.session || !sessionData.session.user) return;
    const userId = sessionData.session.user.id;
    const { data:rows, error } = await client.from("weight_phases").select("*").eq("user_id", userId);
    if (error) throw error;

    const localRows = Array.isArray(weightPhases) ? weightPhases.filter(p => p && p.startedAt) : [];
    const cloudRows = Array.isArray(rows) ? rows.filter(r => r && r.started_at) : [];
    const localMap = new Map();
    const cloudMap = new Map();
    localRows.forEach(p => localMap.set(isoKey(p.startedAt), p));
    cloudRows.forEach(r => cloudMap.set(isoKey(r.started_at), r));

    const conflicts = supabaseCloudStartCheckState.conflicts.filter(item => item.kindLabel !== "ZUSATZGEWICHT");
    const keys = [...new Set([...localMap.keys(), ...cloudMap.keys()])].filter(Boolean).sort();

    for (const key of keys) {
      const local = localMap.get(key) || null;
      const row = cloudMap.get(key) || null;
      const localValue = weightValueLocal(local);
      const cloudValue = weightValueCloud(row);
      if (sameWeightValue(localValue, cloudValue)) continue;
      const localTime = local ? latestIso([local.updatedAt, local.endedAt, local.startedAt]) : null;
      const cloudTime = row ? latestIso([row.updated_at, row.ended_at, row.started_at, row.created_at]) : null;
      conflicts.push({
        kindLabel:"ZUSATZGEWICHT",
        title:titleFor(key, localValue, cloudValue),
        changed:changedWeightFields(localValue, cloudValue),
        localSummary:summary(localValue),
        cloudSummary:summary(cloudValue),
        localTime,
        cloudTime,
        winner:winner(localTime, cloudTime),
        weightIdentity:{
          startedAt:key,
          localLegacyId: local && Number.isInteger(Number(local.id)) ? Number(local.id) : null,
          cloudLegacyId: row && Number.isInteger(Number(row.legacy_phase_id)) ? Number(row.legacy_phase_id) : null
        }
      });
    }

    supabaseCloudStartCheckState.conflicts = conflicts;
    const count = conflicts.length;
    if (count === 0) {
      supabaseCloudStartCheckState.status = "ok";
      supabaseCloudStartCheckState.label = "LOCAL ↔ CLOUD INHALTSVERGLEICH OK ✅";
      supabaseCloudStartCheckState.detail = "Keine echten Inhaltsabweichungen gefunden. Zusatzgewichtsphasen wurden anhand ihrer Startzeit stabil zugeordnet. Es wurde nichts automatisch überschrieben.";
    } else {
      supabaseCloudStartCheckState.status = "warn";
      supabaseCloudStartCheckState.label = `${count} ECHTE ABWEICHUNG${count===1?"":"EN"} ERKANNT ⚠️`;
      supabaseCloudStartCheckState.detail = `${count} inhaltliche Abweichung${count===1?"":"en"}. Zusatzgewichtsphasen werden nicht mehr über eine mehrdeutige Legacy-ID 0 gekoppelt. Es wird nichts automatisch überschrieben.`;
    }
  }

  runSupabaseCloudStartCheck = async function (manual=true) {
    const result = await previousRun(manual);
    try {
      await rebuildWeightConflicts();
      render();
    } catch (error) {
      console.error("V392 Gewichtskonflikt-Abgleich fehlgeschlagen:", error);
    }
    return supabaseCloudStartCheckState || result;
  };
})();
