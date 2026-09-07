(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const META_KEY='reveal-game-publish-v21';
  const IMPORT_PREFIX='reveal-game-imported:';
  const publishButton=$('[data-action="publish"]');
  const cloudStatus=$('[data-ui="cloud-status"]');
  const shareModal=$('[data-ui="share-modal"]');
  const shareInput=$('[data-ui="share-link"]');
  const nativeShareButton=$('[data-action="native-share"]');
  const saveButton=$('[data-action="save"]');
  const appMain=$('[data-ui="main"]');

  if(!publishButton||!window.RevealShareApi||!window.RevealGameStore)return;

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const readMeta=()=>{try{return JSON.parse(localStorage.getItem(META_KEY)||'null')}catch{return null}};
  const writeMeta=value=>localStorage.setItem(META_KEY,JSON.stringify(value));
  const clearMeta=()=>localStorage.removeItem(META_KEY);
  const clearImportFlags=()=>{for(const key of Object.keys(sessionStorage)){if(key.startsWith(IMPORT_PREFIX))sessionStorage.removeItem(key)}};
  const hashToken=()=>new URLSearchParams(location.hash.replace(/^#/,'' )).get('token')||'';
  const setCloud=(message,ready=false)=>{
    cloudStatus.textContent=message;
    cloudStatus.classList.toggle('ready',ready);
    publishButton.disabled=!ready;
  };

  const errorText=code=>({
    save_failed:'บันทึกไม่สำเร็จ',
    game_empty:'ยังไม่มีเกมให้แชร์',
    image_missing:'มีข้อที่รูปหาย',
    invalid_edit_token:'สิทธิ์แก้ไขไม่ถูกต้อง',
    edit_token_required:'สิทธิ์แก้ไขไม่ถูกต้อง',
    game_not_found:'หาเกมนี้ไม่เจอ',
    image_too_large:'มีรูปใหญ่เกินไป',
    images_too_large:'รูปทั้งหมดใหญ่เกินไป',
    backend_unavailable:'แชร์ยังไม่พร้อม'
  }[code]||'แชร์ไม่สำเร็จ');

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

  const shareFocusables=()=>$$('button:not([disabled]),input:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',shareModal).filter(el=>!el.classList.contains('is-hidden'));
  const openShare=slug=>{
    shareInput.value=`${location.origin}/game/${encodeURIComponent(slug)}`;
    nativeShareButton?.classList.toggle('is-hidden',!navigator.share);
    shareModal.classList.remove('is-hidden');
    document.body.classList.add('modal-open');
    appMain.inert=true;appMain.setAttribute('aria-hidden','true');
    requestAnimationFrame(()=>shareFocusables()[0]?.focus());
  };

  const closeShare=()=>{
    shareModal.classList.add('is-hidden');
    document.body.classList.remove('modal-open');
    appMain.inert=false;appMain.removeAttribute('aria-hidden');
    publishButton.focus();
  };

  const copyField=async(input,button)=>{
    try{await navigator.clipboard.writeText(input.value)}catch{
      input.focus();input.select();document.execCommand?.('copy');
    }
    const old=button.textContent;button.textContent='คัดลอกแล้ว ✓';setTimeout(()=>button.textContent=old,1400);
  };

  const nativeShare=async()=>{
    if(!navigator.share||!shareInput.value)return;
    try{
      await navigator.share({title:$('#game-title')?.value.trim()||'เปิดป้ายดิ',url:shareInput.value});
    }catch(error){
      if(error?.name!=='AbortError')console.warn('native share failed',error);
    }
  };

  const publishGame=async()=>{
    if(publishButton.disabled)return;
    publishButton.disabled=true;
    const oldText=publishButton.textContent;
    publishButton.textContent='กำลังแชร์...';
    try{
      const game=await waitForFreshSave();
      const meta=readMeta();
      const result=meta?.slug&&meta?.editToken
        ? await RevealShareApi.update(meta.slug,meta.editToken,game)
        : await RevealShareApi.publish(game);
      const next={slug:result.slug||meta?.slug,editToken:result.editToken||meta?.editToken};
      if(!next.slug||!next.editToken)throw new Error('backend_unavailable');
      writeMeta(next);
      setCloud('แชร์แล้ว',true);
      openShare(next.slug);
    }catch(error){
      console.error(error);
      cloudStatus.textContent=errorText(error.code||error.message);
    }finally{
      publishButton.textContent=oldText;
      try{await RevealShareApi.health();publishButton.disabled=false}catch{publishButton.disabled=true}
    }
  };

  const importRemoteEdit=async()=>{
    const slug=new URLSearchParams(location.search).get('edit');
    if(!slug)return;
    const token=hashToken();
    if(!token){setCloud('สิทธิ์แก้ไขไม่ถูกต้อง',false);return}
    writeMeta({slug,editToken:token});
    const importKey=`${IMPORT_PREFIX}${slug}`;
    if(sessionStorage.getItem(importKey)==='1')return;
    setCloud('กำลังโหลดเกม...',false);
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
      console.error(error);setCloud(errorText(error.code||error.message),false);
    }
  };

  publishButton.addEventListener('click',publishGame);
  $$('[data-action="close-share"]').forEach(btn=>btn.addEventListener('click',closeShare));
  shareModal?.addEventListener('click',e=>{if(e.target===shareModal)closeShare()});
  $('[data-action="copy-share"]')?.addEventListener('click',e=>copyField(shareInput,e.currentTarget));
  nativeShareButton?.addEventListener('click',nativeShare);
  $('[data-action="open-shared"]')?.addEventListener('click',()=>{if(shareInput.value)location.href=shareInput.value});
  $('[data-action="confirm-clear"]')?.addEventListener('click',()=>{clearMeta();clearImportFlags()});
  document.addEventListener('keydown',e=>{
    if(shareModal.classList.contains('is-hidden'))return;
    if(e.key==='Escape'){e.preventDefault();closeShare();return}
    if(e.key==='Tab'){
      const items=shareFocusables();if(!items.length)return;
      const first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });

  (async()=>{
    try{
      await importRemoteEdit();
      await RevealShareApi.health();
      setCloud('พร้อมแชร์',true);
    }catch(error){
      console.warn('share backend unavailable',error);
      setCloud('แชร์ยังไม่พร้อม',false);
    }
  })();
})();