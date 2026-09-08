(() => {
  'use strict';

  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const ui=n=>$(`[data-ui="${n}"]`),action=n=>$(`[data-action="${n}"]`);
  const DEFAULT_QUESTION='นี่มันตัวอะไรเนี่ย?';
  const META_KEY='reveal-game-publish-v21';
  const params=new URLSearchParams(location.search);
  const shareSlug=params.get('share');
  const state={questions:[],title:'Demo 10 ข้อ',index:0,opened:new Set(),revealed:false,objectUrls:[],mode:shareSlug?'shared':'local'};

  const showScreen=name=>{
    $$('.screen').forEach(x=>x.classList.toggle('is-active',x.dataset.screen===name));
    document.body.dataset.uiScreen=name;
    window.scrollTo(0,0);
  };
  const normalize=data=>{
    if(!Array.isArray(data))throw new Error('ข้อมูลคำถามไม่ถูกต้อง');
    return data.filter(x=>x&&x.image&&String(x.answer??'').trim()).map((x,i)=>({id:x.id??i+1,question:String(x.question||DEFAULT_QUESTION),answer:String(x.answer).trim(),image:String(x.image),alt:String(x.alt||`ภาพคำถาม ${i+1}`)}));
  };

  const clearObjectUrls=()=>{state.objectUrls.forEach(URL.revokeObjectURL);state.objectUrls=[]};
  window.addEventListener('pagehide',e=>{if(!e.persisted)clearObjectUrls()});

  const fromCustomGame=game=>{
    if(!game?.questions?.length)return[];
    clearObjectUrls();
    const questions=game.questions.filter(x=>x?.imageBlob&&String(x?.answer??'').trim()).map((x,i)=>{
      const url=URL.createObjectURL(x.imageBlob);state.objectUrls.push(url);
      return{id:x.id??i+1,question:String(x.question||DEFAULT_QUESTION),answer:String(x.answer).trim(),image:url,alt:String(x.imageName||`ภาพคำถาม ${i+1}`)};
    });
    if(questions.length)state.title=game.title||'เกมของฉัน';
    return questions;
  };

  const fromSharedGame=payload=>{
    const questions=normalize(payload?.questions||[]);
    if(!questions.length)throw new Error('เกมนี้ยังไม่มีข้อให้เล่น');
    state.title=String(payload?.game?.title||'เกมที่แชร์มา');
    return questions;
  };

  const loadQuestions=async()=>{
    if(shareSlug){
      if(!window.RevealShareApi)throw new Error('ระบบแชร์ยังไม่พร้อม');
      try{
        const remote=await RevealShareApi.fetchGame(shareSlug);
        state.questions=fromSharedGame(remote);state.mode='shared';return;
      }catch(e){
        console.error('โหลดเกมแชร์ไม่สำเร็จ',e);
        if(e?.code==='game_not_found')throw new Error('หาเกมจากลิงก์นี้ไม่เจอ');
        throw new Error('โหลดเกมไม่สำเร็จ ลองใหม่อีกที');
      }
    }
    try{
      const custom=await RevealGameStore.getActive(),customQuestions=fromCustomGame(custom);
      if(customQuestions.length){state.questions=customQuestions;return}
    }catch(e){console.warn('โหลดเกมที่ปั้นไว้ไม่สำเร็จ เลยหยิบ Demo มาแทน',e)}
    const res=await fetch('/data/questions.json',{cache:'no-store'});
    if(!res.ok)throw new Error(`โหลดเกมไม่ขึ้น (${res.status})`);
    state.questions=normalize(await res.json());state.title='Demo 10 ข้อ';
    if(!state.questions.length)throw new Error('ไม่มีข้อให้เล่น');
  };

  const tileButtons=()=>$$('[data-tile]',ui('tiles'));
  const ensureTiles=()=>{
    const root=ui('tiles');if(root.children.length===9)return;
    const fragment=document.createDocumentFragment();
    for(let i=0;i<9;i++){
      const btn=document.createElement('button');btn.className='tile';btn.type='button';btn.dataset.tile=String(i);btn.setAttribute('aria-label',`เปิดป้าย ${i+1}`);btn.textContent=String(i+1);
      btn.addEventListener('click',()=>{
        if(state.revealed||state.opened.has(i))return;
        state.opened.add(i);renderTiles();
        requestAnimationFrame(()=>{
          const buttons=tileButtons(),next=buttons.find((candidate,idx)=>idx>i&&!candidate.disabled)||buttons.find(candidate=>!candidate.disabled);
          (next||action('reveal')).focus();
        });
      });
      fragment.appendChild(btn);
    }
    root.replaceChildren(fragment);
  };

  const renderTiles=()=>{
    ensureTiles();
    tileButtons().forEach((btn,i)=>{
      const opened=state.revealed||state.opened.has(i);
      btn.classList.toggle('is-open',opened);btn.disabled=opened;btn.tabIndex=opened?-1:0;btn.setAttribute('aria-hidden',opened?'true':'false');
    });
  };

  const getOwnerEditMeta=()=>{
    if(!shareSlug)return null;
    const stored=RevealGameStore.getShareEdit?.(shareSlug);
    if(stored?.editToken)return stored;
    try{
      const legacy=JSON.parse(localStorage.getItem(META_KEY)||'null');
      if(String(legacy?.slug||'').toLowerCase()===String(shareSlug).toLowerCase()&&legacy?.editToken){
        RevealGameStore.rememberShareEdit?.(legacy);
        return legacy;
      }
    }catch{}
    return null;
  };

  const ownerEditUrl=()=>{
    const meta=getOwnerEditMeta();
    if(!meta?.editToken)return '';
    const url=new URL('/setup.html',location.origin);
    url.searchParams.set('edit',String(shareSlug));
    url.hash=`token=${encodeURIComponent(meta.editToken)}`;
    return url.toString();
  };

  const renderOwnerActions=()=>{
    if(state.mode!=='shared')return;
    const editUrl=ownerEditUrl();
    $$('a[href="/setup.html"]').forEach(link=>{
      if(editUrl){
        link.href=editUrl;
        link.textContent='แก้ไขเกมนี้';
      }else{
        link.href='/setup.html';
        link.textContent='สร้างเกม';
      }
    });
  };

  const renderHome=()=>{
    ui('game-title').textContent=`${state.title} · ${state.questions.length} ข้อ`;
    document.body.dataset.gameMode=state.mode;
    renderOwnerActions();
  };
  const render=()=>{
    const item=state.questions[state.index],total=state.questions.length;
    ui('counter').textContent=`${state.index+1}/${total}`;
    ui('progress').style.width=`${((state.index+1)/total)*100}%`;
    ui('question').textContent=item.question;
    ui('image').src=item.image;
    ui('image').alt=item.alt;
    ui('answer').textContent=state.revealed?item.answer:'';
    ui('answer-panel').classList.toggle('is-hidden',!state.revealed);
    renderTiles();
    action('reveal').classList.toggle('is-hidden',state.revealed);
    action('next').classList.toggle('is-hidden',!state.revealed);
    action('next').textContent=state.index===total-1?'จบเกม':'ข้อต่อไป';
  };

  const resetRound=()=>{state.opened=new Set();state.revealed=false};
  const start=()=>{state.index=0;resetRound();render();showScreen('game');requestAnimationFrame(()=>tileButtons()[0]?.focus())};
  const reveal=()=>{state.revealed=true;state.opened=new Set(Array.from({length:9},(_,i)=>i));render();requestAnimationFrame(()=>action('next').focus())};
  const next=()=>{
    if(state.index<state.questions.length-1){state.index++;resetRound();render();showScreen('game');requestAnimationFrame(()=>tileButtons()[0]?.focus())}
    else showScreen('done');
  };

  const fail=e=>{
    console.error(e);document.body.replaceChildren();
    const main=document.createElement('main');main.style.cssText='max-width:680px;margin:40px auto;padding:20px;font-family:system-ui';
    const h1=document.createElement('h1');h1.textContent='เปิดเกมไม่สำเร็จ';
    const p=document.createElement('p');p.textContent=e instanceof Error?e.message:'เกิดข้อผิดพลาด';
    const actionP=document.createElement('p'),link=document.createElement('a');link.href='/';link.textContent='กลับหน้าแรก';actionP.appendChild(link);main.append(h1,p,actionP);document.body.appendChild(main);
  };

  const init=async()=>{
    try{
      await loadQuestions();ensureTiles();renderHome();showScreen('home');
      action('start').addEventListener('click',start);action('reveal').addEventListener('click',reveal);action('next').addEventListener('click',next);action('restart').addEventListener('click',start);
      $$('[data-action="home"]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();renderHome();showScreen('home')}));
      if(params.get('custom')==='1')start();
    }catch(e){fail(e)}
  };
  init();
})();