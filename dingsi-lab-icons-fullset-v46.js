/* V46 · Lab-only full-set preview featuring actual individual approved artwork. Does not modify home screen or cloud favorites.
   Displays exactly the 14 individual 3D files approved in the conversation, including revised calendar and Denkfabrik. */
(function(){
 'use strict';
 const items=[
  ['todo','TO-DO','./assets/dingsi-lab-icons/approved-v46-todo.webp?v=46'],
  ['fitness','FITNESS','./assets/dingsi-lab-icons/approved-v46-fitness.webp?v=46'],
  ['kistologie','KISTOLOGIE','./assets/dingsi-lab-icons/approved-v46-kistologie.webp?v=46'],
  ['food','FOOD','./assets/dingsi-lab-icons/approved-v46-food.webp?v=46'],
  ['einkauf','EINKAUF','./assets/dingsi-lab-icons/approved-v46-einkauf.webp?v=46'],
  ['finanzen','FINANZEN','./assets/dingsi-lab-icons/approved-v46-finanzen.webp?v=46'],
  ['kalender','KALENDER','./assets/dingsi-lab-icons/approved-v46-kalender.webp?v=46'],
  ['progress','PROGRESS','./assets/dingsi-lab-icons/approved-v46-progress.webp?v=46'],
  ['denkfabrik','DENKFABRIK','./assets/dingsi-lab-icons/approved-v46-denkfabrik.webp?v=46'],
  ['outdoor','OUTDOOR','./assets/dingsi-lab-icons/approved-v46-outdoor.webp?v=46'],
  ['wohnung','WOHNUNG','./assets/dingsi-lab-icons/approved-v46-wohnung.webp?v=46'],
  ['werkstatt','WERKSTATT','./assets/dingsi-lab-icons/approved-v46-werkstatt.webp?v=46'],
  ['reisen','REISEN','./assets/dingsi-lab-icons/approved-v46-reisen.webp?v=46'],
  ['backstage','BACKSTAGE','./assets/dingsi-lab-icons/approved-v46-backstage.webp?v=46']
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
  const note=document.createElement('span');note.textContent='#I11-Stil · freigestelltes 3D-Original';
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
   tile.setAttribute('aria-label',title+' als freigestelltes 3D-Original ansehen');
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
 if(selected)selected.textContent='#I11-Stil · 14 freigestellte 3D-Originalmotive';
})();