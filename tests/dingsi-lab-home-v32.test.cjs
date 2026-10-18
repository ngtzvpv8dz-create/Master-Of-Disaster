'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const home=read('dingsi-lab-home.html');
const lab=read('dingsi-lab.html');
const js=read('dingsi-lab-home-theme-v32.js');
const css=read('dingsi-lab-home-theme-v32.css');
test('Homescreen Lab links both themes and preserves all 14 original icon motifs',()=>{
  assert.match(lab,/dingsi-lab-home\.html\?v=32/);
  assert.match(home,/data-home-theme="dark"/);
  assert.match(home,/data-home-theme="pastel"/);
  assert.match(home,/dingsi-lab-home-theme-v32\.css\?v=32/);
  assert.match(home,/dingsi-lab-home-theme-v32\.js\?v=32/);
  const matches=[...home.matchAll(/src="\.\/assets\/dingsi-lab-icons\/([^"]+)"/g)];
  assert.equal(matches.length,14);
  assert(matches.every(x=>/\.svg(?:\?v=\d+)?$/.test(x[1])));
  assert.match(css,/html\[data-lab-theme="pastel"\] body/);
  assert.match(css,/saturate\(\.62\)/);
  assert.doesNotThrow(()=>new vm.Script(js));
});
test('Switch changes visible theme and selected button, remembers choice locally',()=>{
  const changes={},attributes=new Map();
  const make=key=>({
    dataset:{homeTheme:key},
    setAttribute:(name,value)=>attributes.set(key+':'+name,value),
    addEventListener:(type,fn)=>changes[key]=fn,
  });
  const buttons=[make('dark'),make('pastel')];
  const root={dataset:{labTheme:'pastel'},style:{}};
  const themeMeta={setAttribute:(name,value)=>attributes.set('meta:'+name,value)};
  const store=new Map();
  const document={
    documentElement:root,
    querySelectorAll:()=>buttons,
    querySelector:()=>themeMeta,
  };
  const localStorage={setItem:(key,value)=>store.set(key,value)};
  vm.runInNewContext(js,{document,localStorage});
  assert.equal(attributes.get('pastel:aria-pressed'),'true');
  assert.equal(root.style.colorScheme,'light');
  changes.dark();
  assert.equal(store.get('mod-dingsi-lab-homescreen-theme'),'dark');
  assert.equal(attributes.get('dark:aria-pressed'),'true');
  assert.equal(attributes.get('pastel:aria-pressed'),'false');
  assert.equal(attributes.get('meta:content'),'#000000');
  changes.pastel();
  assert.equal(store.get('mod-dingsi-lab-homescreen-theme'),'pastel');
  assert.equal(attributes.get('pastel:aria-pressed'),'true');
  assert.equal(attributes.get('meta:content'),'#fcf9fd');
});
test('Lab-only script has no production app or remote-data coupling',()=>{
  assert.doesNotMatch(js,/supabase|XMLHttpRequest|fetch\(|location\.href/);
  assert.doesNotMatch(js,/master-of-disaster-(?:theme|settings)/);
});
