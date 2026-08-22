import fs from 'node:fs';
import path from 'node:path';
import {execSync} from 'node:child_process';

const root=process.cwd();
const output=process.env.METRICS_OUTPUT||path.join(root,'development-metrics.json');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const version=(index.match(/BUILD:\s*(V\d+)/)||[])[1]||(index.match(/version:'(V\d+)'/)||[])[1]||'UNKNOWN';
const excludedDirs=new Set(['.git','node_modules']);
const excludedFiles=new Set(['development-metrics.json']);
const textExt=new Set(['.js','.mjs','.cjs','.ts','.tsx','.jsx','.css','.html','.htm','.json','.md','.txt','.yml','.yaml','.webmanifest','.xml','.svg','.csv']);
const imageExt=new Set(['.png','.jpg','.jpeg','.webp','.gif','.ico']);
const files=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(excludedDirs.has(entry.name))continue;
    const abs=path.join(dir,entry.name),rel=path.relative(root,abs).replaceAll('\\','/');
    if(entry.isDirectory())walk(abs);
    else if(entry.isFile()&&!excludedFiles.has(rel))files.push({abs,rel});
  }
}
walk(root);

let currentBytes=0,currentTextBytes=0,currentTextLines=0,imageBytes=0,otherBinaryBytes=0;
let javascriptFiles=0,cssFiles=0,workflowFiles=0,rootFiles=0;
for(const f of files){
  const stat=fs.statSync(f.abs),ext=path.extname(f.rel).toLowerCase();
  currentBytes+=stat.size;
  if(!f.rel.includes('/'))rootFiles++;
  if(f.rel.startsWith('.github/workflows/'))workflowFiles++;
  if(['.js','.mjs','.cjs'].includes(ext))javascriptFiles++;
  if(ext==='.css')cssFiles++;
  if(textExt.has(ext)){
    currentTextBytes+=stat.size;
    const text=fs.readFileSync(f.abs,'utf8');
    currentTextLines+=text.length?text.split(/\r?\n/).length:0;
  }else if(imageExt.has(ext))imageBytes+=stat.size;
  else otherBinaryBytes+=stat.size;
}

const baseCommits=Number(execSync('git rev-list --count HEAD',{encoding:'utf8'}).trim())||0;
const reachableCommits=baseCommits+(process.env.METRICS_WILL_COMMIT==='1'?1:0);
const sourceCommit=process.env.SOURCE_COMMIT||execSync('git rev-parse HEAD',{encoding:'utf8'}).trim();
const pullRequests=Number(process.env.PR_COUNT||0)||0;
const mergedPullRequests=Number(process.env.MERGED_PR_COUNT||0)||0;
const now=new Date();
const parts=new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now);
const part=t=>parts.find(p=>p.type===t)?.value||'';
const generatedAt=`${part('day')}.${part('month')}.${part('year')} · ${part('hour')}:${part('minute')}`;

const metrics={
  schema:'master-of-disaster-development-metrics',
  schemaVersion:1,
  version,
  generatedAt,
  sourceCommit,
  automated:true,
  excludes:['development-metrics.json'],
  repository:{
    reachableCommits,
    pullRequests,
    mergedPullRequests,
    currentFiles:files.length,
    rootFiles,
    workflowFiles,
    javascriptFiles,
    cssFiles,
    currentTextLines,
    currentBytes,
    currentTextBytes,
    imageBytes,
    otherBinaryBytes
  }
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify(metrics,null,2));