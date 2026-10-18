'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const js=read('dingsi-lab-icons-fullset-v46.js');
const html=read('dingsi-lab-icons.html');
const hub=read('dingsi-lab.html');
const expected={
 todo:'2359e70e401d433f8d94104baf1829d57552a4ba17287332a16d7e7f349e8400',
 fitness:'d2b96d5a03de417236b71db2efefc2c4139389c6955436835076dce26a717e32',
 kistologie:'6a6211f2606395a27acc242a96cb1a2e4267335be05e376e1eb3983bd4c69b16',
 food:'2c9001cffb24d1d33d5151eea92d5beb1a6affa3f1ffbd52f0b6ccd770317fc9',
 einkauf:'34a4898dc3a84165647ce2dea445f9b3522222ee8e7da5dd6b13d85039582f9c',
 finanzen:'b44bcea44bc02d5217d8316a3a830c1b8a2fdcb0335d092bbefc81e2c4a3ad90',
 kalender:'534cf4120d9a742c36689ac0ebe92d71879b2a6ac78638838f55193089fe4632',
 progress:'726ae2f7a4c74c91db7c1e16070fd1995baf7e30819d2f3d2b12e5dfa2a1530e',
 denkfabrik:'e5b9a0fe8cf9cf95d470f7d7434e8fd969568dc66eb773af9b84b0dbaa4940c3',
 outdoor:'e73cbd00d82bd07f6b5c73cbe7d9b3c96210f7ebe3e02c9ba69e6759365468e6',
 wohnung:'bfe36bf92ab8db03d02a53acead94360e6bbe021e85605bc6df6054482c237f9',
 werkstatt:'ccd33fd2d8629364953fdde1356921d6e35fd67052f90171643cec21236aa752',
 reisen:'2582d02dabc77268cb173588e31a0e1fe3ed84a762729e9601cc109eb7cd90e2',
 backstage:'658cb944b870ab8e37a926b9945a63b84478f68a0e414a4737d56f1f2d3e3b75'
};
test('Dingsi Lab uses exact new individual artwork not AI UI screenshot or wrong collage',()=>{
 assert.match(hub,/href="\.\/dingsi-lab-icons\.html\?v=46"/);
 assert.match(html,/dingsi-lab-icons-fullset-v46\.js\?v=46/);
 assert.match(html,/id="fullset-toggle-v45"/);
 assert.match(html,/data-bg="checker"/);
 assert.match(html,/data-theme="pastel"/);
 assert.match(html,/id="photo"/);
 assert.match(html,/dingsi-lab-icons-cloud-v44\.js\?v=44/);
 assert.doesNotThrow(()=>new vm.Script(js));
 const paths=[...js.matchAll(/approved-v46-([a-z]+)\.webp\?v=46/g)].map(x=>x[1]);
 assert.deepEqual(paths,Object.keys(expected));
 assert.doesNotMatch(js,/i11-fullset-|icon-i11-todo-3d-alpha/);
});
test('Every approved icon has the exact source-derived bytes, transparency and real picture data',()=>{
 for(const [name,sha] of Object.entries(expected)){
  const p=path.join(root,'assets','dingsi-lab-icons','approved-v46-'+name+'.webp');
  const buf=fs.readFileSync(p);
  assert.equal(buf.toString('ascii',0,4),'RIFF');
  assert.equal(buf.toString('ascii',8,12),'WEBP');
  assert.equal(buf.toString('ascii',12,16),'VP8X');
  assert.notEqual(buf[20]&0x10,0,name+' lacks alpha transparency');
  assert.equal(crypto.createHash('sha256').update(buf).digest('hex'),sha,name+' unexpected artwork replacement');
 }
});
test('Previously selected style and productive home screen remain separate',()=>{
 assert.doesNotMatch(js,/localStorage\.setItem|supabase|dingsi_lab_icon_choices|fetch\(/);
 assert.match(html,/data-variant="I11"/);
 assert.match(html,/id="choose-style"/);
 assert.match(html,/id="fave"/);
});
