/* V427 · preserve category during day-transition archive transfer */
(function(){
  const previous=typeof processDayTransition==='function'?processDayTransition:null;
  if(!previous)return;
  window.processDayTransition=function(){
    const snapshot=new Map((Array.isArray(tasks)?tasks:[]).map(t=>[String(t&&t.id),{category:t&&t.category?String(t.category):null}]));
    const result=previous.apply(this,arguments);
    let changed=false;
    (Array.isArray(archive)?archive:[]).forEach(item=>{
      const src=item&&item.sourceTaskId!=null?snapshot.get(String(item.sourceTaskId)):null;
      if(src&&src.category&&!item.category){item.category=src.category;changed=true;}
    });
    if(changed){
      if(typeof saveArchive==='function')saveArchive();
      if(typeof render==='function')render();
    }
    return result;
  };
  window.__modArchiveTransferCategoryV427={version:'V427'};
})();
