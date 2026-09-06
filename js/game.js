(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const ui=n=>$(`[data-ui="${n}"]`), action=n=>$(`[data-action="${n}"]`);
  const state={questions:[],index:0,opened:new Set(),revealed:false};
  const showScreen=name=>{$$('.screen').forEach(x=>x.classList.toggle('is-active',x.dataset.screen===name));window.scrollTo(0,0)};
  const normalize=data=>{if(!Array.isArray(data))throw new Error('questions.json must be an array');return data.filter(x=>x&&x.image&&x.answer).map((x,i)=>({id:x.id??i+1,question:x.question||'ภาพนี้คืออะไร?',answer:String(x.answer),image:String(x.image),alt:x.alt||`ภาพคำถาม ${i+1}`}))};
  const loadQuestions=async()=>{const res=await fetch('/data/questions.json',{cache:'no-store'});if(!res.ok)throw new Error(`โหลดข้อมูลไม่สำเร็จ (${res.status})`);state.questions=normalize(await res.json());if(!state.questions.length)throw new Error('ไม่พบข้อมูลคำถาม')};
  const renderTiles=()=>{const root=ui('tiles');root.innerHTML=Array.from({length:9},(_,i)=>`<button class="tile ${(state.revealed||state.opened.has(i))?'is-open':''}" type="button" data-tile="${i}" aria-label="เปิดป้าย ${i+1}">${i+1}</button>`).join('');$$('[data-tile]',root).forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.tile);if(state.revealed||state.opened.has(i))return;state.opened.add(i);renderTiles()}))};
  const render=()=>{const item=state.questions[state.index],total=state.questions.length;ui('counter').textContent=`${state.index+1}/${total}`;ui('round-number').textContent=String(state.index+1).padStart(2,'0');ui('round-label').textContent=`รูปที่ ${state.index+1} / ${total}`;ui('progress').style.width=`${((state.index+1)/total)*100}%`;ui('question').textContent=item.question;ui('image').src=item.image;ui('image').alt=item.alt;ui('answer').textContent=state.revealed?item.answer:'ยังไม่เปิดเฉลย';renderTiles();action('reveal').disabled=state.revealed;action('next').classList.toggle('is-hidden',!state.revealed);action('next').textContent=state.index===total-1?'ดูสรุป':'รูปถัดไป'};
  const resetRound=()=>{state.opened=new Set();state.revealed=false};
  const start=()=>{state.index=0;resetRound();render();showScreen('game')};
  const reveal=()=>{state.revealed=true;state.opened=new Set(Array.from({length:9},(_,i)=>i));render()};
  const next=()=>{if(state.index<state.questions.length-1){state.index++;resetRound();render();showScreen('game')}else showScreen('done')};
  const fail=e=>{console.error(e);document.body.innerHTML=`<main style="max-width:680px;margin:40px auto;padding:20px;font-family:system-ui"><h1>โหลดเกมไม่สำเร็จ</h1><p>${e.message}</p></main>`};
  const init=async()=>{try{await loadQuestions();action('start').addEventListener('click',start);action('reveal').addEventListener('click',reveal);action('next').addEventListener('click',next);action('restart').addEventListener('click',start);$$('[data-action="home"]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();showScreen('home')}))}catch(e){fail(e)}};
  init();
})();