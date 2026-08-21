/* V462 · THEME UI GUARD
   Reine Sichtbarkeitsschicht ohne Observer: alte grosse V458-Vorschau und
   saemtliche Notiz-Bedienelemente bleiben auch nach spaeteren Re-Renders
   unsichtbar. Alt-Daten werden weiterhin nicht geloescht.
*/
(function(){
  'use strict';
  const BUILD_VERSION='V462';
  function install(){
    let style=document.getElementById('themeUiGuardV462Style');
    if(style)return style;
    style=document.createElement('style');
    style.id='themeUiGuardV462Style';
    style.textContent=`
      /* Die alte scrollende Live-Vorschau bleibt nur als unsichtbare Quelle
         fuer die feste V460-Vorschau im DOM. */
      .theme-panel-v458:has(.theme-preview-v458){display:none!important}

      /* Notizen sind als Funktion verworfen. Historische Daten bleiben erhalten,
         aber kein Notiz-Editor, keine Notiz und kein Theme-Regler ist sichtbar. */
      .task-note-v456,
      .task-note-editor-v456,
      .theme-note-preview-v459,
      .theme-role-v458[data-theme-role-select="note"]{display:none!important}

      .theme-field-v458:has([data-theme-setting="card.noteLines"]),
      .theme-field-v458:has([data-theme-setting^="palette.note"]),
      .theme-field-v458:has([data-theme-setting^="elements.note"]){display:none!important}
    `;
    document.head.appendChild(style);
    return style;
  }
  install();
  window.__modThemeUiGuardV462={version:BUILD_VERSION,install,notesVisible:false,legacyPreviewVisible:false};
})();
