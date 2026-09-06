(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const MAX_ITEMS=10;
  const MAX_SOURCE_BYTES=15*1024*1024;
  const TARGET_IMAGE_BYTES=2.5*1024*1024;
  const HARD_IMAGE_BYTES=4*1024*1024;
  const DEFAULT_QUESTION='นี่มันตัวอะไรเนี่ย?';
  const state={title:'เกมของฉัน',items:[],nextId:1};

  const appMain=$('[data-ui="main"]');
  const list=$('[data-ui="items"]'),template=$('#item-template'),count=$('[data-ui="count"]'),status=$('[data-ui="status"]'),toast=$('[data-ui="toast"]');
  const toastMessage=$('[data-ui="toast-message"]'),undoButton=$('[data-action="undo-remove"]');
  const readinessText=$('[data-ui="readiness-text"]'),readinessBar=$('[data-ui="readiness-bar"]'),readinessDetail=$('[data-ui="readiness-detail"]'),footerSummary=$('[data-ui="footer-summary"]');
  const clearModal=$('[data-ui="clear-modal"]'),leaveModal=$('[data-ui="leave-modal"]');

  let toastTimer,lastRemoved=null,isDirty=false,activeModal=null,modalTrigger=null,pendingHref='/';
  const objectUrlMap=new Map();

  const say=(msg,{undo=false,duration=1800}={})=>{
    toastMessage.textContent=msg;
    undoButton.classList.toggle('is-hidden',!undo);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.remove('show'),duration);
  };

  const markDirty=(message='มีแก้นะ ยังไม่ได้เก็บ')=>{isDirty=true;status.textContent=message};
  const markClean=message=>{isDirty=false;if(message)status.textContent=message};

  const clearObjectUrls=()=>{objectUrlMap.forEach(URL.revokeObjectURL);objectUrlMap.clear()};
  window.addEventListener('pagehide',e=>{if(!e.persisted)clearObjectUrls()});
  window.addEventListener('beforeunload',e=>{if(!isDirty)return;e.preventDefault();e.returnValue=''});

  const canvasBlob=(canvas,type='image/webp',quality=.86)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));

  const decodeImage=async file=>{
    if('createImageBitmap' in window){
      const bitmap=await createImageBitmap(file);
      return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      img.decoding='async';
      img.src=url;
      await img.decode();
      return {source:img,width:img.naturalWidth,height:img.naturalHeight,close:()=>{}};
    } finally { URL.revokeObjectURL(url) }
  };

  const resizedBlob=async file=>{
    if(!file.type.startsWith('image/'))throw new Error('อันนี้ไม่ใช่รูปนะ เอารูปจริงมา');
    if(file.size>MAX_SOURCE_BYTES)throw new Error('รูปใหญ่ไปนิด ขอไม่เกิน 15MB');

    let decoded;
    try{
      decoded=await decodeImage(file);
      const encodeAt=async(maxSide,quality)=>{
        const scale=Math.min(1,maxSide/Math.max(decoded.width,decoded.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(decoded.width*scale));
        canvas.height=Math.max(1,Math.round(decoded.height*scale));
        const ctx=canvas.getContext('2d',{alpha:true});
        if(!ctx)throw new Error('เครื่องนี้จัดรูปไม่ไหว ลองเปลี่ยนรูปอีกที');
        ctx.drawImage(decoded.source,0,0,canvas.width,canvas.height);
        return await canvasBlob(canvas,'image/webp',quality)||await canvasBlob(canvas,'image/jpeg',quality);
      };

      let blob=null;
      for(const [maxSide,quality] of [[1600,.86],[1600,.76],[1600,.66],[1280,.76],[1024,.72]]){
        blob=await encodeAt(maxSide,quality);
        if(blob&&blob.size<=TARGET_IMAGE_BYTES)break;
      }
      if(!blob)throw new Error('จัดรูปไม่สำเร็จ ลองใช้ JPG, PNG หรือ WebP');
      if(blob.size>HARD_IMAGE_BYTES)throw new Error('รูปนี้บีบแล้วยังใหญ่ไป ลองใช้รูปที่เล็กลงหน่อย');
      return blob;
    } catch(err){
      if(err instanceof Error&&err.message)throw err;
      throw new Error('เปิดรูปนี้ไม่สำเร็จ ลองเปลี่ยนไฟล์ดู');
    } finally { decoded?.close?.() }
  };

  const completeCount=()=>state.items.filter(x=>x.imageBlob&&x.answer.trim()).length;
  const updateReadiness=()=>{
    const complete=completeCount(),total=state.items.length,pct=total?Math.round((complete/total)*100):0;
    readinessBar.style.width=`${pct}%`;
    footerSummary.textContent=complete?`${complete} จาก ${total} ข้อ พร้อมลุย`:'ยังไม่มีข้อพร้อมลุย';
    if(complete===total&&total>0){readinessText.textContent='ครบแล้ว ลุยได้';readinessDetail.textContent='ของครบทุกข้อ เปิดป้ายได้เลย'}
    else{readinessText.textContent='ยังขาดอีกนิด';readinessDetail.textContent=`อีก ${total-complete} ข้อยังขาดรูปหรือเฉลย`}
    $('[data-action="play"]').disabled=!(complete===total&&total>0);
  };

  const addItem=(source={})=>{
    if(state.items.length>=MAX_ITEMS){say('พอแล้ว 10 ข้อ เดี๋ยวคนเล่นเหนื่อย');return false}
    state.items.push({id:source.id||state.nextId++,question:source.question||DEFAULT_QUESTION,answer:source.answer||'',imageBlob:source.imageBlob||null,imageName:source.imageName||''});
    if(source.id)state.nextId=Math.max(state.nextId,Number(source.id)+1);
    render();return true;
  };

  const removeItem=id=>{
    if(state.items.length<=1){say('อย่างน้อยเหลือไว้ 1 ข้อสิ');return}
    const index=state.items.findIndex(x=>x.id===id);if(index<0)return;
    const item=state.items[index],url=objectUrlMap.get(id);
    if(url){URL.revokeObjectURL(url);objectUrlMap.delete(id)}
    lastRemoved={item,index};state.items.splice(index,1);render();markDirty('ลบข้อแล้ว ยังไม่ได้เก็บ');say(`ลบข้อ ${index+1} แล้ว`,{undo:true,duration:5000});
  };

  const undoRemove=()=>{
    if(!lastRemoved||state.items.length>=MAX_ITEMS)return;
    const {item,index}=lastRemoved;state.items.splice(Math.min(index,state.items.length),0,item);lastRemoved=null;render();markDirty('เอาข้อกลับมาแล้ว ยังไม่ได้เก็บ');say('เอาคืนให้แล้ว');
  };

  const updateItem=(id,key,value)=>{const item=state.items.find(x=>x.id===id);if(item)item[key]=value};
  const previewUrl=item=>{
    if(!item.imageBlob)return'';
    if(objectUrlMap.has(item.id))return objectUrlMap.get(item.id);
    const url=URL.createObjectURL(item.imageBlob);objectUrlMap.set(item.id,url);return url;
  };

  const render=()=>{
    count.textContent=state.items.length;list.innerHTML='';
    state.items.forEach((item,index)=>{
      const node=template.content.firstElementChild.cloneNode(true);node.dataset.id=item.id;
      $('.question-no',node).textContent=String(index+1).padStart(2,'0');$('[data-field="number"]',node).textContent=index+1;
      const q=$('[data-field="question"]',node),a=$('[data-field="answer"]',node),f=$('[data-field="file"]',node),zone=$('[data-field="upload-zone"]',node),img=$('[data-field="preview"]',node),stateText=$('[data-field="state"]',node),change=$('[data-action="choose-image"]',node),imageCheck=$('[data-check="image"]',node),answerCheck=$('[data-check="answer"]',node);
      q.value=item.question;a.value=item.answer;
      const syncState=()=>{
        const hasImage=!!item.imageBlob,hasAnswer=!!item.answer.trim();
        stateText.textContent=hasImage&&hasAnswer?'ครบแล้ว ลุยได้':!hasImage?'ยังขาดรูป':'ยังขาดเฉลย';stateText.classList.toggle('ready',hasImage&&hasAnswer);
        imageCheck.textContent=hasImage?'✓ มีรูป':'○ มีรูป';answerCheck.textContent=hasAnswer?'✓ มีเฉลย':'○ มีเฉลย';imageCheck.classList.toggle('done',hasImage);answerCheck.classList.toggle('done',hasAnswer);updateReadiness();
      };
      if(item.imageBlob){zone.classList.add('has-image');img.src=previewUrl(item);change.classList.remove('is-hidden')}
      q.addEventListener('input',e=>{updateItem(item.id,'question',e.target.value);markDirty()});
      a.addEventListener('input',e=>{updateItem(item.id,'answer',e.target.value);syncState();markDirty()});
      const choose=()=>f.click();zone.addEventListener('click',choose);change.addEventListener('click',choose);
      f.addEventListener('change',async e=>{
        const file=e.target.files?.[0];if(!file)return;
        try{
          status.textContent='กำลังจัดรูปให้...';
          const blob=await resizedBlob(file),old=objectUrlMap.get(item.id);
          if(old){URL.revokeObjectURL(old);objectUrlMap.delete(item.id)}
          updateItem(item.id,'imageBlob',blob);updateItem(item.id,'imageName',file.name);render();markDirty(`จัดรูปแล้ว ${(blob.size/1024/1024).toFixed(1)}MB · ยังไม่ได้เก็บ`);
        }catch(err){say(err.message)}
      });
      $('[data-action="remove-item"]',node).addEventListener('click',()=>removeItem(item.id));syncState();list.appendChild(node);
    });
    $('[data-action="add"]').disabled=state.items.length>=MAX_ITEMS;updateReadiness();
  };

  const validate=()=>{
    const title=$('#game-title').value.trim()||'เกมของฉัน';
    const complete=state.items.filter(x=>x.imageBlob&&x.answer.trim());
    if(!complete.length)throw new Error('อย่างน้อยใส่รูปกับเฉลยสัก 1 ข้อก่อน');
    if(complete.length!==state.items.length)throw new Error('ยังมีข้อไม่ครบ เช็กอีกทีนะ');
    return{version:20.5,title,updatedAt:new Date().toISOString(),questions:complete.map((x,i)=>({id:i+1,question:x.question.trim()||DEFAULT_QUESTION,answer:x.answer.trim(),imageBlob:x.imageBlob,imageName:x.imageName||`image-${i+1}.webp`}))};
  };

  const save=async()=>{
    const game=validate();status.textContent='กำลังเก็บ...';await RevealGameStore.saveActive(game);state.title=game.title;lastRemoved=null;markClean(`เก็บแล้ว · ${game.questions.length} ข้อ`);say('เก็บเกมให้แล้ว');return game;
  };

  const restore=async()=>{
    try{
      const saved=await RevealGameStore.getActive();
      if(saved?.questions?.length){
        $('#game-title').value=saved.title||'เกมของฉัน';state.items=[];state.nextId=1;
        saved.questions.slice(0,MAX_ITEMS).forEach(q=>state.items.push({id:q.id||state.nextId++,question:q.question||DEFAULT_QUESTION,answer:q.answer||'',imageBlob:q.imageBlob||null,imageName:q.imageName||''}));
        state.nextId=Math.max(1,...state.items.map(x=>Number(x.id)||0))+1;render();markClean(`เจอเกมเก่าแล้ว · ${saved.questions.length} ข้อ`);return;
      }
    }catch(e){console.warn(e)}
    addItem();markClean('เริ่มชุดใหม่ได้เลย');
  };

  const modalFocusables=modal=>$$('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])',modal).filter(el=>!el.classList.contains('is-hidden'));
  const showModal=(modal,trigger)=>{
    activeModal=modal;modalTrigger=trigger||document.activeElement;modal.classList.remove('is-hidden');document.body.classList.add('modal-open');appMain.inert=true;appMain.setAttribute('aria-hidden','true');
    requestAnimationFrame(()=>modalFocusables(modal)[0]?.focus());
  };
  const hideModal=modal=>{
    modal.classList.add('is-hidden');document.body.classList.remove('modal-open');appMain.inert=false;appMain.removeAttribute('aria-hidden');activeModal=null;const trigger=modalTrigger;modalTrigger=null;trigger?.focus?.();
  };
  const trapModalFocus=e=>{
    if(!activeModal||e.key!=='Tab')return;
    const items=modalFocusables(activeModal);if(!items.length){e.preventDefault();activeModal.querySelector('[role="dialog"]')?.focus();return}
    const first=items[0],last=items.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  };

  const clearGame=async()=>{
    await RevealGameStore.clearActive();clearObjectUrls();lastRemoved=null;state.items=[];state.nextId=1;$('#game-title').value='เกมของฉัน';addItem();hideModal(clearModal);markClean('โล่งเลย เริ่มใหม่ได้');say('ล้างให้แล้ว');
  };

  $('#game-title').addEventListener('input',()=>markDirty());
  $('[data-action="add"]').addEventListener('click',()=>{if(addItem()){markDirty('เพิ่มข้อใหม่แล้ว ยังไม่ได้เก็บ');requestAnimationFrame(()=>$$('[data-item]').at(-1)?.scrollIntoView({behavior:'smooth',block:'center'}))}});
  $('[data-action="save"]').addEventListener('click',()=>save().catch(e=>say(e.message)));
  $('[data-action="play"]').addEventListener('click',async()=>{try{await save();location.href='/?custom=1'}catch(e){say(e.message)}});
  $('[data-action="clear"]').addEventListener('click',e=>showModal(clearModal,e.currentTarget));
  $('[data-action="cancel-clear"]').addEventListener('click',()=>hideModal(clearModal));
  $('[data-action="confirm-clear"]').addEventListener('click',()=>clearGame().catch(e=>say(e.message)));
  clearModal.addEventListener('click',e=>{if(e.target===clearModal)hideModal(clearModal)});

  $('[data-action="leave-home"]').addEventListener('click',e=>{
    e.preventDefault();pendingHref=e.currentTarget.href||'/';
    if(!isDirty){location.href=pendingHref;return}
    showModal(leaveModal,e.currentTarget);
  });
  $('[data-action="cancel-leave"]').addEventListener('click',()=>hideModal(leaveModal));
  $('[data-action="discard-leave"]').addEventListener('click',()=>{isDirty=false;location.href=pendingHref});
  leaveModal.addEventListener('click',e=>{if(e.target===leaveModal)hideModal(leaveModal)});

  undoButton.addEventListener('click',undoRemove);
  document.addEventListener('keydown',e=>{
    trapModalFocus(e);
    if(e.key==='Escape'&&activeModal){const modal=activeModal;hideModal(modal)}
  });

  restore();
})();
