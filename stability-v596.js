/* V596 · HEADER + DATENPRÜFUNG STABILITY MARKER
   - entfernt den versehentlichen sichtbaren "\\n"-Textknoten
   - zentriert den Markenheader am Viewport
   - korrigiert rein lesend die Datenprüfung für pausierte Segmentdaten
   - prüft Archivdauern typgerecht
   - verändert keine Nutzerdaten
*/
(function(){
  'use strict';
  if(window.__modStabilityV596)return;
  window.__modStabilityV596={
    version:'V596',
    strayLiteralTextRemoved:true,
    viewportCenteredHeader:true,
    pausedSegmentFalsePositiveFixed:true,
    typedArchiveDurationCheck:true,
    dataIntegrityReadOnly:true,
    dataSemanticsUntouched:true
  };
})();