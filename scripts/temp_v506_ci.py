from pathlib import Path

p=Path('.github/workflows/build-consistency.yml'); s=p.read_text(encoding='utf-8')
s=s.replace("            'running-task-render-stability-v505.js?v=505-1353',\n            \"serviceWorker.register('./sw.js?v=505-1353'\",","            'running-task-render-stability-v505.js?v=505-1353',\n            'backup-stability-v506.js?v=506-1131',\n            \"serviceWorker.register('./sw.js?v=506-1131'\",")
s=s.replace("'running-task-render-stability-v505.js','paused-today-v447.js'","'running-task-render-stability-v505.js','backup-stability-v506.js','paused-today-v447.js'")
s=s.replace("            'running-task-render-stability-v505.js':[\"const BUILD_VERSION='V505'\",'fullViewTickerRemoved:true','runningCardOnlyRefresh:true','unrelatedCardsKeepDom:true','terminalActionsStayStable:true','dataSemanticsUntouched:true'],\n","            'running-task-render-stability-v505.js':[\"const BUILD_VERSION='V505'\",'fullViewTickerRemoved:true','runningCardOnlyRefresh:true','unrelatedCardsKeepDom:true','terminalActionsStayStable:true','dataSemanticsUntouched:true'],\n            'backup-stability-v506.js':[\"const BUILD_VERSION='V506'\",'indexedDbReconnect:true','iphoneZipUsesExplicitHandoff:true','safetyModuleRemainsV498:true','dataSemanticsUntouched:true'],\n            'history-safety-net-v498.js':['withDbReconnect','dbReconnectV506:true','iosBackupHandoffV506:true','ZIP TEILEN / IN DATEIEN SICHERN','DATENSICHERHEIT · MODUL V498'],\n")
s=s.replace('for f in app.js running-task-render-stability-v505.js ','for f in app.js backup-stability-v506.js running-task-render-stability-v505.js history-safety-net-v498.js ')
for m in ["backup-stability-v506.js?v=506-1131","serviceWorker.register('./sw.js?v=506-1131'","dbReconnectV506:true"]:
    if m not in s: raise SystemExit('build guard patch failed: '+m)
p.write_text(s,encoding='utf-8')

p=Path('.github/workflows/runtime-smoke.yml'); s=p.read_text(encoding='utf-8')
s=s.replace('          node --check running-task-render-stability-v505.js\n','          node --check backup-stability-v506.js\n          node --check running-task-render-stability-v505.js\n')
s=s.replace('                  window.__modRecoveryHistoryV498&&\n                  window.__modRunningTaskRenderStabilityV505\n','                  window.__modRecoveryHistoryV498&&\n                  window.__modRunningTaskRenderStabilityV505&&\n                  window.__modBackupStabilityV506\n')
s=s.replace("                v505:!!window.__modRunningTaskRenderStabilityV505,\n                v505Verified:window.__modRunningTaskRenderStabilityV505?.verify?.()===true\n","                v505:!!window.__modRunningTaskRenderStabilityV505,\n                v505Verified:window.__modRunningTaskRenderStabilityV505?.verify?.()===true,\n                v506:!!window.__modBackupStabilityV506,\n                v506Verified:window.__modBackupStabilityV506?.verify?.()===true\n")
for m in ['node --check backup-stability-v506.js','window.__modBackupStabilityV506','v506Verified']:
    if m not in s: raise SystemExit('runtime patch failed: '+m)
p.write_text(s,encoding='utf-8')
