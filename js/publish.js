(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const META_KEY='reveal-game-publish-v21';
  const IMPORT_PREFIX='reveal-game-imported:';
  const publishButton=$('[data-action="publish"]');
  const shareStatus=$('[data-ui="share-status"]');
  const shareModal=$('[data-ui="share-modal"]');
  const shareInput=$('[data-ui="share-link"]');
  const saveButton=$('[data-action="save"]');
  const playButton=$('[data-action="play"]');
  const appMain=$('[data-ui="main"]');

  if(!publishButton||!shareStatus||!shareModal||!shareInput||!saveButton||!playButton||!appMain||!window.RevealShareApi||!window.RevealGameStore)return;

  let busy=false;
  let statusMode='idle';

  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const readMeta=()=>{try{return JSON.parse(localStorage.getItem(META_KEY)||'null')}catch{return null}};
  const writeMeta=value=>localStorage.setItem(META_KEY,JSON.stringify(value));
  const clearMeta=()=>localStorage.removeItem(META_KEY);
  const clearImportFlags=()=>{for(const key of Object.keys(sessionStorage)){if(key.startsWith(IMPORT_PREFIX))sessionStorage.removeItem(key)}};
  const hashToken=()=>new URLSearchParams(location.hash.replace(/^#/,'' )).get('token')||'';

  const errorText=code=>({
    save_failed:'บันทึกไม่สำเร็จ ลองใหม่อีกที',
    game_empty:'ยังไม่มีเกมให้สร้างลิงก์',
    image_missing:'มีข้อที่รูปหาย',
    invalid_edit_token:'ลิงก์นี้แก้ไขไม่ได้',
    edit_token_required:'ลิงก์นี้แก้ไขไม่ได้',
    game_not_found:'หาเกมนี้ไม่เจอ',
    image_too_large:'มีรูปใหญ่เกินไป',
    images_too_large:'รูปทั้งหมดใหญ่เกินไป',
    backend_unavailable:'สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกที'
  }[code]||'สร้างลิงก์ไม่สำเร็จ ลองใหม่อีกที');

  const setStatus=(message,mode='idle')=>{
    statusMode=mode;
    shareStatus.textContent=message;
    shareStatus.classList.toggle('ready',mode==='success');
    shareStatus.classList.toggle('error',mode==='error');
  };

  const refreshAvailability=({force=false}={})=>{
    const complete=!playButton.disabled;
    publishButton.disabled=busy||!complete;
    if(busy){
      publishButton.textContent='กำลังสร้างลิงก์...';
      return;
    }
    publishButton.textContent='สร้างลิงก์';
    if(force||statusMode==='idle'){
      setStatus(complete?'พร้อมส่งให้เพื่อนเล่น':'ใส่รูปและเฉลยให้ครบก่อน');
    }
  };

  const markShareDirty=()=>{
    if(busy)return;
    const complete=!playButton.disabled;
    setStatus(complete&&readMeta()?.slug?'มีการแก้ไข · สร้างลิงก์อีกครั้งเพื่ออัปเดต':complete?'พร้อมส่งให้เพื่อนเล่น':'ใส่รูปและเฉลยให้ครบก่อน');
    refreshAvailability();
  };

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
  const buildShareUrl=slug=>{
    const url=new URL('/',location.origin);
    url.searchParams.set('share',String(slug||''));
    return url.toString();
  };

  const openShare=slug=>{
    shareInput.value=buildShareUrl(slug);
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
    const old=button.textContent;
    button.textContent='คัดลอกแล้ว ✓';
    setTimeout(()=>button.textContent=old,1400);
  };

  const publishGame=async()=>{
    if(publishButton.disabled||busy)return;
    busy=true;
    setStatus('กำลังเตรียมลิงก์...');
    refreshAvailability();
    try{
      const game=await waitForFreshSave();
      const meta=readMeta();
      const result=meta?.slug&&meta?.editToken
        ? await RevealShareApi.update(meta.slug,meta.editToken,game)
        : await RevealShareApi.publish(game);
      const next={slug:result.slug||meta?.slug,editToken:result.editToken||meta?.editToken};
      if(!next.slug||!next.editToken)throw new Error('backend_unavailable');
      writeMeta(next);
      setStatus('ลิงก์พร้อมแล้ว', 'success');
      openShare(next.slug);
    }catch(error){
      console.error(error);
      setStatus(errorText(error.code||error.message),'error');
    }finally{
      busy=false;
      refreshAvailability();
    }
  };

  const importRemoteEdit=async()=>{
    const slug=new URLSearchParams(location.search).get('edit');
    if(!slug)return;
    const token=hashToken();
    if(!token){setStatus('ลิงก์นี้แก้ไขไม่ได้','error');return}
    writeMeta({slug,editToken:token});
    const importKey=`${IMPORT_PREFIX}${slug}`;
    if(sessionStorage.getItem(importKey)==='1')return;
    setStatus('กำลังโหลดเกม...');
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
      console.error(error);setStatus(errorText(error.code||error.message),'error');
    }
  };

  publishButton.addEventListener('click',publishGame);
  $$('[data-action="close-share"]').forEach(btn=>btn.addEventListener('click',closeShare));
  shareModal.addEventListener('click',e=>{if(e.target===shareModal)closeShare()});
  $('[data-action="copy-share"]')?.addEventListener('click',e=>copyField(shareInput,e.currentTarget));
  $('[data-action="open-shared"]')?.addEventListener('click',()=>{if(shareInput.value)window.open(shareInput.value,'_blank','noopener')});
  $('[data-action="confirm-clear"]')?.addEventListener('click',()=>{clearMeta();clearImportFlags();setStatus('ใส่รูปและเฉลยให้ครบก่อน')});

  new MutationObserver(()=>refreshAvailability({force:statusMode!=='success'&&statusMode!=='error'})).observe(playButton,{attributes:true,attributeFilter:['disabled']});
  appMain.addEventListener('input',markShareDirty,true);
  appMain.addEventListener('change',markShareDirty,true);
  appMain.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(['add','remove-item','apply-image-edit','choose-image','edit-image','clear'].includes(action))setTimeout(markShareDirty,0);
  },true);

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
    try{await importRemoteEdit()}catch(error){console.warn(error)}
    refreshAvailability({force:true});
  })();
})();
