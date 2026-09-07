const JSON_HEADERS = {'Content-Type':'application/json; charset=utf-8'};
const MAX_QUESTIONS = 10;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_TITLE = 80;
const MAX_TEXT = 120;

function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || 'https://reveal-game.vercel.app').split(',').map(x=>x.trim()).filter(Boolean);
  if (!origin) return allowed[0] || '*';
  if (allowed.includes(origin)) return origin;
  if (env.ALLOW_VERCEL_PREVIEWS === '1') {
    try {
      const host = new URL(origin).hostname;
      if (host.endsWith('.vercel.app')) return origin;
    } catch {}
  }
  return allowed[0] || '*';
}

function cors(request, env) {
  return {
    'Access-Control-Allow-Origin': originAllowed(request, env),
    'Access-Control-Allow-Headers': 'Content-Type, X-Edit-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(request, env, body, status=200, extra={}) {
  return new Response(JSON.stringify(body), {status, headers:{...JSON_HEADERS,...cors(request,env),...extra}});
}

function text(value, max) {
  return String(value ?? '').trim().slice(0,max);
}

function bytesToBase64Url(bytes) {
  let binary='';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}

function randomToken(size=32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

function randomSlug() {
  const alphabet='abcdefghjkmnpqrstuvwxyz23456789';
  const bytes=new Uint8Array(9); crypto.getRandomValues(bytes);
  return [...bytes].map(b=>alphabet[b%alphabet.length]).join('');
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function parsePublishForm(request) {
  const type=request.headers.get('content-type')||'';
  if (!type.includes('multipart/form-data')) throw new Error('invalid_content_type');
  const form=await request.formData();
  const raw=form.get('manifest');
  if (typeof raw !== 'string') throw new Error('manifest_required');
  let manifest;
  try { manifest=JSON.parse(raw); } catch { throw new Error('invalid_manifest'); }
  const title=text(manifest?.title,MAX_TITLE) || 'เกมของฉัน';
  if (!Array.isArray(manifest?.questions) || !manifest.questions.length || manifest.questions.length>MAX_QUESTIONS) throw new Error('invalid_questions');
  const questions=[];
  for (let i=0;i<manifest.questions.length;i++) {
    const q=manifest.questions[i]||{};
    const question=text(q.question,MAX_TEXT) || 'นี่มันตัวอะไรเนี่ย?';
    const answer=text(q.answer,MAX_TEXT);
    if (!answer) throw new Error('answer_required');
    const file=form.get(`image${i}`);
    if (!(file instanceof File)) throw new Error('image_required');
    if (!String(file.type||'').startsWith('image/')) throw new Error('invalid_image_type');
    if (file.size<=0 || file.size>MAX_IMAGE_BYTES) throw new Error('image_too_large');
    questions.push({question,answer,file});
  }
  return {title,questions};
}

async function uniqueSlug(env) {
  for (let i=0;i<8;i++) {
    const slug=randomSlug();
    const row=await env.DB.prepare('SELECT id FROM games WHERE slug = ?').bind(slug).first();
    if (!row) return slug;
  }
  throw new Error('slug_generation_failed');
}

async function getPublished(env, slug) {
  return env.DB.prepare(`SELECT id, slug, title, status, created_at, updated_at, published_at, schema_version
    FROM games WHERE slug = ? AND status = 'published'`).bind(slug).first();
}

async function assetKeysForGame(env, gameId) {
  const rows=await env.DB.prepare('SELECT asset_key FROM game_rounds WHERE game_id = ? AND asset_key IS NOT NULL').bind(gameId).all();
  return (rows.results||[]).map(r=>r.asset_key).filter(Boolean);
}

async function putImages(env, gameId, questions) {
  const uploaded=[];
  try {
    for (let i=0;i<questions.length;i++) {
      const q=questions[i];
      const key=`games/${gameId}/${crypto.randomUUID()}.webp`;
      await env.ASSETS.put(key,q.file.stream(),{httpMetadata:{contentType:q.file.type||'image/webp'}});
      uploaded.push(key);
    }
    return uploaded;
  } catch (error) {
    if (uploaded.length) await env.ASSETS.delete(uploaded);
    throw error;
  }
}

async function deleteAssets(env, keys) {
  if (!keys?.length) return;
  try { await env.ASSETS.delete(keys); } catch (error) { console.warn('asset cleanup failed',error); }
}

async function insertRounds(env, gameId, questions, keys) {
  return questions.map((q,i)=>env.DB.prepare(`INSERT INTO game_rounds
    (id, game_id, sort_order, question, answer_json, hint, grid_size, asset_key)
    VALUES (?, ?, ?, ?, ?, NULL, 3, ?)`)
    .bind(crypto.randomUUID(),gameId,i+1,q.question,JSON.stringify([q.answer]),keys[i]));
}

async function createGame(request, env) {
  const {title,questions}=await parsePublishForm(request);
  const gameId=crypto.randomUUID();
  const slug=await uniqueSlug(env);
  const editToken=randomToken();
  const editHash=await sha256(editToken);
  const keys=await putImages(env,gameId,questions);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO games
        (id,title,description,difficulty,status,slug,edit_token_hash,published_at,schema_version)
        VALUES (?, ?, NULL, 'normal', 'published', ?, ?, CURRENT_TIMESTAMP, 2)`)
        .bind(gameId,title,slug,editHash),
      ...(await insertRounds(env,gameId,questions,keys))
    ]);
  } catch (error) {
    await deleteAssets(env,keys);
    throw error;
  }
  return json(request,env,{ok:true,slug,editToken,questionCount:questions.length},201);
}

async function updateGame(request, env, slug) {
  const token=request.headers.get('X-Edit-Token')||'';
  if (!token) return json(request,env,{error:'edit_token_required'},401);
  const game=await env.DB.prepare('SELECT id, edit_token_hash FROM games WHERE slug = ?').bind(slug).first();
  if (!game) return json(request,env,{error:'game_not_found'},404);
  if ((await sha256(token)) !== game.edit_token_hash) return json(request,env,{error:'invalid_edit_token'},403);
  const {title,questions}=await parsePublishForm(request);
  const oldKeys=await assetKeysForGame(env,game.id);
  const newKeys=await putImages(env,game.id,questions);
  try {
    await env.DB.batch([
      env.DB.prepare(`UPDATE games SET title=?,status='published',updated_at=CURRENT_TIMESTAMP,published_at=CURRENT_TIMESTAMP,schema_version=2 WHERE id=?`).bind(title,game.id),
      env.DB.prepare('DELETE FROM game_rounds WHERE game_id = ?').bind(game.id),
      ...(await insertRounds(env,game.id,questions,newKeys))
    ]);
  } catch (error) {
    await deleteAssets(env,newKeys);
    throw error;
  }
  await deleteAssets(env,oldKeys);
  return json(request,env,{ok:true,slug,questionCount:questions.length});
}

async function publicGame(request, env, slug) {
  const game=await getPublished(env,slug);
  if (!game) return json(request,env,{error:'game_not_found'},404);
  const rows=await env.DB.prepare(`SELECT id,sort_order,question,answer_json,asset_key FROM game_rounds WHERE game_id=? ORDER BY sort_order ASC`).bind(game.id).all();
  const questions=(rows.results||[]).map((r,i)=>{
    let answer=''; try { answer=JSON.parse(r.answer_json)?.[0]||''; } catch {}
    return {id:i+1,question:r.question,answer,asset:encodeURIComponent(r.asset_key)};
  });
  return json(request,env,{game:{slug:game.slug,title:game.title,updatedAt:game.updated_at},questions},200,{'Cache-Control':'public, max-age=30'});
}

async function assetResponse(request, env, key) {
  const object=await env.ASSETS.get(key);
  if (!object) return json(request,env,{error:'asset_not_found'},404);
  const headers=new Headers(cors(request,env));
  object.writeHttpMetadata(headers);
  headers.set('ETag',object.httpEtag);
  headers.set('Cache-Control','public, max-age=31536000, immutable');
  return new Response(object.body,{headers});
}

function errorStatus(message) {
  if (['invalid_content_type','manifest_required','invalid_manifest','invalid_questions','answer_required','image_required','invalid_image_type','image_too_large'].includes(message)) return 400;
  return 500;
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:cors(request,env)});
    try {
      if ((url.pathname==='/health'||url.pathname==='/api/v2/health') && request.method==='GET') return json(request,env,{ok:true,service:'reveal-game-share-api',version:'v21'});
      if (url.pathname==='/api/v2/games' && request.method==='POST') return createGame(request,env);
      const gameMatch=url.pathname.match(/^\/api\/v2\/games\/([a-z0-9]+)$/);
      if (gameMatch && request.method==='GET') return publicGame(request,env,gameMatch[1]);
      if (gameMatch && request.method==='PUT') return updateGame(request,env,gameMatch[1]);
      const assetMatch=url.pathname.match(/^\/api\/v2\/assets\/(.+)$/);
      if (assetMatch && request.method==='GET') return assetResponse(request,env,decodeURIComponent(assetMatch[1]));
      return json(request,env,{error:'not_found'},404);
    } catch (error) {
      console.error(error);
      const message=error instanceof Error?error.message:'internal_error';
      return json(request,env,{error:errorStatus(message)===500?'internal_error':message},errorStatus(message));
    }
  }
};
