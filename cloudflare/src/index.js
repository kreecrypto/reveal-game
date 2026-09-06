const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGINS || 'https://reveal-game.vercel.app')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!origin) return configured[0] || '*';
  return configured.includes(origin) ? origin : configured[0] || '*';
}

function corsHeaders(request, env) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(request, env),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(request, env, data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env), ...extra }
  });
}

async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('invalid_content_type');
  return request.json();
}

function normalizeAnswer(value) {
  return String(value ?? '').trim().toLocaleLowerCase('th-TH');
}

function scoreRound({ openedCount, wrongCount, hintUsed }) {
  return Math.max(0, 1000 - openedCount * 50 - wrongCount * 100 - (hintUsed ? 150 : 0));
}

async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const token = request.headers.get('X-Admin-Token') || '';
  return token && token === env.ADMIN_TOKEN;
}

async function getSessionRound(env, sessionId, roundId) {
  return env.DB.prepare(`
    SELECT sr.session_id, sr.round_id, sr.wrong_count, sr.hint_used, sr.status, sr.score,
           r.game_id, r.sort_order, r.question, r.answer_json, r.hint, r.grid_size, r.asset_key
    FROM session_rounds sr
    JOIN game_rounds r ON r.id = sr.round_id
    JOIN game_sessions s ON s.id = sr.session_id AND s.game_id = r.game_id
    WHERE sr.session_id = ? AND sr.round_id = ?
  `).bind(sessionId, roundId).first();
}

async function openedCount(env, sessionId, roundId) {
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM session_opened_tiles WHERE session_id = ? AND round_id = ?'
  ).bind(sessionId, roundId).first();
  return Number(row?.count || 0);
}

async function refreshSessionScore(env, sessionId) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(score), 0) AS score FROM session_rounds WHERE session_id = ?`
  ).bind(sessionId).first();
  const score = Number(row?.score || 0);
  await env.DB.prepare('UPDATE game_sessions SET score = ? WHERE id = ?').bind(score, sessionId).run();
  return score;
}

async function handleApi(request, env, url) {
  const path = url.pathname;

  if (path === '/api/v1/health' && request.method === 'GET') {
    return json(request, env, { ok: true, service: 'reveal-game-api', version: 'v1' });
  }

  if (path === '/api/v1/games' && request.method === 'GET') {
    const result = await env.DB.prepare(`
      SELECT id, title, description, difficulty, status, created_at, updated_at
      FROM games
      WHERE status = 'published'
      ORDER BY created_at DESC
    `).all();
    return json(request, env, { games: result.results ?? [] });
  }

  const gameMatch = path.match(/^\/api\/v1\/games\/([^/]+)$/);
  if (gameMatch && request.method === 'GET') {
    const gameId = decodeURIComponent(gameMatch[1]);
    const game = await env.DB.prepare(`
      SELECT id, title, description, difficulty, status, created_at, updated_at
      FROM games WHERE id = ? AND status = 'published'
    `).bind(gameId).first();
    if (!game) return json(request, env, { error: 'game_not_found' }, 404);

    const rounds = await env.DB.prepare(`
      SELECT id, sort_order, question, grid_size, asset_key
      FROM game_rounds WHERE game_id = ? ORDER BY sort_order ASC
    `).bind(gameId).all();
    return json(request, env, { game, rounds: rounds.results ?? [] });
  }

  if (path === '/api/v1/sessions' && request.method === 'POST') {
    const body = await readJson(request);
    const gameId = String(body.gameId || '');
    const game = await env.DB.prepare(
      `SELECT id FROM games WHERE id = ? AND status = 'published'`
    ).bind(gameId).first();
    if (!game) return json(request, env, { error: 'game_not_found' }, 404);

    const sessionId = crypto.randomUUID();
    const rounds = await env.DB.prepare(
      'SELECT id FROM game_rounds WHERE game_id = ? ORDER BY sort_order ASC'
    ).bind(gameId).all();
    if (!rounds.results?.length) return json(request, env, { error: 'game_has_no_rounds' }, 409);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO game_sessions (id, game_id, score, current_round, status) VALUES (?, ?, 0, 0, 'playing')`
      ).bind(sessionId, gameId),
      ...rounds.results.map((r) => env.DB.prepare(
        `INSERT INTO session_rounds (session_id, round_id, wrong_count, hint_used, status, score)
         VALUES (?, ?, 0, 0, 'playing', 0)`
      ).bind(sessionId, r.id))
    ]);

    return json(request, env, { sessionId, gameId, status: 'playing' }, 201);
  }

  const sessionMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)$/);
  if (sessionMatch && request.method === 'GET') {
    const sessionId = decodeURIComponent(sessionMatch[1]);
    const session = await env.DB.prepare(`
      SELECT id, game_id, score, current_round, status, created_at, completed_at
      FROM game_sessions WHERE id = ?
    `).bind(sessionId).first();
    if (!session) return json(request, env, { error: 'session_not_found' }, 404);

    const rounds = await env.DB.prepare(`
      SELECT sr.round_id, r.sort_order, r.question, r.grid_size, r.asset_key,
             sr.wrong_count, sr.hint_used, sr.status, sr.score,
             (SELECT COUNT(*) FROM session_opened_tiles t WHERE t.session_id = sr.session_id AND t.round_id = sr.round_id) AS opened_count
      FROM session_rounds sr
      JOIN game_rounds r ON r.id = sr.round_id
      WHERE sr.session_id = ?
      ORDER BY r.sort_order ASC
    `).bind(sessionId).all();
    return json(request, env, { session, rounds: rounds.results ?? [] });
  }

  const openMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)\/rounds\/([^/]+)\/open$/);
  if (openMatch && request.method === 'POST') {
    const sessionId = decodeURIComponent(openMatch[1]);
    const roundId = decodeURIComponent(openMatch[2]);
    const state = await getSessionRound(env, sessionId, roundId);
    if (!state) return json(request, env, { error: 'round_not_found' }, 404);
    if (state.status !== 'playing') return json(request, env, { error: 'round_already_finished' }, 409);

    const body = await readJson(request);
    const tileIndex = Number(body.tileIndex);
    const maxTiles = Number(state.grid_size) ** 2;
    if (!Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= maxTiles) {
      return json(request, env, { error: 'invalid_tile_index' }, 400);
    }

    await env.DB.prepare(`
      INSERT OR IGNORE INTO session_opened_tiles (session_id, round_id, tile_index)
      VALUES (?, ?, ?)
    `).bind(sessionId, roundId, tileIndex).run();
    const count = await openedCount(env, sessionId, roundId);
    const currentScore = scoreRound({ openedCount: count, wrongCount: Number(state.wrong_count), hintUsed: Boolean(state.hint_used) });
    return json(request, env, { openedCount: count, currentScore });
  }

  const hintMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)\/rounds\/([^/]+)\/hint$/);
  if (hintMatch && request.method === 'POST') {
    const sessionId = decodeURIComponent(hintMatch[1]);
    const roundId = decodeURIComponent(hintMatch[2]);
    const state = await getSessionRound(env, sessionId, roundId);
    if (!state) return json(request, env, { error: 'round_not_found' }, 404);
    if (state.status !== 'playing') return json(request, env, { error: 'round_already_finished' }, 409);

    await env.DB.prepare(`UPDATE session_rounds SET hint_used = 1 WHERE session_id = ? AND round_id = ?`)
      .bind(sessionId, roundId).run();
    const count = await openedCount(env, sessionId, roundId);
    const currentScore = scoreRound({ openedCount: count, wrongCount: Number(state.wrong_count), hintUsed: true });
    return json(request, env, { hint: state.hint || null, hintUsed: true, currentScore });
  }

  const guessMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)\/rounds\/([^/]+)\/guess$/);
  if (guessMatch && request.method === 'POST') {
    const sessionId = decodeURIComponent(guessMatch[1]);
    const roundId = decodeURIComponent(guessMatch[2]);
    const state = await getSessionRound(env, sessionId, roundId);
    if (!state) return json(request, env, { error: 'round_not_found' }, 404);
    if (state.status !== 'playing') return json(request, env, { error: 'round_already_finished' }, 409);

    const body = await readJson(request);
    const guess = normalizeAnswer(body.answer);
    if (!guess) return json(request, env, { error: 'answer_required' }, 400);

    let accepted = [];
    try { accepted = JSON.parse(state.answer_json); } catch { accepted = []; }
    const correct = accepted.some((a) => normalizeAnswer(a) === guess);
    const count = await openedCount(env, sessionId, roundId);

    if (!correct) {
      const wrongCount = Number(state.wrong_count) + 1;
      await env.DB.prepare(`UPDATE session_rounds SET wrong_count = ? WHERE session_id = ? AND round_id = ?`)
        .bind(wrongCount, sessionId, roundId).run();
      const currentScore = scoreRound({ openedCount: count, wrongCount, hintUsed: Boolean(state.hint_used) });
      return json(request, env, { correct: false, wrongCount, currentScore });
    }

    const roundScore = scoreRound({ openedCount: count, wrongCount: Number(state.wrong_count), hintUsed: Boolean(state.hint_used) });
    await env.DB.prepare(`
      UPDATE session_rounds SET status = 'correct', score = ? WHERE session_id = ? AND round_id = ?
    `).bind(roundScore, sessionId, roundId).run();
    const totalScore = await refreshSessionScore(env, sessionId);
    return json(request, env, { correct: true, answer: accepted[0] || null, roundScore, totalScore });
  }

  const revealMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)\/rounds\/([^/]+)\/reveal$/);
  if (revealMatch && request.method === 'POST') {
    const sessionId = decodeURIComponent(revealMatch[1]);
    const roundId = decodeURIComponent(revealMatch[2]);
    const state = await getSessionRound(env, sessionId, roundId);
    if (!state) return json(request, env, { error: 'round_not_found' }, 404);
    if (state.status !== 'playing') return json(request, env, { error: 'round_already_finished' }, 409);

    let accepted = [];
    try { accepted = JSON.parse(state.answer_json); } catch { accepted = []; }
    await env.DB.prepare(`
      UPDATE session_rounds SET status = 'revealed', score = 0 WHERE session_id = ? AND round_id = ?
    `).bind(sessionId, roundId).run();
    const totalScore = await refreshSessionScore(env, sessionId);
    return json(request, env, { revealed: true, answer: accepted[0] || null, roundScore: 0, totalScore });
  }

  const completeMatch = path.match(/^\/api\/v1\/sessions\/([^/]+)\/complete$/);
  if (completeMatch && request.method === 'POST') {
    const sessionId = decodeURIComponent(completeMatch[1]);
    const session = await env.DB.prepare('SELECT id FROM game_sessions WHERE id = ?').bind(sessionId).first();
    if (!session) return json(request, env, { error: 'session_not_found' }, 404);
    const pending = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM session_rounds WHERE session_id = ? AND status = 'playing'`
    ).bind(sessionId).first();
    if (Number(pending?.count || 0) > 0) return json(request, env, { error: 'rounds_not_finished' }, 409);

    const totalScore = await refreshSessionScore(env, sessionId);
    await env.DB.prepare(`
      UPDATE game_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(sessionId).run();
    return json(request, env, { completed: true, totalScore });
  }

  const assetGet = path.match(/^\/api\/v1\/assets\/(.+)$/);
  if (assetGet && request.method === 'GET') {
    const key = decodeURIComponent(assetGet[1]);
    const object = await env.ASSETS.get(key);
    if (!object) return json(request, env, { error: 'asset_not_found' }, 404);
    const headers = new Headers(corsHeaders(request, env));
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=86400, immutable');
    return new Response(object.body, { headers });
  }

  const assetPut = path.match(/^\/api\/v1\/admin\/assets\/(.+)$/);
  if (assetPut && request.method === 'PUT') {
    if (!(await requireAdmin(request, env))) return json(request, env, { error: 'unauthorized' }, 401);
    const key = decodeURIComponent(assetPut[1]);
    if (!request.body) return json(request, env, { error: 'body_required' }, 400);
    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    await env.ASSETS.put(key, request.body, { httpMetadata: { contentType } });
    return json(request, env, { ok: true, key }, 201);
  }

  return json(request, env, { error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (url.pathname === '/health') {
        return json(request, env, { ok: true, service: 'reveal-game-api', version: 'v1' });
      }
      if (url.pathname.startsWith('/api/v1/')) {
        return await handleApi(request, env, url);
      }
      return json(request, env, { error: 'not_found' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      const clientErrors = new Set(['invalid_content_type']);
      return json(request, env, { error: clientErrors.has(message) ? message : 'internal_error' }, clientErrors.has(message) ? 400 : 500);
    }
  }
};
