/* v47: cache imported Home Screen icon images in this device's IndexedDB. */
(function(){
 'use strict';
 const DB='mod-dingsi-lab-icons',STORE='pastel-3d-v47';
 function open(){
  return new Promise((resolve,reject)=>{
   if(typeof indexedDB==='undefined')return reject(Error('Bildspeicher nicht verfügbar'));
   const req=indexedDB.open(DB,1);
   req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
   req.onsuccess=()=>resolve(req.result);
   req.onerror=()=>reject(req.error||Error('Bildspeicher nicht verfügbar'));
  });
 }
 async function load(ids){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readonly'),store=tx.objectStore(STORE),out=new Map();
   tx.oncomplete=()=>{db.close();resolve(out)};
   tx.onerror=()=>{db.close();reject(tx.error)};
   ids.forEach(id=>{const req=store.get(id);req.onsuccess=()=>{if(req.result)out.set(id,req.result)};});
  });
 }
 async function save(items){
  const db=await open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
   tx.oncomplete=()=>{db.close();resolve()};
   tx.onerror=()=>{db.close();reject(tx.error)};
   for(const [id,blob] of items)store.put(blob,id);
  });
 }
 window.DingsiPastelStore={load,save};
})();