'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('dingsi-lab-home-comic-v48.html');
const css=read('dingsi-lab-home-comic-v48.css');
const js=read('dingsi-lab-home-comic-v48.js');
const oldHome=read('dingsi-lab-home.html');
const hub=read('dingsi-lab.html');
const ids=['todo','fitness','kistologie','food','einkauf','finanzen','kalender','progress','denkfabrik','outdoor','wohnung','werkstatt','reisen','backstage'];
test('Real lab overview links an independent comic homescreen without replacing the old screen',()=>{
 assert.match(hub,/dingsi-lab-home-comic-v48\.html\?v=48/);
 assert.match(hub,/dingsi-lab-home\.html\?v=32/);
 assert.match(html,/dingsi-lab-home-comic-v48\.css\?v=48/);
 assert.match(html,/dingsi-lab-home-comic-v48\.js\?v=48/);
 assert.match(oldHome,/assets\/dingsi-lab-icons\/todo\.svg/);
});
test('All fourteen actual latest individually generated comic assets exist with transparency',()=>{
 const paths=[...html.matchAll(/assets\/dingsi-lab-icons\/comic-drawn-v48-([a-z]+)\.webp\?v=48/g)].map(m=>m[1]);
 assert.deepEqual(paths,ids);
 const areas=[...html.matchAll(/data-area="([a-z]+)"/g)].map(m=>m[1]);
 assert.deepEqual(areas,ids);
 assert.equal(new Set(areas).size,14);
 for(const id of ids){
  const bytes=fs.readFileSync(path.join(root,'assets','dingsi-lab-icons','comic-drawn-v48-'+id+'.webp'));
  assert.equal(bytes.toString('ascii',0,4),'RIFF',id);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',id);
  assert.equal(bytes.toString('ascii',12,16),'VP8X',id);
  assert.notEqual(bytes[20]&16,0,id+' must have real transparency');
  assert(bytes.length>20000,id+' must be real standalone art');
 }
});
test('Every mobile row is complete with equal-size icons and no scale-for-last-item hack',()=>{
 assert.equal(ids.length%2,0);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(min-width:800px\)\{\.comic-grid\{grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/\.comic-art\{[^}]*aspect-ratio:1/);
 assert.match(css,/\.comic-art img\{[^}]*width:100%;height:100%/);
 assert.doesNotMatch(css,/:nth-last-child|grid-column:span|grid-row:span/);
});
test('Comic appearance saves only to Lab-specific preference key; mock tiles never navigate to productive area',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.match(js,/mod-dingsi-lab-comic-homescreen-v48-theme/);
 assert.match(html,/data-comic-theme="light"/);
 assert.match(html,/data-comic-theme="evening"/);
 assert.doesNotMatch(js,/window\.location|supabase|mod-dingsi-lab-homescreen-theme/);
 assert.match(js,/Vorschau, noch nicht produktiv/);
});
