from pathlib import Path

p=Path('.github/workflows/regression.yml'); s=p.read_text(encoding='utf-8')
s=s.replace('          node --check running-task-render-stability-v505.js\n','          node --check backup-stability-v506.js\n          node --check history-safety-net-v498.js\n          node --check running-task-render-stability-v505.js\n')
s=s.replace("          grep -q 'running-task-render-stability-v505.js?v=505-1353' index.html\n          grep -q \"serviceWorker.register('./sw.js?v=505-1353'\" index.html\n          grep -q 'running-task-render-stability-v505.js' sw.js\n","          grep -q 'running-task-render-stability-v505.js?v=505-1353' index.html\n          grep -q 'backup-stability-v506.js?v=506-1131' index.html\n          grep -q \"serviceWorker.register('./sw.js?v=506-1131'\" index.html\n          grep -q 'running-task-render-stability-v505.js' sw.js\n          grep -q 'backup-stability-v506.js' sw.js\n          grep -q 'dbReconnectV506:true' history-safety-net-v498.js\n          grep -q 'iosBackupHandoffV506:true' history-safety-net-v498.js\n          grep -q 'ZIP TEILEN / IN DATEIEN SICHERN' history-safety-net-v498.js\n")
s=s.replace('window.__modCategoryCreateStabilityV504&&window.__modRunningTaskRenderStabilityV505,{timeout:30000});','window.__modCategoryCreateStabilityV504&&window.__modRunningTaskRenderStabilityV505&&window.__modRecoveryHistoryV498&&window.__modBackupStabilityV506,{timeout:30000});')
needle="""            if(ticker.renderCalls!==0||!ticker.completedCardSame||!ticker.deleteButtonSame||!ticker.deleteStillVisible||!ticker.runningDetailChanged||!ticker.verify){
              throw new Error('V505 running-task flicker regression '+JSON.stringify(ticker));
            }

            const build=await page.evaluate(()=>({v:window.__MOD_BUILD__?.version,dynamic:window.__MOD_BUILD__?.dynamic,loaded:window.__modBuildFreshnessV502?.version,v503:window.__modTodayInteractionStabilityV503?.version,v504:window.__modCategoryCreateStabilityV504?.version,v505:window.__modRunningTaskRenderStabilityV505?.version}));
            if(build.v!=='V505'||build.loaded!=='V502'||build.v503!=='V503'||build.v504!=='V504'||build.v505!=='V505')throw new Error('Dynamic build metadata missing '+JSON.stringify(build));
            console.log('Current browser regression OK',result,pausedAfter,categoryCreate,ticker,build);
"""
replacement="""            if(ticker.renderCalls!==0||!ticker.completedCardSame||!ticker.deleteButtonSame||!ticker.deleteStillVisible||!ticker.runningDetailChanged||!ticker.verify){
              throw new Error('V505 running-task flicker regression '+JSON.stringify(ticker));
            }

            const backupReconnect=await page.evaluate(async()=>{
              const api=window.__modRecoveryHistoryV498;
              if(!api)throw new Error('V498 backup API missing');
              const before=await api.exportPackage();
              api.resetDbConnection();
              const after=await api.exportPackage();
              return {
                beforeOk:before?.schema==='master-of-disaster-safety-net'&&Array.isArray(before.points)&&Array.isArray(before.logs),
                afterOk:after?.schema==='master-of-disaster-safety-net'&&Array.isArray(after.points)&&Array.isArray(after.logs),
                reconnect:api.dbReconnectV506===true,
                iosHandoff:api.iosBackupHandoffV506===true,
                verify:window.__modBackupStabilityV506?.verify?.()===true
              };
            });
            if(!Object.values(backupReconnect).every(Boolean))throw new Error('V506 backup reconnect regression '+JSON.stringify(backupReconnect));

            const build=await page.evaluate(()=>({v:window.__MOD_BUILD__?.version,dynamic:window.__MOD_BUILD__?.dynamic,loaded:window.__modBuildFreshnessV502?.version,v503:window.__modTodayInteractionStabilityV503?.version,v504:window.__modCategoryCreateStabilityV504?.version,v505:window.__modRunningTaskRenderStabilityV505?.version,v506:window.__modBackupStabilityV506?.version}));
            if(build.v!=='V506'||build.loaded!=='V502'||build.v503!=='V503'||build.v504!=='V504'||build.v505!=='V505'||build.v506!=='V506')throw new Error('Dynamic build metadata missing '+JSON.stringify(build));
            console.log('Current browser regression OK',result,pausedAfter,categoryCreate,ticker,backupReconnect,build);
"""
if needle not in s: raise SystemExit('regression anchor missing')
s=s.replace(needle,replacement,1)
for m in ['backupReconnect','V506 backup reconnect regression',"build.v!=='V506'",'backup-stability-v506.js?v=506-1131']:
    if m not in s: raise SystemExit('regression patch failed: '+m)
p.write_text(s,encoding='utf-8')
