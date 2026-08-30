from pathlib import Path

def rep(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise SystemExit(f'missing {old!r} in {path}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

rep('paused-today-v447.js',"s.src='./history-safety-net-v498.js?v=498-1041';","s.src='./history-safety-net-v498.js?v=506-backup-1131';")
rep('index.html','<!-- BUILD: V505 · 29.08.2026 · 13:53 -->','<!-- BUILD: V506 · 30.08.2026 · 11:31 -->')
rep('index.html',"const meta={version:'V505',date:'29.08.2026',time:'13:53',build:'29.08.2026 · 13:53 Uhr'};","const meta={version:'V506',date:'30.08.2026',time:'11:31',build:'30.08.2026 · 11:31 Uhr'};")
rep('index.html','  <script src="./running-task-render-stability-v505.js?v=505-1353"></script>\n','  <script src="./running-task-render-stability-v505.js?v=505-1353"></script>\n  <script src="./backup-stability-v506.js?v=506-1131"></script>\n')
rep('index.html',"serviceWorker.register('./sw.js?v=505-1353'","serviceWorker.register('./sw.js?v=506-1131'")
rep('index.html','V505 Service-Worker-Registrierung:','V506 Service-Worker-Registrierung:')
rep('sw.js','const CACHE_NAME="master-of-disaster-v505-running-task-render-stability";','const CACHE_NAME="master-of-disaster-v506-backup-safety-stability";')
rep('sw.js','"./running-task-render-stability-v505.js","./remote-commands.js"','"./running-task-render-stability-v505.js","./backup-stability-v506.js","./remote-commands.js"')
