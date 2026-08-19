/* V392: Sichere Konfliktauflösung pro Datensatz.
   Zusatzgewichtsphasen werden über ihre stabile Startzeit identifiziert, nicht über mehrdeutige Legacy-ID 0. */
(function () {
  function isoKey(value) {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? new Date(ms).toISOString() : String(value);
  }

  function weightIdentity(item) {
    const identity = item && item.weightIdentity;
    const startedAt = identity && identity.startedAt ? isoKey(identity.startedAt) : null;
    return { startedAt };
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

  function localWeightPhaseByStart(startedAt) {
    const key = isoKey(startedAt);
    return (Array.isArray(weightPhases) ? weightPhases : []).find(p => isoKey(p && p.startedAt) === key) || null;
  }

  function nextFreeWeightId() {
    const used = new Set((Array.isArray(weightPhases) ? weightPhases : [])
      .map(p => Number(p && p.id))
      .filter(Number.isInteger));
    let next = used.size ? Math.max(...used) + 1 : 1;
    while (used.has(next)) next += 1;
    return next;
  }

  async function findCloudWeightRow(client, userId, startedAt) {
    const key = isoKey(startedAt);
    if (!key) return null;
    const { data, error } = await client.from("weight_phases")
      .select("*")
      .eq("user_id", userId)
      .eq("started_at", key)
      .limit(1);
    if (error) throw error;
    return Array.isArray(data) ? data[0] || null : null;
  }

  async function deleteCloudWeightRow(client, userId, startedAt) {
    const key = isoKey(startedAt);
    if (!key) throw new Error("Startzeit der Gewichtsphase fehlt.");
    const result = await client.from("weight_phases")
      .delete()
      .eq("user_id", userId)
      .eq("started_at", key);
    if (result.error) throw result.error;
  }

  async function takeCloudWeight(item) {
    const identity = weightIdentity(item);
    if (!identity.startedAt) throw new Error("Gewichtsphase konnte nicht eindeutig über die Startzeit bestimmt werden.");
    const { client, userId } = await getSessionContext();
    const row = await findCloudWeightRow(client, userId, identity.startedAt);
    if (!row) throw new Error("Cloud-Gewichtsphase ist nicht mehr vorhanden. Bitte neu vergleichen.");

    const raw = row.metadata && row.metadata.raw && typeof row.metadata.raw === "object"
      ? JSON.parse(JSON.stringify(row.metadata.raw))
      : {};

    const existing = localWeightPhaseByStart(identity.startedAt);
    const existingId = existing && Number.isInteger(Number(existing.id)) ? Number(existing.id) : null;
    const rawId = Number.isInteger(Number(raw.id)) ? Number(raw.id) : null;
    const usedIds = new Set((Array.isArray(weightPhases) ? weightPhases : [])
      .filter(p => p !== existing)
      .map(p => Number(p && p.id))
      .filter(Number.isInteger));
    let restoredId = existingId !== null ? existingId : rawId;
    if (!Number.isInteger(restoredId) || usedIds.has(restoredId)) restoredId = nextFreeWeightId();

    const restored = {
      ...raw,
      id: restoredId,
      weightKg: importPositiveNumberOrNull(raw.weightKg != null ? raw.weightKg : row.weight_kg),
      startedAt: isoKey(raw.startedAt || row.started_at),
      endedAt: isoKey(raw.endedAt || row.ended_at),
      date: raw.date || row.phase_date || (row.started_at ? getBerlinDateKey(new Date(row.started_at)) : getBerlinDateKey()),
      source: raw.source || row.source || "cloud-conflict-restore"
    };

    const phases = Array.isArray(weightPhases) ? weightPhases.slice() : [];
    const existingIndex = phases.findIndex(p => isoKey(p && p.startedAt) === identity.startedAt);
    if (existingIndex >= 0) phases[existingIndex] = restored;
    else phases.push(restored);
    phases.sort((a,b) => String(a && a.startedAt || "").localeCompare(String(b && b.startedAt || "")));
    weightPhases = phases;
    saveWeight();
  }

  async function takeLocalWeight(item) {
    const identity = weightIdentity(item);
    if (!identity.startedAt) throw new Error("Gewichtsphase konnte nicht eindeutig über die Startzeit bestimmt werden.");
    const local = localWeightPhaseByStart(identity.startedAt);
    const { client, userId } = await getSessionContext();

    await deleteCloudWeightRow(client, userId, identity.startedAt);

    if (local) {
      const row = {
        user_id: userId,
        legacy_phase_id: Number.isInteger(Number(local.id)) ? Number(local.id) : null,
        weight_kg: importPositiveNumberOrNull(local.weightKg),
        started_at: isoKey(local.startedAt),
        ended_at: isoKey(local.endedAt),
        phase_date: local.date || (local.startedAt ? getBerlinDateKey(new Date(local.startedAt)) : getBerlinDateKey()),
        source: local.source ? String(local.source) : "conflict-local-wins",
        metadata: { raw: local, conflictResolution: "local", identity: "started_at" }
      };
      const result = await client.from("weight_phases").insert([row]);
      if (result.error) throw result.error;
    }
  }

  async function resolveConflict(index, side) {
    const conflicts = Array.isArray(supabaseCloudStartCheckState && supabaseCloudStartCheckState.conflicts)
      ? supabaseCloudStartCheckState.conflicts : [];
    const item = conflicts[index];
    if (!item) return;
    if (item.kindLabel !== "ZUSATZGEWICHT" || !(item.weightIdentity && item.weightIdentity.startedAt)) {
      showInfoModal("Noch gesperrt", "Dieser Konflikttyp ist noch absichtlich read-only. Eindeutig identifizierte Zusatzgewichts-Konflikte sind in V392 auflösbar.");
      return;
    }

    const source = side === "cloud" ? "CLOUD" : "LOKAL";
    const other = side === "cloud" ? "lokalen" : "Cloud-";
    const ok = window.confirm(`${source} für „${item.title}“ übernehmen?\n\nDer ${other}Stand genau dieser Gewichtsphase wird ersetzt. Die Zuordnung erfolgt über die Startzeit. Danach wird automatisch neu verglichen.`);
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
      const supported = item.kindLabel === "ZUSATZGEWICHT" && Boolean(item.weightIdentity && item.weightIdentity.startedAt);
      buttons[0].disabled = !supported;
      buttons[1].disabled = !supported;
      buttons[0].title = supported ? "Diesen einzelnen Konflikt mit dem lokalen Stand auflösen" : "Dieser Konflikttyp bleibt vorerst read-only";
      buttons[1].title = supported ? "Diesen einzelnen Konflikt mit dem Cloud-Stand auflösen" : "Dieser Konflikttyp bleibt vorerst read-only";
      if (supported) {
        buttons[0].onclick = () => resolveConflict(index, "local");
        buttons[1].onclick = () => resolveConflict(index, "cloud");
        const note = card.querySelector(".cloud-conflict-readonly");
        if (note) note.textContent = "V392 · EINZELKONFLIKT AKTIV · STABILE STARTZEIT-ID · MIT SICHERHEITSABFRAGE";
      }
    });
  }

  const observer = new MutationObserver(() => setTimeout(wireConflictButtons, 0));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", () => setTimeout(wireConflictButtons, 0));
})();
