/* V390: Sichere Konfliktauflösung pro Datensatz.
   Phase 1: Zusatzgewichts-Konflikte sind scharf. Andere Konflikttypen bleiben bewusst gesperrt. */
(function () {
  function conflictPhaseId(item) {
    const match = String(item && item.title || "").match(/Gewichtsphase\s+(-?\d+)/i);
    return match ? Number(match[1]) : null;
  }

  async function getSessionContext() {
    const client = getSupabaseClient();
    if (!client) throw new Error("Kein Supabase-Client verfügbar.");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data && data.session && data.session.user;
    if (!user) throw new Error("Nicht bei Supabase angemeldet.");
    return { client, userId: user.id };
  }

  function localWeightPhaseById(id) {
    return (Array.isArray(weightPhases) ? weightPhases : []).find(p => Number(p && p.id) === Number(id)) || null;
  }

  async function takeCloudWeight(item) {
    const phaseId = conflictPhaseId(item);
    if (!Number.isInteger(phaseId)) throw new Error("Gewichtsphase konnte nicht bestimmt werden.");
    const { client, userId } = await getSessionContext();
    const { data, error } = await client.from("weight_phases")
      .select("*")
      .eq("user_id", userId)
      .eq("legacy_phase_id", phaseId)
      .limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) throw new Error("Cloud-Gewichtsphase ist nicht mehr vorhanden. Bitte neu vergleichen.");

    const raw = row.metadata && row.metadata.raw && typeof row.metadata.raw === "object"
      ? JSON.parse(JSON.stringify(row.metadata.raw))
      : null;
    const restored = raw || {
      id: phaseId,
      weightKg: importPositiveNumberOrNull(row.weight_kg),
      startedAt: row.started_at || null,
      endedAt: row.ended_at || null,
      date: row.phase_date || (row.started_at ? getBerlinDateKey(new Date(row.started_at)) : getBerlinDateKey()),
      source: "cloud-conflict-restore"
    };
    restored.id = phaseId;
    restored.weightKg = importPositiveNumberOrNull(restored.weightKg != null ? restored.weightKg : row.weight_kg);
    restored.startedAt = restored.startedAt || row.started_at || null;
    restored.endedAt = restored.endedAt || row.ended_at || null;
    restored.date = restored.date || row.phase_date || (restored.startedAt ? getBerlinDateKey(new Date(restored.startedAt)) : getBerlinDateKey());

    const phases = Array.isArray(weightPhases) ? weightPhases.slice() : [];
    const existingIndex = phases.findIndex(p => Number(p && p.id) === phaseId);
    if (existingIndex >= 0) phases[existingIndex] = restored;
    else phases.push(restored);
    phases.sort((a,b) => Number(a && a.id || 0) - Number(b && b.id || 0));
    weightPhases = phases;
    saveWeight();
  }

  async function takeLocalWeight(item) {
    const phaseId = conflictPhaseId(item);
    if (!Number.isInteger(phaseId)) throw new Error("Gewichtsphase konnte nicht bestimmt werden.");
    const local = localWeightPhaseById(phaseId);
    const { client, userId } = await getSessionContext();

    let result = await client.from("weight_phases")
      .delete()
      .eq("user_id", userId)
      .eq("legacy_phase_id", phaseId);
    if (result.error) throw result.error;

    if (local) {
      const row = {
        user_id: userId,
        legacy_phase_id: phaseId,
        weight_kg: importPositiveNumberOrNull(local.weightKg),
        started_at: local.startedAt || null,
        ended_at: local.endedAt || null,
        phase_date: local.date || (local.startedAt ? getBerlinDateKey(new Date(local.startedAt)) : getBerlinDateKey()),
        source: local.source ? String(local.source) : "conflict-local-wins",
        metadata: { raw: local, conflictResolution: "local" }
      };
      result = await client.from("weight_phases").insert([row]);
      if (result.error) throw result.error;
    }
  }

  async function resolveConflict(index, side) {
    const conflicts = Array.isArray(supabaseCloudStartCheckState && supabaseCloudStartCheckState.conflicts)
      ? supabaseCloudStartCheckState.conflicts : [];
    const item = conflicts[index];
    if (!item) return;
    if (item.kindLabel !== "ZUSATZGEWICHT") {
      showInfoModal("Noch gesperrt", "Dieser Konflikttyp ist noch absichtlich read-only. Zusatzgewichts-Konflikte sind in V390 bereits sicher auflösbar.");
      return;
    }

    const source = side === "cloud" ? "CLOUD" : "LOKAL";
    const other = side === "cloud" ? "lokalen" : "Cloud-";
    const ok = window.confirm(`${source} für „${item.title}“ übernehmen?\n\nDer ${other}Stand dieses einzelnen Konflikts wird dadurch ersetzt. Danach wird automatisch neu verglichen.`);
    if (!ok) return;

    try {
      if (side === "cloud") await takeCloudWeight(item);
      else await takeLocalWeight(item);
      await runSupabaseCloudStartCheck(true);
      showInfoModal("Konflikt aufgelöst ✅", `${source} wurde für „${item.title}“ übernommen. Der LOCAL ↔ CLOUD Vergleich wurde anschließend neu ausgeführt.`);
    } catch (error) {
      console.error("Konfliktauflösung fehlgeschlagen:", error);
      showInfoModal("Konfliktauflösung fehlgeschlagen", error && error.message ? error.message : String(error));
    }
  }

  function wireConflictButtons() {
    const center = document.getElementById("cloudConflictCenter");
    const conflicts = Array.isArray(supabaseCloudStartCheckState && supabaseCloudStartCheckState.conflicts)
      ? supabaseCloudStartCheckState.conflicts : [];
    if (!center || !conflicts.length) return;
    const cards = Array.from(center.querySelectorAll(".cloud-conflict-item"));
    cards.forEach((card, index) => {
      const item = conflicts[index];
      if (!item) return;
      const buttons = card.querySelectorAll(".cloud-conflict-choice");
      if (buttons.length < 2) return;
      const supported = item.kindLabel === "ZUSATZGEWICHT";
      buttons[0].disabled = !supported;
      buttons[1].disabled = !supported;
      buttons[0].title = supported ? "Diesen einzelnen Konflikt mit dem lokalen Stand auflösen" : "Dieser Konflikttyp bleibt vorerst read-only";
      buttons[1].title = supported ? "Diesen einzelnen Konflikt mit dem Cloud-Stand auflösen" : "Dieser Konflikttyp bleibt vorerst read-only";
      if (supported) {
        buttons[0].onclick = () => resolveConflict(index, "local");
        buttons[1].onclick = () => resolveConflict(index, "cloud");
        const note = card.querySelector(".cloud-conflict-readonly");
        if (note) note.textContent = "V390 · EINZELKONFLIKT AKTIV · MIT SICHERHEITSABFRAGE";
      }
    });
  }

  const observer = new MutationObserver(() => setTimeout(wireConflictButtons, 0));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", () => setTimeout(wireConflictButtons, 0));
})();
