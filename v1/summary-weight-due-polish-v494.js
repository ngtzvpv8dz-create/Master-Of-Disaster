/* V494 · ZEITBLOCK / ZUSATZGEWICHT / FÄLLIGKEIT FEINSCHLIFF */
(function(){
  'use strict';

  const BUILD_VERSION='V494';
  let observer=null;
  let queued=false;

  function inputRow(labelText){
    const wanted=String(labelText||'').trim().toUpperCase();
    return [...document.querySelectorAll('#inputPanel .option-row')].find(row=>
      String(row.querySelector(':scope > .option-label')?.textContent||'').trim().toUpperCase()===wanted
    )||null;
  }

  function alignDueControls(){
    const row=inputRow('FÄLLIG');
    if(!row)return false;
    const label=row.querySelector(':scope > .option-label');
    if(!label)return false;

    let controls=row.querySelector(':scope > .v493-option-buttons');
    if(!controls){
      controls=document.createElement('div');
      controls.className='v493-option-buttons';
      row.appendChild(controls);
    }
    controls.classList.add('v494-due-controls');

    [...row.children].forEach(child=>{
      if(child===label||child===controls)return;
      controls.appendChild(child);
    });

    row.dataset.v494DueAligned='true';
    return true;
  }

  function parseSummaryRow(row){
    if(!row)return false;
    if(row.querySelector(':scope > .v494-time-label')&&row.querySelector(':scope > .v494-time-value'))return true;
    const raw=String(row.textContent||'').trim().replace(/\s+/g,' ');
    const match=raw.match(/^(SEIT APP AKTIV|\+ VOR APP AKTIV|= GESAMT AKTIV)\s*·\s*(.+)$/i);
    if(!match)return false;

    row.textContent='';
    row.classList.add('v494-time-row');
    if(/^=/.test(match[1]))row.classList.add('v494-total-row');
    else row.classList.add('v494-source-row');

    const label=document.createElement('span');
    label.className='v494-time-label';
    label.textContent=`${match[1].toUpperCase()} ·`;
    const value=document.createElement('span');
    value.className='v494-time-value';
    value.textContent=match[2];
    row.append(label,value);
    return true;
  }

  function polishSummary(summary){
    if(!summary)return false;
    summary.querySelectorAll(':scope > .v488-main,:scope > .v488-sub').forEach(parseSummaryRow);
    summary.dataset.v494TimeGrid='true';
    return true;
  }

  function reorderPartialWeight(line){
    if(!line||line.dataset.v494PartialReordered==='true')return false;
    const sub=line.nextElementSibling;
    if(!sub||!sub.classList.contains('v490-weight-subline'))return false;

    const first=String(line.textContent||'').trim().replace(/\s+/g,' ');
    const second=String(sub.textContent||'').trim().replace(/\s+/g,' ');
    const body=first.replace(/^↳\s*🏋️\s*/u,'').trim();
    const marker='INKL. ZUSATZGEWICHT';
    if(!body.toUpperCase().startsWith(marker))return false;
    const range=body.slice(marker.length).replace(/^\s*·\s*/,'').trim();
    const parts=second.split(/\s*·\s*/).filter(Boolean);
    if(!range||parts.length<2)return false;
    const duration=parts[0];
    const kg=parts.slice(1).join(' · ');
    if(!/\bkg\b/i.test(kg))return false;

    line.textContent='';
    const prefix=document.createElement('span');
    prefix.className='v492-weight-prefix';
    prefix.textContent='↳ 🏋️';
    const copy=document.createElement('span');
    copy.className='v492-weight-copy';
    copy.textContent=`${marker} · ${kg}`;
    line.append(prefix,copy);
    line.dataset.v492Aligned='true';
    line.dataset.v494PartialReordered='true';

    sub.textContent=`${range} · ${duration}`;
    sub.classList.add('v492-weight-subline-aligned');
    sub.dataset.v494RangeDuration='true';
    return true;
  }

  function polishCard(card){
    if(!card)return false;
    card.querySelectorAll('.historical-segment-duration-v488').forEach(polishSummary);
    card.querySelectorAll('.v490-weight-partial').forEach(reorderPartialWeight);
    return true;
  }

  function injectStyle(){
    if(document.getElementById('summaryWeightDuePolishV494Style'))return;
    const style=document.createElement('style');
    style.id='summaryWeightDuePolishV494Style';
    style.textContent=`
      /* FÄLLIG: auch dynamisches Datumsfeld + Löschbutton bleiben in Spalte 2. */
      #inputPanel .option-row[data-v494-due-aligned="true"]>.v494-due-controls{
        min-width:0!important;
        width:100%!important;
        display:flex!important;
        flex-wrap:wrap!important;
        align-items:center!important;
        gap:5px!important;
      }
      #inputPanel .option-row[data-v494-due-aligned="true"]>.v494-due-controls>input,
      #inputPanel .option-row[data-v494-due-aligned="true"]>.v494-due-controls>select,
      #inputPanel .option-row[data-v494-due-aligned="true"]>.v494-due-controls>.due-date-input,
      #inputPanel .option-row[data-v494-due-aligned="true"]>.v494-due-controls>.due-input{
        max-width:100%!important;
      }

      /* Zweiter Karten-Trenner: Typ/Kategorie oben, Aktivzeitblock unten. */
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"]{
        width:100%!important;
        margin-top:6px!important;
        padding-top:5px!important;
        border-top:1px solid rgba(126,139,145,.22)!important;
        display:grid!important;
        grid-template-columns:max-content minmax(0,1fr)!important;
        column-gap:8px!important;
        row-gap:3px!important;
        align-items:baseline!important;
        font-variant-numeric:tabular-nums!important;
      }
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"]>.v494-time-row{
        display:contents!important;
      }
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"] .v494-time-label,
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"] .v494-time-value{
        font-size:8.5px!important;
        line-height:1.15!important;
        font-variant-numeric:tabular-nums!important;
      }
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"] .v494-source-row>.v494-time-label,
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"] .v494-source-row>.v494-time-value{
        font-weight:650!important;
        color:#8f9aa1!important;
        opacity:.84!important;
      }
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"] .v494-total-row>.v494-time-label,
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"] .v494-total-row>.v494-time-value{
        font-weight:900!important;
        color:#d9e0e4!important;
        opacity:1!important;
      }
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"]>.v490-overall-weight,
      #viewContainer .historical-segment-duration-v488[data-v494-time-grid="true"]>.v491-overall-weight{
        grid-column:1/-1!important;
      }

      /* Teilgewicht: Zeile 1 = Gewicht, Zeile 2 = Uhrzeit + Dauer. */
      #viewContainer .v490-weight-subline[data-v494-range-duration="true"]{
        font-variant-numeric:tabular-nums!important;
      }

      /* Auch im Segmenteditor ist GESAMT die klare Ergebniszeile. */
      .segment-total-v443.v488-breakdown .v488-total{
        color:#d9e0e4!important;
        font-weight:900!important;
      }
      .segment-total-v443.v488-breakdown>span:not(.v488-total):not(.v488-pause){
        font-weight:650!important;
        opacity:.8!important;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceAll(){
    queued=false;
    injectStyle();
    alignDueControls();
    document.querySelectorAll('#viewContainer .task,#viewContainer .archive-task').forEach(polishCard);
    return true;
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(enhanceAll);
  }

  function observe(){
    if(observer)return;
    const roots=[document.getElementById('inputPanel'),document.getElementById('viewContainer')].filter(Boolean);
    if(!roots.length)return;
    observer=new MutationObserver(queue);
    roots.forEach(root=>observer.observe(root,{childList:true,subtree:true}));
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){
      const result=previousRender.apply(this,arguments);
      enhanceAll();
      setTimeout(enhanceAll,0);
      return result;
    };
  }

  injectStyle();
  alignDueControls();
  observe();
  setTimeout(enhanceAll,0);
  window.addEventListener('load',()=>setTimeout(()=>{observe();enhanceAll();},0));

  window.__modSummaryWeightDuePolishV494={
    version:BUILD_VERSION,
    enhanceAll,
    alignDueControls,
    polishSummary,
    reorderPartialWeight,
    dueDynamicControlsIndented:true,
    totalActiveHighlighted:true,
    activeTimeValuesColumnAligned:true,
    summarySeparatorMatchesSegmentSeparator:true,
    partialWeightFirstLineShowsKg:true,
    partialWeightSecondLineShowsRangeAndDuration:true,
    dataSemanticsUntouched:true
  };
})();
