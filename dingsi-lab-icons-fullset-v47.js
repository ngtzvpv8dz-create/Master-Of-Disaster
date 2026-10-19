/* Dingsi Lab v47 · Two complete, swappable, alpha-transparent icon series.
   NEW: the actual 14 final standalone pastell-comic / used 3D illustrations, FOOD variant 4.
   BEFORE: the unchanged approved-v46 series. Both are Lab previews only.
   Both asset sets can later be used directly on the productive home screen. */
(function(){
 'use strict';
 const motifs=[
  ['todo','TO-DO'],['fitness','FITNESS'],['kistologie','KISTOLOGIE'],
  ['food','FOOD'],['einkauf','EINKAUF'],['finanzen','FINANZEN'],
  ['kalender','KALENDER'],['progress','PROGRESS'],['denkfabrik','DENKFABRIK'],
  ['outdoor','OUTDOOR'],['wohnung','WOHNUNG'],['werkstatt','WERKSTATT'],
  ['reisen','REISEN'],['backstage','BACKSTAGE']
 ];
 const sets={
  new:{label:'NEU · Pastell-Comic 3D / Used',version:'v47',
   prefix:'./assets/dingsi-lab-icons/pastel-used-v47-',suffix:'.webp?v=47'},
  previous:{label:'BISHER · 3D-Originale',version:'v46',
   prefix:'./assets/dingsi-lab-icons/approved-v46-',suffix:'.webp?v=46'}
 };
 const toggle=document.getElementById('fullset-toggle-v45');
 const panel=document.getElementById('fullset-panel-v45');
 const grid=document.getElementById('fullset-grid-v45');
 const surface=document.getElementById('fullset-surface-v45');
 const preview=document.getElementById('preview');
 const detail=document.getElementById('fullset-detail-v45');
 const summary=document.getElementById('fullset-selected-v45');
 const styleControls=Array.from(document.querySelectorAll('[data-fullset-style-v47]'));
 if(!toggle||!panel||!grid||!surface||!preview||!detail)return;
 let active='new',focused=null,built=false;
 const byId=Object.fromEntries(motifs);
 const imageUrl=id=>sets[active].prefix+id+sets[active].suffix;
 function syncSurface(){
  const bg=preview.dataset.surface;
  surface.dataset.surface=['dark','pastel','checker','photo'].includes(bg)?bg:'pastel';
  const image=preview.style.getPropertyValue('--photo-background');
  if(image)surface.style.setProperty('--photo-background',image);
 }
 function refreshHeading(){
  if(summary)summary.textContent=sets[active].label+' · 14 Einzelicons · transparent · '+(active==='new'?'FOOD Variante 4':'Archivserie');
  for(const b of styleControls)b.setAttribute('aria-pressed',String(b.dataset.fullsetStyleV47===active));
 }
 function showDetail(id){
  if(!byId[id])return;
  focused=id;
  detail.hidden=false;
  detail.replaceChildren();
  const img=document.createElement('img');
  img.src=imageUrl(id);img.alt=byId[id]+' transparentes 3D-Icon';
  const body=document.createElement('div');
  const heading=document.createElement('strong');
  heading.textContent=byId[id];
  const note=document.createElement('span');
  note.textContent=active==='new'?'Pastell-Comic 3D / Used · freigestellt · Originaldatei':'Bisherige 3D-Serie · freigestellt';
  body.appendChild(heading);body.appendChild(note);
  detail.appendChild(img);detail.appendChild(body);
  grid.querySelectorAll('[data-fullset-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fullsetId===id)));
 }
 function build(){
  if(built)return;
  built=true;
  for(const [id,title] of motifs){
   const tile=document.createElement('button');
   tile.type='button';tile.className='fullset-card-v45';
   tile.dataset.fullsetId=id;tile.setAttribute('aria-pressed','false');
   tile.setAttribute('aria-label',title+' als freigestelltes 3D-Icon ansehen');
   const image=document.createElement('img');
   image.src=imageUrl(id);image.alt='';image.loading='lazy';image.decoding='async';
   const label=document.createElement('strong');label.textContent=title;
   tile.appendChild(image);tile.appendChild(label);
   tile.addEventListener('click',()=>showDetail(id));
   grid.appendChild(tile);
  }
  syncSurface();
 }
 function setStyle(next){
  if(!Object.prototype.hasOwnProperty.call(sets,next))return;
  active=next;
  refreshHeading();
  if(built){
   grid.querySelectorAll('[data-fullset-id]').forEach(tile=>{
    const image=tile.querySelector('img');
    if(image)image.src=imageUrl(tile.dataset.fullsetId);
   });
   if(focused)showDetail(focused);
  }
 }
 for(const b of styleControls)b.addEventListener('click',()=>setStyle(b.dataset.fullsetStyleV47));
 toggle.addEventListener('click',()=>{
  const open=panel.hidden;
  panel.hidden=!open;
  toggle.setAttribute('aria-expanded',String(open));
  toggle.textContent=open?'✨ Icon-Serienvergleich schließen':'✨ Neue Icons im ausgewählten Stil (14)';
  if(open){
   build();refreshHeading();syncSurface();
   panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  }
 });
 new MutationObserver(()=>{if(!panel.hidden)syncSurface();}).observe(preview,{attributes:true,attributeFilter:['data-surface','style']});
 document.addEventListener('visibilitychange',()=>{if(!panel.hidden)syncSurface();});
 refreshHeading();
})();