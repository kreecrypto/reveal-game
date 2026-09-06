export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'reveal-game-api' }, { headers: cors });
    }

    if (url.pathname === '/games' && request.method === 'GET') {
      const result = await env.DB.prepare(
        'SELECT id, title, description, difficulty, status, created_at FROM games WHERE status = ? ORDER BY created_at DESC'
      ).bind('published').all();
      return Response.json({ games: result.results ?? [] }, { headers: cors });
    }

    return Response.json({ error: 'not_found' }, { status: 404, headers: cors });
  }
};
