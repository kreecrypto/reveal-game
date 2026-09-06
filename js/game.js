(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const ui=n=>$(`[data-ui="${n}"]`), action=n=>$(`[data-action="${n}"]`);
  const state={questions:[],title:'Demo 10 ข้อ',index:0,opened:new Set(),revealed:false,objectUrls:[]};
  const showScreen=name=>{$$('.screen').forEach(x=>x.classList.toggle('is-active',x.dataset.screen===name));window.scrollTo(0,0)};
  const normalize=data=>{if(!Array.isArray(data))throw new Error('ข้อมูลคำถามไม่ถูกต้อง');return data.filter(x=>x&&x.image&&x.answer).map((x,i)=>({id:x.id??i+1,question:x.question||'นี่มันตัวอะไรเนี่ย?',answer:String(x.answer),image:String(x.image),alt:x.alt||`ภาพคำถาม ${i+1}`}))};
  const clearObjectUrls=()=>{state.objectUrls.forEach(URL.revokeObjectURL);state.objectUrls=[]};
  window.addEventListener('beforeunload',clearObjectUrls);

  const fromCustomGame=game=>{
    if(!game?.questions?.length) return [];
    clearObjectUrls();
    const questions=game.questions.filter(x=>x?.imageBlob&&x?.answer).map((x,i)=>{
      const url=URL.createObjectURL(x.imageBlob);state.objectUrls.push(url);
      return {id:x.id??i+1,question:x.question||'นี่มันตัวอะไรเนี่ย?',answer:String(x.answer),image:url,alt:x.imageName||`ภาพคำถาม ${i+1}`};
    });
    if(questions.length) state.title=game.title||'เกมของฉัน';
    return questions;
  };

  const loadQuestions=async()=>{
    try{
      const custom=await RevealGameStore.getActive();
      const customQuestions=fromCustomGame(custom);
      if(customQuestions.length){state.questions=customQuestions;return}
    }catch(e){console.warn('โหลดเกมที่ปั้นไว้ไม่สำเร็จ เลยหยิบ Demo มาแทน',e)}
    const res=await fetch('/data/questions.json',{cache:'no-store'});
    if(!res.ok)throw new Error(`โหลดเกมไม่ขึ้น (${res.status})`);
    state.questions=normalize(await res.json());
    state.title='Demo 10 ข้อ';
    if(!state.questions.length)throw new Error('ไม่มีข้อให้เล่นเลย');
  };

  const renderTiles=()=>{const root=ui('tiles');root.innerHTML=Array.from({length:9},(_,i)=>`<button class="tile ${(state.revealed||state.opened.has(i))?'is-open':''}" type="button" data-tile="${i}" aria-label="เปิดป้าย ${i+1}">${i+1}</button>`).join('');$$('[data-tile]',root).forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.tile);if(state.revealed||state.opened.has(i))return;state.opened.add(i);renderTiles()}))};
  const renderHome=()=>{ui('game-title').textContent=`${state.title} · ${state.questions.length} ข้อ`;ui('counter').textContent=`1/${state.questions.length}`};
  const render=()=>{const item=state.questions[state.index],total=state.questions.length;ui('counter').textContent=`${state.index+1}/${total}`;ui('round-number').textContent=String(state.index+1).padStart(2,'0');ui('round-label').textContent=`ข้อที่ ${state.index+1} / ${total}`;ui('progress').style.width=`${((state.index+1)/total)*100}%`;ui('question').textContent=item.question;ui('image').src=item.image;ui('image').alt=item.alt;ui('answer').textContent=state.revealed?item.answer:'ยังไม่เฉลยนะ';ui('done-label').textContent=`ครบ ${total} ข้อแล้ว`;renderTiles();action('reveal').disabled=state.revealed;action('next').classList.toggle('is-hidden',!state.revealed);action('next').textContent=state.index===total-1?'ดูตอนจบ':'ไปข้อต่อไป'};
  const resetRound=()=>{state.opened=new Set();state.revealed=false};
  const start=()=>{state.index=0;resetRound();render();showScreen('game')};
  const reveal=()=>{state.revealed=true;state.opened=new Set(Array.from({length:9},(_,i)=>i));render()};
  const next=()=>{if(state.index<state.questions.length-1){state.index++;resetRound();render();showScreen('game')}else showScreen('done')};
  const fail=e=>{console.error(e);document.body.innerHTML=`<main style="max-width:680px;margin:40px auto;padding:20px;font-family:system-ui"><h1>เกมงอแงนิดนึง</h1><p>${e.message}</p><p><a href="/setup.html">กลับไปปั้นเกมใหม่</a></p></main>`};
  const init=async()=>{try{await loadQuestions();renderHome();action('start').addEventListener('click',start);action('reveal').addEventListener('click',reveal);action('next').addEventListener('click',next);action('restart').addEventListener('click',start);$$('[data-action="home"]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();renderHome();showScreen('home')}))}catch(e){fail(e)}};
  init();
})();
