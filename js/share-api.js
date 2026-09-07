(() => {
  'use strict';

  const DEFAULT_BASE='/api/share/v2';
  const base=String(window.REVEAL_SHARE_API_BASE||DEFAULT_BASE).replace(/\/$/,'');

  const request=async(path,options={})=>{
    const response=await fetch(`${base}${path}`,options);
    let body=null;
    try{body=await response.json()}catch{}
    if(!response.ok){
      const code=body?.error||`http_${response.status}`;
      const error=new Error(code);error.status=response.status;error.code=code;throw error;
    }
    return body;
  };

  const formForGame=game=>{
    if(!game?.questions?.length)throw new Error('game_empty');
    const form=new FormData();
    const questions=game.questions.map((q,i)=>({
      question:String(q.question||'นี่มันตัวอะไรเนี่ย?').trim(),
      answer:String(q.answer||'').trim(),
      imageField:`image${i}`
    }));
    form.append('manifest',JSON.stringify({title:String(game.title||'เกมของฉัน').trim(),questions}));
    game.questions.forEach((q,i)=>{
      if(!(q.imageBlob instanceof Blob))throw new Error('image_missing');
      const name=String(q.imageName||`image-${i+1}.webp`).replace(/\.[^.]+$/,'.webp');
      form.append(`image${i}`,q.imageBlob,name);
    });
    return form;
  };

  const health=()=>request('/health',{cache:'no-store'});
  const fetchGame=async slug=>{
    const payload=await request(`/games/${encodeURIComponent(slug)}`,{cache:'no-store'});
    payload.questions=(payload.questions||[]).map(q=>({...q,image:q.image||`${base}/assets/${q.asset}`}));
    return payload;
  };
  const publish=game=>request('/games',{method:'POST',body:formForGame(game)});
  const update=(slug,editToken,game)=>request(`/games/${encodeURIComponent(slug)}`,{
    method:'PUT',headers:{'X-Edit-Token':editToken},body:formForGame(game)
  });

  window.RevealShareApi={base,health,fetchGame,publish,update};
})();
