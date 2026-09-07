const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function unavailable(message = 'backend_unavailable') {
  return new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: JSON_HEADERS,
  });
}

export default {
  async fetch(request) {
    const origin = String(process.env.CLOUDFLARE_WORKER_ORIGIN || '').trim().replace(/\/$/, '');
    if (!origin) return unavailable('cloudflare_worker_origin_missing');

    const incoming = new URL(request.url);
    const path = incoming.searchParams.get('path') || '';
    const target = new URL(`${origin}/api/v2/${path.replace(/^\/+/, '')}`);

    for (const [key, value] of incoming.searchParams) {
      if (key !== 'path') target.searchParams.append(key, value);
    }

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('content-length');
    headers.delete('x-forwarded-host');

    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };

    if (!['GET', 'HEAD'].includes(request.method)) init.body = request.body;

    try {
      const response = await fetch(target, init);
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Reveal-Backend', 'cloudflare-worker');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('Cloudflare Worker proxy failed', error);
      return unavailable();
    }
  },
};
