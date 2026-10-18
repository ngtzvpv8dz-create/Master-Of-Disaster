/* V45 · Lab-only full-set preview. Does not modify home screen or cloud favorites.
   Reuses #I11 TO-DO original, with 13 new transparent glass-3D icon test assets. */
(function(){
 'use strict';
 const items=[
  ['todo','TO-DO','./assets/dingsi-lab-icons/icon-i11-todo-3d-alpha.webp?v=45'],
  ['fitness','FITNESS','./assets/dingsi-lab-icons/i11-fullset-fitness.webp?v=45'],
  ['kistologie','KISTOLOGIE','./assets/dingsi-lab-icons/i11-fullset-kistologie.webp?v=45'],
  ['food','FOOD','./assets/dingsi-lab-icons/i11-fullset-food.webp?v=45'],
  ['einkauf','EINKAUF','./assets/dingsi-lab-icons/i11-fullset-einkauf.webp?v=45'],
  ['finanzen','FINANZEN','./assets/dingsi-lab-icons/i11-fullset-finanzen.webp?v=45'],
  ['kalender','KALENDER','./assets/dingsi-lab-icons/i11-fullset-kalender.webp?v=45'],
  ['progress','PROGRESS','./assets/dingsi-lab-icons/i11-fullset-progress.webp?v=45'],
  ['denkfabrik','DENKFABRIK','./assets/dingsi-lab-icons/i11-fullset-denkfabrik.webp?v=45'],
  ['outdoor','OUTDOOR','./assets/dingsi-lab-icons/i11-fullset-outdoor.webp?v=45'],
  ['wohnung','WOHNUNG','./assets/dingsi-lab-icons/i11-fullset-wohnung.webp?v=45'],
  ['werkstatt','WERKSTATT','./assets/dingsi-lab-icons/i11-fullset-werkstatt.webp?v=45'],
  ['reisen','REISEN','./assets/dingsi-lab-icons/i11-fullset-reisen.webp?v=45'],
  ['backstage','BACKSTAGE','./assets/dingsi-lab-icons/i11-fullset-backstage.webp?v=45']
 ];
 const button=document.getElementById('fullset-toggle-v45');
 const panel=document.getElementById('fullset-panel-v45');
 const grid=document.getElementById('fullset-grid-v45');
 const surface=document.getElementById('fullset-surface-v45');
 const preview=document.getElementById('preview');
 const detail=document.getElementById('fullset-detail-v45');
 const selected=document.getElementById('fullset-selected-v45');
 if(!button||!panel||!grid||!preview||!surface||!detail)return;
 let focused=null,built=false;
 const byId={};items.forEach(x=>{byId[x[0]]=x;});
 function syncSurface(){
  const theme=preview.dataset.surface;
  surface.dataset.surface=['dark','pastel','checker','photo'].includes(theme)?theme:'pastel';
  const image=preview.style.getPropertyValue('--photo-background');
  if(image)surface.style.setProperty('--photo-background',image);
 }
 function showDetail(id){
  const item=byId[id];if(!item)return;
  focused=id;
  detail.hidden=false;
  detail.replaceChildren();
  const img=document.createElement('img');img.src=item[2];img.alt='';
  const text=document.createElement('div');
  const heading=document.createElement('strong');heading.textContent=item[1];
  const note=document.createElement('span');note.textContent='#I11 · Glass 3D · freigestellter Test';
  text.appendChild(heading);text.appendChild(note);
  detail.appendChild(img);detail.appendChild(text);
  grid.querySelectorAll('[data-fullset-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fullsetId===id)));
 }
 function build(){
  if(built)return;
  built=true;
  items.forEach(([id,title,src])=>{
   const tile=document.createElement('button');
   tile.type='button';tile.className='fullset-card-v45';
   tile.dataset.fullsetId=id;tile.setAttribute('aria-pressed','false');
   tile.setAttribute('aria-label',title+' im ausgewählten Glas-3D-Stil ansehen');
   const img=document.createElement('img');img.src=src;img.alt='';img.loading='lazy';img.decoding='async';
   const label=document.createElement('strong');label.textContent=title;
   tile.appendChild(img);tile.appendChild(label);
   tile.addEventListener('click',()=>showDetail(id));
   grid.appendChild(tile);
  });
  syncSurface();
 }
 button.addEventListener('click',()=>{
  const opening=panel.hidden;
  panel.hidden=!opening;
  button.setAttribute('aria-expanded',String(opening));
  button.textContent=opening?'✨ Neue Icons im ausgewählten Stil schließen':'✨ Neue Icons im ausgewählten Stil (14)';
  if(opening){
   build();syncSurface();
   panel.scrollIntoView?.({behavior:'smooth',block:'nearest'});
  }
 });
 // All existing Lab theme / custom-photo switches drive the same full-set surface.
 new MutationObserver(()=>{if(!panel.hidden)syncSurface();}).observe(preview,{attributes:true,attributeFilter:['data-surface','style']});
 document.addEventListener('visibilitychange',()=>{if(!panel.hidden)syncSurface();});
 if(selected)selected.textContent='#I11 · Glass 3D · 14 Icons (Testserie)';
})();