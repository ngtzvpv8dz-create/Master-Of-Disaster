/* Dingsi Lab v47: read the exact local uncompressed ZIP, no remote upload. */
(function(){
 'use strict';
 const names=['todo','fitness','kistologie','food','einkauf','finanzen','kalender','progress','denkfabrik','outdoor','wohnung','werkstatt','reisen','backstage'];
 function read(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(buffer),text=new TextDecoder();
  const icons=new Map();let pos=0;
  if(bytes.length>12000000)throw Error('ZIP ist zu groß');
  while(pos+30<=bytes.length && view.getUint32(pos,true)===0x04034b50){
   const flags=view.getUint16(pos+6,true),method=view.getUint16(pos+8,true);
   const len=view.getUint32(pos+18,true),nameLength=view.getUint16(pos+26,true),extra=view.getUint16(pos+28,true);
   if(method!==0||(flags&8))throw Error('ZIP-Format nicht unterstützt; bitte das bereitgestellte Paket verwenden');
   const nameEnd=pos+30+nameLength,start=nameEnd+extra,end=start+len;
   if(end>bytes.length)throw Error('ZIP unvollständig');
   const match=/^([a-z]+)\.webp$/.exec(text.decode(bytes.subarray(pos+30,nameEnd)));
   if(match&&names.includes(match[1])){
    const data=bytes.slice(start,end),head=(at)=>String.fromCharCode(...data.slice(at,at+4));
    if(data.length<2000||head(0)!=='RIFF'||head(8)!=='WEBP'||head(12)!=='VP8X'||!(data[20]&16))throw Error('Ungültiges transparentes Icon: '+match[1]);
    icons.set(match[1],new Blob([data],{type:'image/webp'}));
   }
   pos=end;
  }
  if(names.some(name=>!icons.has(name)))throw Error('Das Paket enthält nicht alle 14 Icons');
  return icons;
 }
 window.DingsiPastelZip={read,names};
})();