(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const MAX_ITEMS=10;
  const MAX_SOURCE_BYTES=15*1024*1024;
  const TARGET_SOURCE_BYTES=1.8*1024*1024;
  const HARD_SOURCE_BYTES=3*1024*1024;
  const TARGET_CROP_BYTES=1.2*1024*1024;
  const HARD_CROP_BYTES=2.5*1024*1024;
  const EDITOR_SIZE=1024;
  const MIN_ZOOM=1;
  const MAX_ZOOM=3;
  const DEFAULT_QUESTION='นี่มันตัวอะไรเนี่ย?';
  const state={title:'เกมของฉัน',items:[],nextId:1};

  const appMain=$('[data-ui="main"]');
  const list=$('[data-ui="items"]'),template=$('#item-template'),count=$('[data-ui="count"]'),status=$('[data-ui="status"]'),toast=$('[data-ui="toast"]');
  const toastMessage=$('[data-ui="toast-message"]'),undoButton=$('[data-action="undo-remove"]');
  const readinessText=$('[data-ui="readiness-text"]'),readinessBar=$('[data-ui="readiness-bar"]'),readinessDetail=$('[data-ui="readiness-detail"]'),footerSummary=$('[data-ui="footer-summary"]');
  const clearModal=$('[data-ui="clear-modal"]'),leaveModal=$('[data-ui="leave-modal"]'),imageEditorModal=$('[data-ui="image-editor-modal"]');
  const editorCanvas=$('[data-ui="image-editor-canvas"]'),zoomInput=$('[data-ui="image-zoom"]'),zoomValue=$('[data-ui="zoom-value"]');
  const editorCtx=editorCanvas.getContext('2d',{alpha:true});

  let toastTimer,lastRemoved=null,isDirty=false,activeModal=null,modalTrigger=null,pendingHref='/';
  const objectUrlMap=new Map();
  const pointerMap=new Map();
  let gesture=null;
  const editor={itemId:null,sourceBlob:null,imageName:'',decoded:null,zoom:1,offsetX:0,offsetY:0,statusBefore:'',busy:false};

  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
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
  const cleanupEditorSource=()=>{editor.decoded?.close?.();editor.decoded=null;editor.sourceBlob=null;pointerMap.clear();gesture=null};
  window.addEventListener('pagehide',e=>{if(!e.persisted){clearObjectUrls();cleanupEditorSource()}});
  window.addEventListener('beforeunload',e=>{if(!isDirty)return;e.preventDefault();e.returnValue=''});

  const canvasBlob=(canvas,type='image/webp',quality=.86)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));

  const decodeViaImage=async file=>{
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();
      img.decoding='async';
      img.src=url;
      await img.decode();
      return {source:img,width:img.naturalWidth,height:img.naturalHeight,close:()=>{}};
    } finally { URL.revokeObjectURL(url) }
  };

  const decodeImage=async file=>{
    if('createImageBitmap' in window){
      try{
        const bitmap=await createImageBitmap(file);
        return {source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
      }catch(err){console.warn('createImageBitmap failed, using Image fallback',err)}
    }
    return decodeViaImage(file);
  };

  const prepareSourceBlob=async file=>{
    if(!file.type.startsWith('image/'))throw new Error('อันนี้ไม่ใช่รูปนะ เอารูปจริงมา');
    if(file.size>MAX_SOURCE_BYTES)throw new Error('รูปใหญ่ไปนิด ขอไม่เกิน 15MB');

    let decoded;
    try{
      decoded=await decodeImage(file);
      if(!decoded.width||!decoded.height)throw new Error('รูปนี้อ่านขนาดไม่ได้ ลองเปลี่ยนไฟล์ดู');
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
      for(const [maxSide,quality] of [[1600,.88],[1600,.78],[1440,.75],[1280,.72],[1024,.70]]){
        blob=await encodeAt(maxSide,quality);
        if(blob&&blob.size<=TARGET_SOURCE_BYTES)break;
      }
      if(!blob)throw new Error('จัดรูปไม่สำเร็จ ลองใช้ JPG, PNG หรือ WebP');
      if(blob.size>HARD_SOURCE_BYTES)throw new Error('รูปนี้บีบแล้วยังใหญ่ไป ลองใช้รูปที่เล็กลงหน่อย');
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
    state.items.push({
      id:source.id||state.nextId++,
      question:source.question||DEFAULT_QUESTION,
      answer:source.answer||'',
      imageBlob:source.imageBlob||null,
      sourceImageBlob:source.sourceImageBlob||source.imageBlob||null,
      imageCrop:source.imageCrop||null,
      imageName:source.imageName||''
    });
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
  const getItem=id=>state.items.find(x=>x.id===id)||null;
  const previewUrl=item=>{
    if(!item.imageBlob)return'';
    if(objectUrlMap.has(item.id))return objectUrlMap.get(item.id);
    const url=URL.createObjectURL(item.imageBlob);objectUrlMap.set(item.id,url);return url;
  };
  const invalidatePreview=id=>{
    const old=objectUrlMap.get(id);
    if(old){URL.revokeObjectURL(old);objectUrlMap.delete(id)}
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

  const editorTransform=()=>{
    if(!editor.decoded)return null;
    const baseScale=EDITOR_SIZE/Math.min(editor.decoded.width,editor.decoded.height);
    const scale=baseScale*editor.zoom;
    const width=editor.decoded.width*scale,height=editor.decoded.height*scale;
    const maxX=Math.max(0,(width-EDITOR_SIZE)/2),maxY=Math.max(0,(height-EDITOR_SIZE)/2);
    editor.offsetX=clamp(editor.offsetX,-maxX,maxX);
    editor.offsetY=clamp(editor.offsetY,-maxY,maxY);
    return {scale,width,height,x:(EDITOR_SIZE-width)/2+editor.offsetX,y:(EDITOR_SIZE-height)/2+editor.offsetY,maxX,maxY};
  };

  const renderEditor=()=>{
    if(!editorCtx||!editor.decoded)return;
    const t=editorTransform();
    editorCtx.clearRect(0,0,EDITOR_SIZE,EDITOR_SIZE);
    editorCtx.imageSmoothingEnabled=true;
    editorCtx.imageSmoothingQuality='high';
    editorCtx.drawImage(editor.decoded.source,t.x,t.y,t.width,t.height);
    zoomInput.value=editor.zoom.toFixed(2);
    zoomValue.textContent=`${editor.zoom.toFixed(2)}×`;
    $('[data-action="zoom-out"]').disabled=editor.zoom<=MIN_ZOOM+.001;
    $('[data-action="zoom-in"]').disabled=editor.zoom>=MAX_ZOOM-.001;
  };

  const setEditorView=(zoom,offsetX=editor.offsetX,offsetY=editor.offsetY)=>{
    editor.zoom=clamp(Number(zoom)||MIN_ZOOM,MIN_ZOOM,MAX_ZOOM);
    editor.offsetX=offsetX;editor.offsetY=offsetY;renderEditor();
  };

  const resetEditor=()=>setEditorView(1,0,0);

  const closeImageEditor=({restoreStatus=true}={})=>{
    if(activeModal===imageEditorModal)hideModal(imageEditorModal);
    if(restoreStatus&&editor.statusBefore)status.textContent=editor.statusBefore;
    cleanupEditorSource();
    editor.itemId=null;editor.imageName='';editor.zoom=1;editor.offsetX=0;editor.offsetY=0;editor.statusBefore='';editor.busy=false;
  };

  const openImageEditor=async(itemId,sourceBlob,{imageName='',crop=null,trigger=null}={})=>{
    if(!sourceBlob)throw new Error('ยังไม่มีรูปให้แก้นะ');
    if(!editorCtx)throw new Error('เครื่องนี้เปิดตัวแก้รูปไม่ได้ ลองใช้ Browser อื่นดู');
    cleanupEditorSource();
    editor.statusBefore=status.textContent;
    status.textContent='กำลังเปิดโต๊ะแต่งรูป...';
    try{
      editor.decoded=await decodeImage(sourceBlob);
      if(!editor.decoded.width||!editor.decoded.height)throw new Error('รูปนี้เปิดแก้ไม่ได้ ลองเปลี่ยนรูปดู');
      editor.itemId=itemId;editor.sourceBlob=sourceBlob;editor.imageName=imageName||'image.webp';
      editor.zoom=clamp(Number(crop?.zoom)||1,MIN_ZOOM,MAX_ZOOM);
      editor.offsetX=Number.isFinite(Number(crop?.offsetX))?Number(crop.offsetX):0;
      editor.offsetY=Number.isFinite(Number(crop?.offsetY))?Number(crop.offsetY):0;
      showModal(imageEditorModal,trigger);
      status.textContent='กำลังจัดรูปอยู่ · กด “ใช้รูปนี้” ถึงจะเปลี่ยนจริง';
      renderEditor();
    }catch(err){cleanupEditorSource();status.textContent=editor.statusBefore;throw err}
  };

  const encodeCrop=async()=>{
    renderEditor();
    let blob=null;
    for(const quality of [.90,.82,.74,.66]){
      blob=await canvasBlob(editorCanvas,'image/webp',quality)||await canvasBlob(editorCanvas,'image/jpeg',quality);
      if(blob&&blob.size<=TARGET_CROP_BYTES)break;
    }
    if(!blob)throw new Error('ครอปรูปไม่สำเร็จ ลองใหม่อีกที');
    if(blob.size>HARD_CROP_BYTES)throw new Error('รูปหลังครอปยังหนักไป ลองซูมน้อยลงหรือเปลี่ยนรูป');
    return blob;
  };

  const applyImageEdit=async()=>{
    if(editor.busy||!editor.itemId||!editor.sourceBlob)return;
    editor.busy=true;
    const applyButton=$('[data-action="apply-image-edit"]');
    applyButton.disabled=true;applyButton.textContent='กำลังจัดให้...';
    try{
      const item=getItem(editor.itemId);if(!item)throw new Error('หาข้อนี้ไม่เจอ ลองปิดแล้วเปิดใหม่');
      const appliedId=item.id;
      const blob=await encodeCrop();
      const crop={zoom:Number(editor.zoom.toFixed(4)),offsetX:Number(editor.offsetX.toFixed(2)),offsetY:Number(editor.offsetY.toFixed(2))};
      invalidatePreview(item.id);
      item.sourceImageBlob=editor.sourceBlob;item.imageBlob=blob;item.imageCrop=crop;item.imageName=editor.imageName||item.imageName||'image.webp';
      closeImageEditor({restoreStatus:false});
      render();
      requestAnimationFrame(()=>{
        const card=$(`[data-item][data-id="${appliedId}"]`);
        $('[data-action="edit-image"]',card)?.focus();
      });
      markDirty(`จัดรูปแล้ว ${(blob.size/1024/1024).toFixed(1)}MB · ยังไม่ได้เก็บ`);
      say('จัดรูปให้แล้ว ✨');
    }catch(err){say(err.message,{duration:2600})}
    finally{editor.busy=false;applyButton.disabled=false;applyButton.textContent='ใช้รูปนี้'}
  };

  const pointerDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const pointerCenter=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const canvasRatio=()=>EDITOR_SIZE/Math.max(1,editorCanvas.getBoundingClientRect().width);
  const beginGesture=()=>{
    const points=[...pointerMap.values()];
    if(points.length===1){gesture={mode:'drag',point:{...points[0]},offsetX:editor.offsetX,offsetY:editor.offsetY}}
    else if(points.length>=2){const [a,b]=points;gesture={mode:'pinch',distance:Math.max(1,pointerDistance(a,b)),center:pointerCenter(a,b),zoom:editor.zoom,offsetX:editor.offsetX,offsetY:editor.offsetY}}
    else gesture=null;
  };

  editorCanvas.addEventListener('pointerdown',e=>{
    if(!editor.decoded)return;
    e.preventDefault();editorCanvas.setPointerCapture?.(e.pointerId);pointerMap.set(e.pointerId,{x:e.clientX,y:e.clientY});beginGesture();
  });
  editorCanvas.addEventListener('pointermove',e=>{
    if(!pointerMap.has(e.pointerId)||!editor.decoded)return;
    e.preventDefault();pointerMap.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const points=[...pointerMap.values()],ratio=canvasRatio();
    if(points.length===1&&gesture?.mode==='drag'){
      const p=points[0];setEditorView(editor.zoom,gesture.offsetX+(p.x-gesture.point.x)*ratio,gesture.offsetY+(p.y-gesture.point.y)*ratio);
    }else if(points.length>=2){
      if(gesture?.mode!=='pinch')beginGesture();
      const [a,b]=points,center=pointerCenter(a,b),distance=Math.max(1,pointerDistance(a,b));
      const nextZoom=clamp(gesture.zoom*(distance/gesture.distance),MIN_ZOOM,MAX_ZOOM);
      setEditorView(nextZoom,gesture.offsetX+(center.x-gesture.center.x)*ratio,gesture.offsetY+(center.y-gesture.center.y)*ratio);
    }
  });
  const endPointer=e=>{
    if(pointerMap.has(e.pointerId))pointerMap.delete(e.pointerId);
    try{editorCanvas.releasePointerCapture?.(e.pointerId)}catch{}
    beginGesture();
  };
  editorCanvas.addEventListener('pointerup',endPointer);editorCanvas.addEventListener('pointercancel',endPointer);
  editorCanvas.addEventListener('wheel',e=>{if(!editor.decoded)return;e.preventDefault();setEditorView(editor.zoom+(e.deltaY<0?.08:-.08))},{passive:false});
  zoomInput.addEventListener('input',e=>setEditorView(e.target.value));
  $('[data-action="zoom-out"]').addEventListener('click',()=>setEditorView(editor.zoom-.1));
  $('[data-action="zoom-in"]').addEventListener('click',()=>setEditorView(editor.zoom+.1));
  $('[data-action="reset-image-edit"]').addEventListener('click',resetEditor);
  $$('[data-action="cancel-image-edit"]').forEach(btn=>btn.addEventListener('click',()=>closeImageEditor()));
  $('[data-action="apply-image-edit"]').addEventListener('click',()=>applyImageEdit());
  imageEditorModal.addEventListener('click',e=>{if(e.target===imageEditorModal)closeImageEditor()});

  const render=()=>{
    count.textContent=state.items.length;list.innerHTML='';
    state.items.forEach((item,index)=>{
      const node=template.content.firstElementChild.cloneNode(true);node.dataset.id=item.id;
      $('.question-no',node).textContent=String(index+1).padStart(2,'0');$('[data-field="number"]',node).textContent=index+1;
      const q=$('[data-field="question"]',node),a=$('[data-field="answer"]',node),f=$('[data-field="file"]',node),zone=$('[data-field="upload-zone"]',node),img=$('[data-field="preview"]',node),stateText=$('[data-field="state"]',node),change=$('[data-action="choose-image"]',node),edit=$('[data-action="edit-image"]',node),imageActions=$('[data-field="image-actions"]',node),imageCheck=$('[data-check="image"]',node),answerCheck=$('[data-check="answer"]',node);
      q.value=item.question;a.value=item.answer;
      const syncState=()=>{
        const hasImage=!!item.imageBlob,hasAnswer=!!item.answer.trim();
        stateText.textContent=hasImage&&hasAnswer?'ครบแล้ว ลุยได้':!hasImage?'ยังขาดรูป':'ยังขาดเฉลย';stateText.classList.toggle('ready',hasImage&&hasAnswer);
        imageCheck.textContent=hasImage?'✓ มีรูป':'○ มีรูป';answerCheck.textContent=hasAnswer?'✓ มีเฉลย':'○ มีเฉลย';imageCheck.classList.toggle('done',hasImage);answerCheck.classList.toggle('done',hasAnswer);updateReadiness();
      };
      if(item.imageBlob){zone.classList.add('has-image');img.src=previewUrl(item);imageActions.classList.remove('is-hidden')}
      q.addEventListener('input',e=>{updateItem(item.id,'question',e.target.value);markDirty()});
      a.addEventListener('input',e=>{updateItem(item.id,'answer',e.target.value);syncState();markDirty()});
      const choose=()=>f.click();
      const openExistingEditor=trigger=>openImageEditor(item.id,item.sourceImageBlob||item.imageBlob,{imageName:item.imageName,crop:item.imageCrop,trigger}).catch(err=>say(err.message,{duration:2600}));
      zone.addEventListener('click',e=>{if(item.imageBlob)openExistingEditor(e.currentTarget);else choose()});
      change.addEventListener('click',choose);edit.addEventListener('click',e=>openExistingEditor(e.currentTarget));
      f.addEventListener('change',async e=>{
        const file=e.target.files?.[0];e.target.value='';if(!file)return;
        const previousStatus=status.textContent;
        try{
          status.textContent='กำลังเตรียมรูปให้แก้...';
          const sourceBlob=await prepareSourceBlob(file);
          status.textContent=previousStatus;
          await openImageEditor(item.id,sourceBlob,{imageName:file.name,crop:null,trigger:zone});
        }catch(err){status.textContent=previousStatus;say(err.message,{duration:2600})}
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
    return{version:20.6,title,updatedAt:new Date().toISOString(),questions:complete.map((x,i)=>({
      id:i+1,question:x.question.trim()||DEFAULT_QUESTION,answer:x.answer.trim(),imageBlob:x.imageBlob,
      sourceImageBlob:x.sourceImageBlob||x.imageBlob,imageCrop:x.imageCrop||null,imageName:x.imageName||`image-${i+1}.webp`
    }))};
  };

  const save=async()=>{
    const game=validate();status.textContent='กำลังเก็บ...';await RevealGameStore.saveActive(game);state.title=game.title;lastRemoved=null;markClean(`เก็บแล้ว · ${game.questions.length} ข้อ`);say('เก็บเกมให้แล้ว');return game;
  };

  const restore=async()=>{
    try{
      const saved=await RevealGameStore.getActive();
      if(saved?.questions?.length){
        $('#game-title').value=saved.title||'เกมของฉัน';state.items=[];state.nextId=1;
        saved.questions.slice(0,MAX_ITEMS).forEach(q=>state.items.push({
          id:q.id||state.nextId++,question:q.question||DEFAULT_QUESTION,answer:q.answer||'',imageBlob:q.imageBlob||null,
          sourceImageBlob:q.sourceImageBlob||q.imageBlob||null,imageCrop:q.imageCrop||null,imageName:q.imageName||''
        }));
        state.nextId=Math.max(1,...state.items.map(x=>Number(x.id)||0))+1;render();markClean(`เจอเกมเก่าแล้ว · ${saved.questions.length} ข้อ`);return;
      }
    }catch(e){console.warn(e)}
    addItem();markClean('เริ่มชุดใหม่ได้เลย');
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
    if(e.key==='Escape'&&activeModal){
      if(activeModal===imageEditorModal)closeImageEditor();
      else{const modal=activeModal;hideModal(modal)}
    }
  });

  restore();
})();
