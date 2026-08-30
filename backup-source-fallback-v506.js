/* V506.3 · GITHUB-CODEARCHIV-FALLBACK FÜR IOS/PWA
   - codeload.github.com wird im Vollbackup nicht mehr direkt verwendet.
   - Stattdessen wird der aktuelle main-Tree geladen und jede Repo-Datei einzeln
     über raw.githubusercontent.com gelesen.
   - Die Dateien werden ohne DEFLATE in ein kleines STORE-ZIP geschrieben und
     dem bestehenden V506.2-Vollbackup als APP/source-main.zip übergeben.
   - Dadurch bleibt das speicherschonende V506.2-Backup erhalten, ohne den auf
     echtem iOS fehlgeschlagenen codeload-Fetch zu benötigen.
*/
(function(){
  'use strict';
  if(window.__modBackupSourceFallbackV506?.patchRevision==='V506.3')return;

  const PATCH_VERSION='V506.3';
  const TREE_URL='https://api.github.com/repos/ngtzvpv8dz-create/Master-Of-Disaster/git/trees/main?recursive=1';
  const RAW_BASE='https://raw.githubusercontent.com/ngtzvpv8dz-create/Master-Of-Disaster/main/';
  const CODELOAD_RE=/^https:\/\/codeload\.github\.com\/ngtzvpv8dz-create\/Master-Of-Disaster\/zip\/refs\/heads\/main(?:[?#].*)?$/i;
  const nativeFetch=window.fetch.bind(window);
  const enc=new TextEncoder();

  const CRC_TABLE=(()=>{
    const table=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);
      table[n]=c>>>0;
    }
    return table;
  })();

  function crcUpdate(crc,bytes){
    let c=crc>>>0;
    for(let i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&0xff]^(c>>>8);
    return c>>>0;
  }
  function u16(view,offset,value){view.setUint16(offset,value,true);}
  function u32(view,offset,value){view.setUint32(offset,value>>>0,true);}
  function bytesOf(value){
    if(value instanceof Uint8Array)return value;
    if(value instanceof ArrayBuffer)return new Uint8Array(value);
    if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    return enc.encode(String(value??''));
  }
  function dosStamp(date=new Date()){
    const year=Math.max(1980,date.getFullYear());
    return {
      time:((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|((Math.floor(date.getSeconds()/2))&31),
      date:(((year-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31)
    };
  }

  class StoreZipWriter{
    constructor(){this.chunks=[];this.entries=[];this.offset=0;this.stamp=dosStamp();}
    push(value){const b=bytesOf(value);if(!b.byteLength)return;this.chunks.push(b);this.offset+=b.byteLength;}
    async add(name,producer){
      const nameBytes=enc.encode(name),localOffset=this.offset;
      const header=new Uint8Array(30+nameBytes.length),hv=new DataView(header.buffer);
      u32(hv,0,0x04034b50);u16(hv,4,20);u16(hv,6,0x0808);u16(hv,8,0);
      u16(hv,10,this.stamp.time);u16(hv,12,this.stamp.date);u32(hv,14,0);u32(hv,18,0);u32(hv,22,0);
      u16(hv,26,nameBytes.length);u16(hv,28,0);header.set(nameBytes,30);this.push(header);
      let crc=0xffffffff,size=0;
      const emit=value=>{const b=bytesOf(value);if(!b.byteLength)return;crc=crcUpdate(crc,b);size+=b.byteLength;this.push(b);};
      await producer(emit);
      crc=(crc^0xffffffff)>>>0;
      if(size>0xffffffff||localOffset>0xffffffff)throw new Error('GitHub-Codearchiv ist für klassisches ZIP zu groß.');
      const descriptor=new Uint8Array(16),dv=new DataView(descriptor.buffer);
      u32(dv,0,0x08074b50);u32(dv,4,crc);u32(dv,8,size);u32(dv,12,size);this.push(descriptor);
      this.entries.push({nameBytes,localOffset,crc,size,time:this.stamp.time,date:this.stamp.date});
    }
    async addBlob(name,blob){
      return this.add(name,async emit=>{
        if(blob?.stream){
          const reader=blob.stream().getReader();
          try{for(;;){const {done,value}=await reader.read();if(done)break;emit(value);}}
          finally{try{reader.releaseLock();}catch(_){}}
        }else emit(new Uint8Array(await blob.arrayBuffer()));
      });
    }
    finish(){
      const centralStart=this.offset;
      for(const e of this.entries){
        const c=new Uint8Array(46+e.nameBytes.length),v=new DataView(c.buffer);
        u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x0808);u16(v,10,0);
        u16(v,12,e.time);u16(v,14,e.date);u32(v,16,e.crc);u32(v,20,e.size);u32(v,24,e.size);
        u16(v,28,e.nameBytes.length);u16(v,30,0);u16(v,32,0);u16(v,34,0);u16(v,36,0);u32(v,38,0);u32(v,42,e.localOffset);
        c.set(e.nameBytes,46);this.push(c);
      }
      const centralSize=this.offset-centralStart,end=new Uint8Array(22),v=new DataView(end.buffer);
      u32(v,0,0x06054b50);u16(v,4,0);u16(v,6,0);u16(v,8,this.entries.length);u16(v,10,this.entries.length);
      u32(v,12,centralSize);u32(v,16,centralStart);u16(v,20,0);this.push(end);
      return new Blob(this.chunks,{type:'application/zip'});
    }
  }

  function rawUrl(path){return RAW_BASE+String(path).split('/').map(encodeURIComponent).join('/');}

  async function buildSourceArchive(fetcher=nativeFetch,onProgress=()=>{}){
    const treeRes=await fetcher(TREE_URL,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
    if(!treeRes?.ok)throw new Error(`GitHub-Dateiliste konnte nicht geladen werden (${treeRes?.status||'Netzwerk'}).`);
    const tree=await treeRes.json();
    if(tree?.truncated)throw new Error('GitHub-Dateiliste ist unvollständig (truncated).');
    const files=(tree?.tree||[]).filter(item=>item?.type==='blob'&&item.path);
    if(!files.length)throw new Error('GitHub-Dateiliste enthält keine Dateien.');

    const writer=new StoreZipWriter();
    for(let i=0;i<files.length;i++){
      const item=files[i];
      onProgress({done:i,total:files.length,path:item.path});
      const res=await fetcher(rawUrl(item.path),{cache:'no-store'});
      if(!res?.ok)throw new Error(`GitHub-Datei konnte nicht geladen werden: ${item.path} (${res?.status||'Netzwerk'}).`);
      await writer.addBlob(item.path,await res.blob());
      onProgress({done:i+1,total:files.length,path:item.path});
      if((i+1)%12===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {blob:writer.finish(),sha:tree.sha||'unbekannt',fileCount:files.length};
  }

  function updateProgress(detail){
    try{
      const button=document.getElementById('fullBackupV397');
      if(button?.isConnected&&detail?.total)button.textContent=`⏳ CODEARCHIV ${detail.done}/${detail.total}…`;
    }catch(_){}
  }

  async function patchedFetch(input,init){
    const url=typeof input==='string'?input:String(input?.url||'');
    if(!CODELOAD_RE.test(url))return nativeFetch(input,init);
    try{
      const built=await buildSourceArchive(nativeFetch,detail=>{
        updateProgress(detail);
        try{window.dispatchEvent(new CustomEvent('mod-v5063-source-progress',{detail}));}catch(_){}
      });
      window.__modLiveLogV453?.append?.('SYSTEM','PASS',`V506.3 GitHub-Codearchiv-Fallback · ${built.fileCount} Dateien · codeload umgangen`);
      return new Response(built.blob,{status:200,statusText:'OK',headers:{'Content-Type':'application/zip','X-MOD-Source-Fallback':PATCH_VERSION}});
    }catch(error){
      window.__modLiveLogV453?.append?.('ERROR','ERROR',`V506.3 GitHub-Codearchiv-Fallback fehlgeschlagen · ${error?.message||error}`);
      throw error;
    }
  }

  window.fetch=patchedFetch;
  window.__modBackupSourceFallbackV506={
    version:'V506',
    patchRevision:PATCH_VERSION,
    buildSourceArchive,
    originalFetch:nativeFetch,
    codeloadBypassed:true,
    rawGithubFileFallback:true,
    sourceArchiveStoreZip:true,
    verify:()=>window.fetch===patchedFetch&&typeof buildSourceArchive==='function'
  };
})();
