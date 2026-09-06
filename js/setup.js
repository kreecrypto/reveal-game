(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const MAX_ITEMS=10;
  const state={title:'เกมของฉัน',items:[],nextId:1};
  const list=$('[data-ui="items"]'),template=$('#item-template'),count=$('[data-ui="count"]'),status=$('[data-ui="status"]'),toast=$('[data-ui="toast"]');
  const readinessText=$('[data-ui="readiness-text"]'),readinessBar=$('[data-ui="readiness-bar"]'),readinessDetail=$('[data-ui="readiness-detail"]'),footerSummary=$('[data-ui="footer-summary"]');
  let toastTimer;
  const say=msg=>{toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800)};
  const objectUrlMap=new Map();
  const clearObjectUrls=()=>{objectUrlMap.forEach(URL.revokeObjectURL);objectUrlMap.clear()};
  window.addEventListener('beforeunload',clearObjectUrls);

  const resizedBlob=async file=>{
    if(!file.type.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์รูปภาพ');
    if(file.size>15*1024*1024) throw new Error('รูปใหญ่เกิน 15MB');
    try{const bitmap=await createImageBitmap(file);const maxSide=1600,scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));if(scale===1)return file;const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));return blob||file}catch{return file}
  };

  const completeCount=()=>state.items.filter(x=>x.imageBlob&&x.answer.trim()).length;
  const updateReadiness=()=>{
    const complete=completeCount(),total=state.items.length,pct=total?Math.round((complete/total)*100):0;
    readinessBar.style.width=`${pct}%`;footerSummary.textContent=`${complete} จาก ${total} ข้อพร้อมเล่น`;
    if(complete===total&&total>0){readinessText.textContent='พร้อมเล่นแล้ว';readinessDetail.textContent='ทุกข้อมีรูปและคำเฉลยครบ';}
    else{readinessText.textContent='ยังไม่พร้อมเล่น';const missing=total-complete;readinessDetail.textContent=`เหลืออีก ${missing} ข้อที่ต้องใส่รูปหรือคำเฉลย`;}
    $('[data-action="play"]').disabled=!(complete===total&&total>0);
  };

  const addItem=(source={})=>{if(state.items.length>=MAX_ITEMS){say('เพิ่มได้สูงสุด 10 ข้อ');return}state.items.push({id:source.id||state.nextId++,question:source.question||'ภาพนี้คืออะไร?',answer:source.answer||'',imageBlob:source.imageBlob||null,imageName:source.imageName||''});if(source.id)state.nextId=Math.max(state.nextId,Number(source.id)+1);render()};
  const removeItem=id=>{if(state.items.length<=1){say('ต้องมีอย่างน้อย 1 ข้อ');return}const url=objectUrlMap.get(id);if(url){URL.revokeObjectURL(url);objectUrlMap.delete(id)}state.items=state.items.filter(x=>x.id!==id);render()};
  const updateItem=(id,key,value)=>{const item=state.items.find(x=>x.id===id);if(item)item[key]=value};
  const previewUrl=item=>{if(!item.imageBlob)return'';if(objectUrlMap.has(item.id))return objectUrlMap.get(item.id);const url=URL.createObjectURL(item.imageBlob);objectUrlMap.set(item.id,url);return url};

  const render=()=>{
    count.textContent=state.items.length;list.innerHTML='';
    state.items.forEach((item,index)=>{
      const node=template.content.firstElementChild.cloneNode(true);node.dataset.id=item.id;
      $('.question-no',node).textContent=String(index+1).padStart(2,'0');$('[data-field="number"]',node).textContent=index+1;
      const q=$('[data-field="question"]',node),a=$('[data-field="answer"]',node),f=$('[data-field="file"]',node),zone=$('[data-field="upload-zone"]',node),img=$('[data-field="preview"]',node),stateText=$('[data-field="state"]',node),change=$('[data-action="choose-image"]',node),imageCheck=$('[data-check="image"]',node),answerCheck=$('[data-check="answer"]',node);
      q.value=item.question;a.value=item.answer;
      const syncState=()=>{const hasImage=!!item.imageBlob,hasAnswer=!!item.answer.trim();stateText.textContent=hasImage&&hasAnswer?'พร้อมเล่น':!hasImage?'เลือกรูปก่อน':'ใส่คำเฉลย';stateText.classList.toggle('ready',hasImage&&hasAnswer);imageCheck.textContent=hasImage?'✓ มีรูป':'○ มีรูป';answerCheck.textContent=hasAnswer?'✓ มีเฉลย':'○ มีเฉลย';imageCheck.classList.toggle('done',hasImage);answerCheck.classList.toggle('done',hasAnswer);updateReadiness()};
      if(item.imageBlob){zone.classList.add('has-image');img.src=previewUrl(item);change.classList.remove('is-hidden')}
      q.addEventListener('input',e=>updateItem(item.id,'question',e.target.value));
      a.addEventListener('input',e=>{updateItem(item.id,'answer',e.target.value);syncState();status.textContent='ยังไม่ได้บันทึกการเปลี่ยนแปลง'});
      const choose=()=>f.click();zone.addEventListener('click',choose);change.addEventListener('click',choose);
      f.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{status.textContent='กำลังเตรียมรูป...';const blob=await resizedBlob(file);const old=objectUrlMap.get(item.id);if(old){URL.revokeObjectURL(old);objectUrlMap.delete(item.id)}updateItem(item.id,'imageBlob',blob);updateItem(item.id,'imageName',file.name);render();status.textContent='ยังไม่ได้บันทึกการเปลี่ยนแปลง'}catch(err){say(err.message)}});
      $('[data-action="remove-item"]',node).addEventListener('click',()=>removeItem(item.id));syncState();list.appendChild(node);
    });
    $('[data-action="add"]').disabled=state.items.length>=MAX_ITEMS;updateReadiness();
  };

  const validate=()=>{const title=$('#game-title').value.trim()||'เกมของฉัน';const complete=state.items.filter(x=>x.imageBlob&&x.answer.trim());if(!complete.length)throw new Error('เพิ่มรูปและคำเฉลยอย่างน้อย 1 ข้อ');if(complete.length!==state.items.length)throw new Error('ยังมีข้อที่ไม่พร้อม กรุณาใส่รูปและคำเฉลยให้ครบ');return{version:20,title,updatedAt:new Date().toISOString(),questions:complete.map((x,i)=>({id:i+1,question:x.question.trim()||'ภาพนี้คืออะไร?',answer:x.answer.trim(),imageBlob:x.imageBlob,imageName:x.imageName||`image-${i+1}`}))}};
  const save=async()=>{const game=validate();status.textContent='กำลังบันทึก...';await RevealGameStore.saveActive(game);state.title=game.title;status.textContent=`บันทึกแล้ว · ${game.questions.length} ข้อ`;say('บันทึกเกมแล้ว');return game};
  const restore=async()=>{try{const saved=await RevealGameStore.getActive();if(saved?.questions?.length){$('#game-title').value=saved.title||'เกมของฉัน';state.items=[];state.nextId=1;saved.questions.slice(0,MAX_ITEMS).forEach(q=>state.items.push({id:q.id||state.nextId++,question:q.question||'ภาพนี้คืออะไร?',answer:q.answer||'',imageBlob:q.imageBlob||null,imageName:q.imageName||''}));state.nextId=Math.max(1,...state.items.map(x=>Number(x.id)||0))+1;render();status.textContent=`โหลดเกมที่บันทึกไว้ · ${saved.questions.length} ข้อ`;return}}catch(e){console.warn(e)}addItem()};

  $('#game-title').addEventListener('input',()=>status.textContent='ยังไม่ได้บันทึกการเปลี่ยนแปลง');
  $('[data-action="add"]').addEventListener('click',()=>addItem());
  $('[data-action="save"]').addEventListener('click',()=>save().catch(e=>say(e.message)));
  $('[data-action="play"]').addEventListener('click',async()=>{try{await save();location.href='/?custom=1'}catch(e){say(e.message)}});
  $('[data-action="clear"]').addEventListener('click',async()=>{if(!confirm('เริ่มสร้างเกมใหม่และล้างชุดที่บันทึกไว้ในเครื่องนี้?'))return;await RevealGameStore.clearActive();clearObjectUrls();state.items=[];state.nextId=1;$('#game-title').value='เกมของฉัน';addItem();status.textContent='เริ่มเกมใหม่แล้ว';say('ล้างข้อมูลแล้ว')});
  restore();
})();
