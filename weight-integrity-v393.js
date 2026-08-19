/* V393: canonical repair for the reconstructed 12.3 kg phases on 09.08.2026.
   The conflict restore exposed two historical representations that can overlap.
   Keep the documented split phases only: 07:29–08:00 and 08:12–12:40 Europe/Berlin. */
(function () {
  if (!Array.isArray(window.weightPhases) && typeof weightPhases === "undefined") return;
  const phases = typeof weightPhases !== "undefined" ? weightPhases : window.weightPhases;
  if (!Array.isArray(phases)) return;

  const isTargetDay = phase => {
    if (!phase || Number(phase.weightKg) !== 12.3 || !phase.startedAt) return false;
    const d = new Date(phase.startedAt);
    if (!Number.isFinite(d.getTime())) return false;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(d);
    return parts === "2026-08-09";
  };

  const berlinIso = (hour, minute) => `2026-08-09T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00+02:00`;
  const canonical = [
    { weightKg: 12.3, startedAt: berlinIso(7,29), endedAt: berlinIso(8,0), date: "2026-08-09", source: "historical-reconstruction" },
    { weightKg: 12.3, startedAt: berlinIso(8,12), endedAt: berlinIso(12,40), date: "2026-08-09", source: "historical-reconstruction" }
  ];

  const target = phases.filter(isTargetDay);
  if (!target.length) return;

  const other = phases.filter(phase => !isTargetDay(phase));
  const usedIds = new Set(other.map(p => Number(p && p.id)).filter(Number.isInteger));
  let nextId = 1;
  const allocateId = () => { while (usedIds.has(nextId)) nextId += 1; usedIds.add(nextId); return nextId++; };

  canonical.forEach(item => {
    const existing = target.find(p => p && p.startedAt && Math.abs(new Date(p.startedAt).getTime() - new Date(item.startedAt).getTime()) < 60000);
    item.id = existing && Number.isInteger(Number(existing.id)) && !usedIds.has(Number(existing.id)) ? Number(existing.id) : allocateId();
    usedIds.add(item.id);
  });

  const repaired = other.concat(canonical).sort((a,b) => new Date(a.startedAt || 0) - new Date(b.startedAt || 0));
  phases.splice(0, phases.length, ...repaired);
  try { localStorage.setItem("masterOfDisasterWeightPhases", JSON.stringify(phases)); } catch (_) {}
})();
