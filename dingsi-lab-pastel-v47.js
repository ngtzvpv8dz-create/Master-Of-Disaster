/* v47: display the 14 separately made pastel 3D icons in the real Dingsi Lab. */
(function(){
 'use strict';
 const ids=window.DingsiPastelZip.names;
 const title=['TO-DO','FITNESS','KISTOLOGIE','FOOD','EINKAUF','FINANZEN','KALENDER','PROGRESS','DENKFABRIK','OUTDOOR','WOHNUNG','WERKSTATT','REISEN','BACKSTAGE'];
 const el=id=>document.getElementById(id);
 const toggle=el('pastel-show-v47'),upload=el('pastel-import-v47'),input=el('pastel-input-v47'),panel=el('pastel-panel-v47');
 const grid=el('pastel-grid-v47'),surface=el('pastel-surface-v47'),detail=el('pastel-detail-v47'),status=el('pastel-status-v47'),preview=el('preview');
 if(!toggle||!input||!grid||!surface||!preview)return;
 const images=new Map();let loaded=false;
 const say=s=>status.textContent=s;
 function backdrop(){
  const mode=preview.dataset.surface;
  surface.dataset.surface=['dark','pastel','checker','photo'].includes(mode)?mode:'pastel';
  const bg=preview.style.getPropertyValue('--photo-background');
  if(bg)surface.style.setProperty('--photo-background',bg);
 }
 function large(id){
  const i=ids.indexOf(id);
  detail.replaceChildren();
  const image=document.createElement('img');image.src=images.get(id);image.alt=title[i];
  const caption=document.createElement('strong');caption.textContent=title[i]+' · freigestelltes Pastell-3D';
  detail.append(image,caption);detail.hidden=false;
  grid.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.icon===id)));
 }
 function render(blobs){
  for(const url of images.values())URL.revokeObjectURL(url);
  images.clear();
  for(const [id,blob] of blobs)images.set(id,URL.createObjectURL(blob));
  loaded=true;grid.replaceChildren();detail.hidden=true;
  ids.forEach((id,i)=>{
   const btn=document.createElement('button');btn.type='button';btn.className='fullset-card-v45';btn.dataset.icon=id;
   btn.setAttribute('aria-label',title[i]+' ansehen');btn.setAttribute('aria-pressed','false');
   const img=document.createElement('img');img.src=images.get(id);img.alt='';img.loading='lazy';
   const label=document.createElement('strong');label.textContent=title[i];
   btn.append(img,label);btn.addEventListener('click',()=>large(id));grid.appendChild(btn);
  });
  backdrop();
 }
 function openPanel(){
  panel.hidden=!panel.hidden;
  toggle.setAttribute('aria-expanded',String(!panel.hidden));
  toggle.textContent=panel.hidden?'🎨 Pastell-3D-Icons (14) ansehen':'🎨 Pastell-3D-Icons schließen';
  if(!panel.hidden)backdrop();
 }
 toggle.addEventListener('click',()=>{if(!loaded)input.click();else openPanel();});
 upload.addEventListener('click',()=>input.click());
 input.addEventListener('change',async()=>{
  const file=input.files&&input.files[0];if(!file)return;
  say('⏳ Prüfe die 14 Bilder …');
  try{
   const blobs=window.DingsiPastelZip.read(await file.arrayBuffer());
   render(blobs);panel.hidden=false;toggle.setAttribute('aria-expanded','true');toggle.textContent='🎨 Pastell-3D-Icons schließen';
   try{await window.DingsiPastelStore.save(blobs);say('✓ Alle 14 Icons gespeichert. Du kannst sie später für den Homescreen übernehmen.');}
   catch(_){say('⚠️ Bilder sichtbar, aber auf diesem Gerät nicht dauerhaft speicherbar.');}
  }catch(error){say('⚠️ '+error.message);}
  input.value='';
 });
 new MutationObserver(()=>{if(loaded&&!panel.hidden)backdrop()}).observe(preview,{attributes:true,attributeFilter:['data-surface','style']});
 (async()=>{
  try{
   const saved=await window.DingsiPastelStore.load(ids);
   if(saved.size===14){render(saved);say('✓ 14 Pastell-3D-Icons auf diesem Gerät verfügbar.');}
   else say('Einmal das Pastell-Icon-Paket importieren; die vorherigen Icons bleiben erhalten.');
  }catch(_){say('Für die neue Vorschau bitte einmal das Icon-Paket auswählen.');}
 })();
})();