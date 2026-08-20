/* V416 · KOMPAKTE ZWEI-ZEILEN-AUFGABENKARTEN */
(function(){
  const BUILD_VERSION="V416";

  function clean(value){return String(value??"").trim();}
  function taskList(){try{return Array.isArray(tasks)?tasks:[];}catch(_){return [];}}

  function rowForCard(card){
    const api=window.__modCategoriesV412;
    if(api&&typeof api.rowForCard==="function")return api.rowForCard(card);
    const text=clean(card.querySelector(".task-text")?.textContent);
    return taskList().find(task=>clean(task?.text)===text)||null;
  }

  function dueText(task){
    if(!task||!task.dueDate||task.dueMode==="none")return "🗓️ —";
    const parts=String(task.dueDate).split("-");
    const date=parts.length===3?`${parts[2]}.${parts[1]}.`:String(task.dueDate);
    let icon="🗓️";
    try{if(typeof dueSymbol==="function")icon=dueSymbol(task)||"🗓️";}catch(_){ }
    return `${icon} ${date}`;
  }

  function priorityMarkup(priority){
    const level=priority==="high"?3:priority==="medium"?2:1;
    const cls=priority==="high"?"high":priority==="medium"?"medium":"normal";
    return `<span class="compact-priority-dots-v416 ${cls}" title="Priorität"><i class="${level>=1?'on':''}"></i><i class="${level>=2?'on':''}"></i><i class="${level>=3?'on':''}"></i></span>`;
  }

  function durationText(task){
    if(!task)return "";
    try{
      if(["running","paused"].includes(task.status)&&typeof liveDuration==="function"&&typeof formatDuration==="function")return formatDuration(liveDuration(task));
      const ms=task.type==="leisure"?(Number(task.leisureDurationMs)||0):(Number(task.activeDurationMs)||Number(task.actualDurationMs)||0);
      if(ms>0&&typeof formatDuration==="function")return formatDuration(ms);
    }catch(_){ }
    return "";
  }

  function ensureActionBar(card,content){
    let actions=content.querySelector(":scope > .icon-actions");
    if(!actions){
      const loose=[...card.children].filter(el=>el.matches?.("button.repeat-button,button.test-task-delete-button"));
      if(loose.length){actions=document.createElement("div");actions.className="icon-actions";loose.forEach(button=>actions.appendChild(button));}
    }
    if(!actions)return null;
    actions.classList.add("compact-actions-v416");
    const drag=card.querySelector(":scope > .drag-handle");
    if(drag){drag.classList.add("compact-drag-v416");actions.appendChild(drag);}
    card.appendChild(actions);
    return actions;
  }

  function enhanceCard(card){
    if(!card||card.classList.contains("archive-task")||card.querySelector(".edit-area"))return;
    if(card.dataset.compactV416==="1")return;
    const task=rowForCard(card);
    const number=card.querySelector(":scope > .task-number");
    const status=card.querySelector(":scope > .status-symbol");
    const content=card.querySelector(":scope > .task-content");
    const main=content?.querySelector(":scope > .task-main-row");
    if(!task||!number||!status||!content||!main)return;

    card.dataset.compactV416="1";
    card.classList.add("compact-task-v416");

    const left=document.createElement("div");
    left.className="compact-left-v416";
    left.appendChild(number);
    if(task.status==="open"&&clean(status.textContent)==="⬜")status.textContent="";
    left.appendChild(status);
    const time=document.createElement("div");
    time.className="compact-status-time-v416";
    time.dataset.compactTimeId=String(task.id);
    time.textContent=durationText(task);
    left.appendChild(time);
    card.prepend(left);

    content.classList.add("compact-content-v416");
    [...content.children].forEach(child=>{if(child!==main)child.classList.add("compact-source-hidden-v416");});

    const info=document.createElement("div");
    info.className="compact-info-v416";
    const priority=document.createElement("div");
    priority.className="compact-priority-v416";
    priority.innerHTML=priorityMarkup(task.priority);
    const due=document.createElement("div");
    due.className="compact-due-v416";
    due.textContent=dueText(task);
    info.append(priority,due);

    const type=[...content.querySelectorAll(":scope > .task-type-badge")].find(el=>!el.classList.contains("category-inline-v412"));
    const category=content.querySelector(":scope > .category-inline-v412");
    if(type){type.classList.remove("compact-source-hidden-v416");type.classList.add("compact-type-v416");info.appendChild(type);}
    if(category){category.classList.remove("compact-source-hidden-v416");category.classList.add("compact-category-v416");info.appendChild(category);}

    const cooking=content.querySelector(":scope > .cooking-mode-row");
    if(cooking){cooking.classList.remove("compact-source-hidden-v416");cooking.classList.add("compact-cooking-v416");info.appendChild(cooking);}

    card.appendChild(info);
    ensureActionBar(card,content);
  }

  function enhance(){
    const container=document.getElementById("viewContainer");
    if(!container)return;
    container.querySelectorAll(".task:not(.archive-task)").forEach(enhanceCard);
  }

  function refreshTimes(){
    const list=taskList();
    document.querySelectorAll(".compact-status-time-v416[data-compact-time-id]").forEach(el=>{
      const id=Number(el.dataset.compactTimeId);
      const task=list.find(item=>Number(item?.id)===id);
      if(task)el.textContent=durationText(task);
    });
  }

  const previousRender=typeof render==="function"?render:null;
  if(previousRender){
    render=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(enhance,0);
      return result;
    };
  }

  window.__modCompactTaskV416={version:BUILD_VERSION,enhance,refreshTimes};
  window.addEventListener("load",()=>setTimeout(enhance,250));
  setInterval(refreshTimes,1000);
})();
