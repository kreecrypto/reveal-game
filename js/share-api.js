(() => {
  'use strict';

  const SUPABASE_URL='https://xhqrfovpsoccocakjxfk.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_EbO5kNUl9EaS7s2VOXTnfA_-1XcOW_q';
  const BUCKET='reveal-game-assets';
  const REST=`${SUPABASE_URL}/rest/v1`;
  const STORAGE=`${SUPABASE_URL}/storage/v1/object`;
  const MAX_QUESTIONS=10;
  const MAX_IMAGE_BYTES=3*1024*1024;
  const MAX_TOTAL_IMAGE_BYTES=20*1024*1024;

  const apiHeaders=(editToken='',extra={})=>({
    apikey:PUBLISHABLE_KEY,
    ...(editToken?{'X-Edit-Token':editToken}:{}),
    ...extra
  });

  const safeJson=async response=>{try{return await response.json()}catch{return null}};
  const fail=(code,status=0,detail='')=>{
    const error=new Error(code);error.code=code;error.status=status;error.detail=detail;throw error;
  };

  const text=(value,max)=>String(value??'').trim().slice(0,max);
  const encodePath=path=>String(path).split('/').map(encodeURIComponent).join('/');
  const publicImageUrl=path=>`${STORAGE}/public/${BUCKET}/${encodePath(path)}`;

  const sha256=async value=>{
    const bytes=new TextEncoder().encode(String(value));
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  };

  const randomToken=()=>{
    const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
    let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
    return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  };

  const randomSlug=()=>{
    const alphabet='abcdefghjkmnpqrstuvwxyz23456789';
    const bytes=new Uint8Array(10);crypto.getRandomValues(bytes);
    return [...bytes].map(b=>alphabet[b%alphabet.length]).join('');
  };

  const extensionFor=type=>({
    'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/avif':'avif','image/webp':'webp'
  }[String(type||'').toLowerCase()]||'webp');

  const normalizeGame=game=>{
    if(!Array.isArray(game?.questions)||!game.questions.length)fail('game_empty');
    if(game.questions.length>MAX_QUESTIONS)fail('invalid_questions');
    let total=0;
    const questions=game.questions.map((q,i)=>{
      const image=q?.imageBlob;
      if(!(image instanceof Blob))fail('image_missing');
      if(image.size<=0||image.size>MAX_IMAGE_BYTES)fail('image_too_large');
      total+=image.size;if(total>MAX_TOTAL_IMAGE_BYTES)fail('images_too_large');
      const answer=text(q.answer,120);if(!answer)fail('answer_required');
      return {
        question:text(q.question,120)||'นี่มันตัวอะไรเนี่ย?',
        answer,
        image,
        index:i
      };
    });
    return {title:text(game.title,80)||'เกมของฉัน',questions};
  };

  const rpc=async(name,payload={})=>{
    const response=await fetch(`${REST}/rpc/${name}`,{
      method:'POST',cache:'no-store',headers:apiHeaders('',{'Content-Type':'application/json'}),body:JSON.stringify(payload)
    });
    const body=await safeJson(response);
    if(!response.ok)fail('backend_unavailable',response.status,body?.message||body?.error||'rpc_failed');
    return body;
  };

  const health=async()=>{
    const body=await rpc('reveal_share_health');
    if(!body?.ok)fail('backend_unavailable');
    return body;
  };

  const fetchGame=async slug=>{
    const rows=await rpc('reveal_get_game',{p_slug:String(slug||'').toLowerCase()});
    const row=Array.isArray(rows)?rows[0]:null;
    if(!row)fail('game_not_found',404);
    const questions=Array.isArray(row.manifest?.questions)?row.manifest.questions.map((q,i)=>({
      id:i+1,question:q.question,answer:q.answer,asset:q.assetPath,image:publicImageUrl(q.assetPath)
    })):[];
    return {game:{slug:row.slug,title:row.title,updatedAt:row.updated_at},questions};
  };

  const insertDraft=async({slug,title,editTokenHash})=>{
    const response=await fetch(`${REST}/reveal_games`,{
      method:'POST',
      headers:apiHeaders('',{'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({slug,title,edit_token_hash:editTokenHash,manifest:{questions:[]},status:'draft'})
    });
    if(response.ok)return true;
    const body=await safeJson(response);
    if(response.status===409||body?.code==='23505')return false;
    fail('backend_unavailable',response.status,body?.message||body?.error||'draft_create_failed');
  };

  const uploadImage=async({slug,editToken,blob})=>{
    const path=`shared-games/${slug}/${crypto.randomUUID()}.${extensionFor(blob.type)}`;
    const response=await fetch(`${STORAGE}/${BUCKET}/${encodePath(path)}`,{
      method:'POST',
      headers:apiHeaders(editToken,{'Content-Type':blob.type||'image/webp','x-upsert':'false'}),
      body:blob
    });
    if(!response.ok){
      const body=await safeJson(response);
      const code=response.status===413?'image_too_large':response.status===403?'invalid_edit_token':'backend_unavailable';
      fail(code,response.status,body?.message||body?.error||'storage_upload_failed');
    }
    return path;
  };

  const deleteImage=async(path,editToken)=>{
    if(!path)return;
    try{
      await fetch(`${STORAGE}/${BUCKET}/${encodePath(path)}`,{
        method:'DELETE',headers:apiHeaders(editToken)
      });
    }catch{}
  };

  const finalize=async({slug,editToken,title,questions,paths})=>{
    const manifest={questions:questions.map((q,i)=>({question:q.question,answer:q.answer,assetPath:paths[i]}))};
    const now=new Date().toISOString();
    const response=await fetch(`${REST}/reveal_games?slug=eq.${encodeURIComponent(slug)}&select=slug`,{
      method:'PATCH',
      headers:apiHeaders(editToken,{'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify({title,manifest,status:'published',updated_at:now,published_at:now})
    });
    const body=await safeJson(response);
    if(!response.ok)fail(response.status===403?'invalid_edit_token':'backend_unavailable',response.status,body?.message||body?.error||'publish_finalize_failed');
    if(!Array.isArray(body)||!body.length)fail('invalid_edit_token',403);
  };

  const deleteDraft=async(slug,editToken)=>{
    try{
      await fetch(`${REST}/reveal_games?slug=eq.${encodeURIComponent(slug)}`,{
        method:'DELETE',headers:apiHeaders(editToken,{'Prefer':'return=minimal'})
      });
    }catch{}
  };

  const publish=async game=>{
    const normalized=normalizeGame(game);
    const editToken=randomToken();
    const editTokenHash=await sha256(editToken);
    let slug='';
    for(let i=0;i<8;i++){
      const candidate=randomSlug();
      if(await insertDraft({slug:candidate,title:normalized.title,editTokenHash})){slug=candidate;break}
    }
    if(!slug)fail('backend_unavailable');

    const uploaded=[];
    try{
      for(const q of normalized.questions)uploaded.push(await uploadImage({slug,editToken,blob:q.image}));
      await finalize({slug,editToken,title:normalized.title,questions:normalized.questions,paths:uploaded});
      return {ok:true,slug,editToken,questionCount:normalized.questions.length};
    }catch(error){
      await Promise.all(uploaded.map(path=>deleteImage(path,editToken)));
      await deleteDraft(slug,editToken);
      throw error;
    }
  };

  const update=async(slug,editToken,game)=>{
    const normalized=normalizeGame(game);
    const current=await fetchGame(slug);
    const oldPaths=(current.questions||[]).map(q=>q.asset).filter(Boolean);
    const uploaded=[];
    try{
      for(const q of normalized.questions)uploaded.push(await uploadImage({slug,editToken,blob:q.image}));
      await finalize({slug,editToken,title:normalized.title,questions:normalized.questions,paths:uploaded});
      await Promise.all(oldPaths.map(path=>deleteImage(path,editToken)));
      return {ok:true,slug,questionCount:normalized.questions.length};
    }catch(error){
      await Promise.all(uploaded.map(path=>deleteImage(path,editToken)));
      throw error;
    }
  };

  window.RevealShareApi={
    base:SUPABASE_URL,
    backend:'supabase',
    health,fetchGame,publish,update
  };
})();
