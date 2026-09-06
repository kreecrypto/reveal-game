(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const MAX_ITEMS=10;
  const state={title:'เกมของฉัน',items:[],nextId:1};
  const list=$('[data-ui="items"]'),template=$('#item-template'),count=$('[data-ui="count"]'),status=$('[data-ui="status"]'),toast=$('[data-ui="toast"]');
  const toastMessage=$('[data-ui="toast-message"]'),undoButton=$('[data-action="undo-remove"]');
  const readinessText=$('[data-ui="readiness-text"]'),readinessBar=$('[data-ui="readiness-bar"]'),readinessDetail=$('[data-ui="readiness-detail"]'),footerSummary=$('[data-ui="footer-summary"]');
  const clearModal=$('[data-ui="clear-modal"]'),cancelClear=$('[data-action="cancel-clear"]'),confirmClear=$('[data-action="confirm-clear"]');
  let toastTimer,lastRemoved=null,clearTrigger=null;

  const say=(msg,{undo=false,duration=1800}={})=>{
    toastMessage.textContent=msg;
    undoButton.classList.toggle('is-hidden',!undo);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('show'),duration);
  };
  const objectUrlMap=new Map();
  const clearObjectUrls=()=>{objectUrlMap.forEach(URL.revokeObjectURL);objectUrlMap.clear()};
  window.addEventListener('beforeunload',clearObjectUrls);

  const resizedBlob=async file=>{
    if(!file.type.startsWith('image/')) throw new Error('อันนี้ไม่ใช่รูปนะ เอารูปจริงมา');
    if(file.size>15*1024*1024) throw new Error('รูปใหญ่ไปนิด ขอไม่เกิน 15MB');
    try{const bitmap=await createImageBitmap(file);const maxSide=1600,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));if(scale===1)return file;const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));return blob||file}catch{return file}
  };

  const completeCount=()=>state.items.filter(x=>x.imageBlob&&x.answer.trim()).length;
  const updateReadiness=()=>{
    const complete=completeCount(),total=state.items.length,pct=total?Math.round((complete/total)*100):0;
    readinessBar.style.width=`${pct}%`;footerSummary.textContent=complete?`${complete} จาก ${total} ข้อ พร้อมลุย`:'ยังไม่มีข้อพร้อมลุย';
    if(complete===total&&total>0){readinessText.textContent='ครบแล้ว ลุยได้';readinessDetail.textContent='ของครบทุกข้อ เปิดป้ายได้เลย';}
    else{readinessText.textContent='ยังขาดอีกนิด';const missing=total-complete;readinessDetail.textContent=`อีก ${missing} ข้อยังขาดรูปหรือเฉลย`;}
    $('[data-action="play"]').disabled=!(complete===total&&total>0);
  };

  const addItem=(source={})=>{if(state.items.length>=MAX_ITEMS){say('พอแล้ว 10 ข้อ เดี๋ยวคนเล่นเหนื่อย');return false}state.items.push({id:source.id||state.nextId++,question:source.question||'นี่มันตัวอะไรเนี่ย?',answer:source.answer||'',imageBlob:source.imageBlob||null,imageName:source.imageName||''});if(source.id)state.nextId=Math.max(state.nextId,Number(source.id)+1);render();return true};
  const removeItem=id=>{
    if(state.items.length<=1){say('อย่างน้อยเหลือไว้ 1 ข้อสิ');return}
    const index=state.items.findIndex(x=>x.id===id);if(index<0)return;
    const item=state.items[index],url=objectUrlMap.get(id);if(url){URL.revokeObjectURL(url);objectUrlMap.delete(id)}
    lastRemoved={item,index};state.items.splice(index,1);render();status.textContent='ลบข้อแล้ว ยังไม่ได้เก็บ';say(`ลบข้อ ${index+1} แล้ว`,{undo:true,duration:5000});
  };
  const undoRemove=()=>{
    if(!lastRemoved||state.items.length>=MAX_ITEMS)return;
    const {item,index}=lastRemoved;state.items.splice(Math.min(index,state.items.length),0,item);lastRemoved=null;render();status.textContent='เอาข้อกลับมาแล้ว ยังไม่ได้เก็บ';say('เอาคืนให้แล้ว');
  };
  const updateItem=(id,key,value)=>{const item=state.items.find(x=>x.id===id);if(item)item[key]=value};
  const previewUrl=item=>{if(!item.imageBlob)return'';if(objectUrlMap.has(item.id))return objectUrlMap.get(item.id);const url=URL.createObjectURL(item.imageBlob);objectUrlMap.set(item.id,url);return url};

  const render=()=>{
    count.textContent=state.items.length;list.innerHTML='';
    state.items.forEach((item,index)=>{
      const node=template.content.firstElementChild.cloneNode(true);node.dataset.id=item.id;
      $('.question-no',node).textContent=String(index+1).padStart(2,'0');$('[data-field="number"]',node).textContent=index+1;
      const q=$('[data-field="question"]',node),a=$('[data-field="answer"]',node),f=$('[data-field="file"]',node),zone=$('[data-field="upload-zone"]',node),img=$('[data-field="preview"]',node),stateText=$('[data-field="state"]',node),change=$('[data-action="choose-image"]',node),imageCheck=$('[data-check="image"]',node),answerCheck=$('[data-check="answer"]',node);
      q.value=item.question;a.value=item.answer;
      const syncState=()=>{const hasImage=!!item.imageBlob,hasAnswer=!!item.answer.trim();stateText.textContent=hasImage&&hasAnswer?'ครบแล้ว ลุยได้':!hasImage?'ยังขาดรูป':'ยังขาดเฉลย';stateText.classList.toggle('ready',hasImage&&hasAnswer);imageCheck.textContent=hasImage?'✓ มีรูป':'○ มีรูป';answerCheck.textContent=hasAnswer?'✓ มีเฉลย':'○ มีเฉลย';imageCheck.classList.toggle('done',hasImage);answerCheck.classList.toggle('done',hasAnswer);updateReadiness()};
      if(item.imageBlob){zone.classList.add('has-image');img.src=previewUrl(item);change.classList.remove('is-hidden')}
      q.addEventListener('input',e=>{updateItem(item.id,'question',e.target.value);status.textContent='มีแก้นะ ยังไม่ได้เก็บ'});
      a.addEventListener('input',e=>{updateItem(item.id,'answer',e.target.value);syncState();status.textContent='มีแก้นะ ยังไม่ได้เก็บ'});
      const choose=()=>f.click();zone.addEventListener('click',choose);change.addEventListener('click',choose);
      f.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{status.textContent='กำลังจัดรูปให้...';const blob=await resizedBlob(file);const old=objectUrlMap.get(item.id);if(old){URL.revokeObjectURL(old);objectUrlMap.delete(item.id)}updateItem(item.id,'imageBlob',blob);updateItem(item.id,'imageName',file.name);render();status.textContent='มีแก้นะ ยังไม่ได้เก็บ'}catch(err){say(err.message)}});
      $('[data-action="remove-item"]',node).addEventListener('click',()=>removeItem(item.id));syncState();list.appendChild(node);
    });
    $('[data-action="add"]').disabled=state.items.length>=MAX_ITEMS;updateReadiness();
  };

  const validate=()=>{const title=$('#game-title').value.trim()||'เกมของฉัน';const complete=state.items.filter(x=>x.imageBlob&&x.answer.trim());if(!complete.length)throw new Error('อย่างน้อยใส่รูปกับเฉลยสัก 1 ข้อก่อน');if(complete.length!==state.items.length)throw new Error('ยังมีข้อไม่ครบ เช็กอีกทีนะ');return{version:20.4,title,updatedAt:new Date().toISOString(),questions:complete.map((x,i)=>({id:i+1,question:x.question.trim()||'นี่มันตัวอะไรเนี่ย?',answer:x.answer.trim(),imageBlob:x.imageBlob,imageName:x.imageName||`image-${i+1}`}))}};
  const save=async()=>{const game=validate();status.textContent='กำลังเก็บ...';await RevealGameStore.saveActive(game);state.title=game.title;status.textContent=`เก็บแล้ว · ${game.questions.length} ข้อ`;say('เก็บเกมให้แล้ว');return game};
  const restore=async()=>{try{const saved=await RevealGameStore.getActive();if(saved?.questions?.length){$('#game-title').value=saved.title||'เกมของฉัน';state.items=[];state.nextId=1;saved.questions.slice(0,MAX_ITEMS).forEach(q=>state.items.push({id:q.id||state.nextId++,question:q.question||'นี่มันตัวอะไรเนี่ย?',answer:q.answer||'',imageBlob:q.imageBlob||null,imageName:q.imageName||''}));state.nextId=Math.max(1,...state.items.map(x=>Number(x.id)||0))+1;render();status.textContent=`เจอเกมเก่าแล้ว · ${saved.questions.length} ข้อ`;return}}catch(e){console.warn(e)}addItem()};

  const openClearModal=trigger=>{clearTrigger=trigger;clearModal.classList.remove('is-hidden');document.body.classList.add('modal-open');cancelClear.focus()};
  const closeClearModal=()=>{clearModal.classList.add('is-hidden');document.body.classList.remove('modal-open');clearTrigger?.focus();clearTrigger=null};
  const clearGame=async()=>{await RevealGameStore.clearActive();clearObjectUrls();lastRemoved=null;state.items=[];state.nextId=1;$('#game-title').value='เกมของฉัน';addItem();status.textContent='โล่งเลย เริ่มใหม่ได้';closeClearModal();say('ล้างให้แล้ว')};

  $('#game-title').addEventListener('input',()=>status.textContent='มีแก้นะ ยังไม่ได้เก็บ');
  $('[data-action="add"]').addEventListener('click',()=>{if(addItem()){status.textContent='เพิ่มข้อใหม่แล้ว ยังไม่ได้เก็บ';requestAnimationFrame(()=>$$('[data-item]').at(-1)?.scrollIntoView({behavior:'smooth',block:'center'}))}});
  $('[data-action="save"]').addEventListener('click',()=>save().catch(e=>say(e.message)));
  $('[data-action="play"]').addEventListener('click',async()=>{try{await save();location.href='/?custom=1'}catch(e){say(e.message)}});
  $('[data-action="clear"]').addEventListener('click',e=>openClearModal(e.currentTarget));
  undoButton.addEventListener('click',undoRemove);
  cancelClear.addEventListener('click',closeClearModal);
  confirmClear.addEventListener('click',()=>clearGame().catch(e=>say(e.message)));
  clearModal.addEventListener('click',e=>{if(e.target===clearModal)closeClearModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!clearModal.classList.contains('is-hidden'))closeClearModal()});
  restore();
})();
