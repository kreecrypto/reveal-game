(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s);
  const META_KEY='reveal-game-publish-v21';
  const IMPORT_PREFIX='reveal-game-imported:';
  const publishButton=$('[data-action="publish"]');
  const cloudStatus=$('[data-ui="cloud-status"]');
  const shareModal=$('[data-ui="share-modal"]');
  const shareInput=$('[data-ui="share-link"]');
  const editInput=$('[data-ui="edit-link"]');
  const publishState=$('[data-ui="publish-state"]');
  const saveButton=$('[data-action="save"]');
  const status=$('[data-ui="status"]');

  if(!publishButton||!window.RevealShareApi||!window.RevealGameStore)return;

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const readMeta=()=>{try{return JSON.parse(localStorage.getItem(META_KEY)||'null')}catch{return null}};
  const writeMeta=value=>localStorage.setItem(META_KEY,JSON.stringify(value));
  const clearMeta=()=>localStorage.removeItem(META_KEY);
  const hashToken=()=>{
    const raw=location.hash.replace(/^#/,'');
    const params=new URLSearchParams(raw);
    return params.get('token')||'';
  };
  const setCloud=(message,ready=false)=>{
    cloudStatus.textContent=message;
    cloudStatus.classList.toggle('ready',ready);
    publishButton.disabled=!ready;
  };

  const errorText=code=>({
    save_failed:'เก็บเกมในเครื่องไม่สำเร็จ ลองเช็กข้อมูลให้ครบก่อน',
    game_empty:'ยังไม่มีเกมให้แชร์',
    image_missing:'มีข้อที่รูปหาย ลองเลือกรูปใหม่',
    invalid_edit_token:'ลิงก์แก้ไขไม่ถูกต้อง',
    edit_token_required:'ไม่เจอกุญแจแก้เกม',
    game_not_found:'หาเกมที่แชร์นี้ไม่เจอ',
    image_too_large:'มีรูปใหญ่เกินไป ลองจัดรูปใหม่',
    backend_unavailable:'Cloud ยังไม่พร้อม ลองใหม่อีกที'
  }[code]||'แชร์ไม่สำเร็จ ลองใหม่อีกที');

  const waitForFreshSave=async()=>{
    const before=await RevealGameStore.getActive();
    const beforeStamp=before?.updatedAt||'';
    saveButton.click();
    const deadline=Date.now()+5000;
    while(Date.now()<deadline){
      await sleep(100);
      const current=await RevealGameStore.getActive();
      if(current?.updatedAt&&current.updatedAt!==beforeStamp)return current;
    }
    throw new Error('save_failed');
  };

  const openShare=(slug,editToken)=>{
    const publicUrl=`${location.origin}/game/${encodeURIComponent(slug)}`;
    const editUrl=`${location.origin}/setup.html?edit=${encodeURIComponent(slug)}#token=${encodeURIComponent(editToken)}`;
    shareInput.value=publicUrl;editInput.value=editUrl;
    shareModal.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    requestAnimationFrame(()=>shareModal.querySelector('button')?.focus());
  };

  const closeShare=()=>{
    shareModal.classList.add('is-hidden');
    document.body.classList.remove('modal-open');
    publishButton.focus();
  };

  const copyField=async(input,button)=>{
    try{await navigator.clipboard.writeText(input.value)}catch{
      input.focus();input.select();document.execCommand?.('copy');
    }
    const old=button.textContent;button.textContent='คัดลอกแล้ว ✓';setTimeout(()=>button.textContent=old,1400);
  };

  const publishGame=async()=>{
    if(publishButton.disabled)return;
    publishButton.disabled=true;
    const oldText=publishButton.textContent;
    publishButton.textContent='กำลังส่งขึ้น Cloud...';
    publishState.textContent='กำลังเก็บ Draft ก่อน แล้วค่อยเผยแพร่';
    try{
      const game=await waitForFreshSave();
      const meta=readMeta();
      const result=meta?.slug&&meta?.editToken
        ? await RevealShareApi.update(meta.slug,meta.editToken,game)
        : await RevealShareApi.publish(game);
      const next={slug:result.slug||meta?.slug,editToken:result.editToken||meta?.editToken};
      if(!next.slug||!next.editToken)throw new Error('backend_unavailable');
      writeMeta(next);
      publishState.textContent=`เผยแพร่แล้ว · ${game.questions.length} ข้อ`;
      openShare(next.slug,next.editToken);
    }catch(error){
      console.error(error);
      publishState.textContent=errorText(error.code||error.message);
    }finally{
      publishButton.textContent=oldText;
      try{await RevealShareApi.health();publishButton.disabled=false}catch{publishButton.disabled=true}
    }
  };

  const importRemoteEdit=async()=>{
    const slug=new URLSearchParams(location.search).get('edit');
    if(!slug)return;
    const token=hashToken();
    if(!token){publishState.textContent='ลิงก์แก้เกมนี้ไม่มีกุญแจแก้ไข';return}
    writeMeta({slug,editToken:token});
    const importKey=`${IMPORT_PREFIX}${slug}`;
    if(sessionStorage.getItem(importKey)==='1')return;
    publishState.textContent='กำลังดึงเกมจาก Cloud ลงเครื่องนี้...';
    try{
      const remote=await RevealShareApi.fetchGame(slug);
      const questions=[];
      for(let i=0;i<remote.questions.length;i++){
        const q=remote.questions[i];
        const response=await fetch(q.image,{cache:'no-store'});
        if(!response.ok)throw new Error('image_missing');
        const blob=await response.blob();
        questions.push({
          id:i+1,question:q.question,answer:q.answer,imageBlob:blob,sourceImageBlob:blob,imageCrop:null,imageName:`shared-${i+1}.webp`
        });
      }
      await RevealGameStore.saveActive({version:21,title:remote.game.title,updatedAt:new Date().toISOString(),questions});
      sessionStorage.setItem(importKey,'1');
      location.reload();
    }catch(error){
      console.error(error);publishState.textContent=errorText(error.code||error.message);
    }
  };

  publishButton.addEventListener('click',publishGame);
  $('[data-action="close-share"]')?.addEventListener('click',closeShare);
  shareModal?.addEventListener('click',e=>{if(e.target===shareModal)closeShare()});
  $('[data-action="copy-share"]')?.addEventListener('click',e=>copyField(shareInput,e.currentTarget));
  $('[data-action="copy-edit"]')?.addEventListener('click',e=>copyField(editInput,e.currentTarget));
  $('[data-action="open-shared"]')?.addEventListener('click',()=>{if(shareInput.value)location.href=shareInput.value});
  $('[data-action="confirm-clear"]')?.addEventListener('click',()=>{clearMeta();sessionStorage.clear()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shareModal.classList.contains('is-hidden'))closeShare()});

  (async()=>{
    try{
      await importRemoteEdit();
      await RevealShareApi.health();
      setCloud('Cloud พร้อมแชร์ · D1 + R2',true);
      const meta=readMeta();
      if(meta?.slug)publishState.textContent=`เกมนี้เคยเผยแพร่แล้ว · ${meta.slug}`;
    }catch(error){
      console.warn('share backend unavailable',error);
      setCloud('Cloud ยังไม่เชื่อม · Draft ในเครื่องยังใช้ได้',false);
      publishState.textContent='ตอนนี้ยังเก็บและเล่นในเครื่องได้ตามปกติ';
    }
  })();
})();
