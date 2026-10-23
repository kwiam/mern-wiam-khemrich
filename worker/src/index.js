import { MongoClient } from 'mongodb';

const json = (data, status, cors) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.CORS_ORIGINS || '').split(',').map((s) => s.trim());
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Idempotency-Key',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);
    const { pathname } = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (pathname === '/api/health' && request.method === 'GET')
      return json({ status: 'ok', service: 'cloudflare-worker', timestamp: new Date().toISOString() }, 200, cors);

    if (pathname === '/api/items' && (request.method === 'GET' || request.method === 'POST')) {
      if (!env.MONGODB_URI) return json({ error: 'Configuration serveur manquante' }, 500, cors);

      const client = new MongoClient(env.MONGODB_URI, { maxPoolSize: 1, serverSelectionTimeoutMS: 5000 });
      try {
        await client.connect();
        const col = client.db().collection('items'); // base indiquée dans l'URI

        if (request.method === 'GET') {
          const items = await col.find().sort({ createdAt: -1 }).limit(100).toArray();
          return json(items, 200, cors);
        }

        let body;
        try { body = await request.json(); } catch { return json({ error: 'JSON invalide' }, 400, cors); }
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const description = typeof body?.description === 'string' ? body.description.trim() : '';
        if (!name || name.length > 100)
          return json({ error: 'Le champ "name" est requis (1 à 100 caractères)' }, 400, cors);
        if (description.length > 500)
          return json({ error: 'Description : 500 caractères maximum' }, 400, cors);

        const requestId = request.headers.get('Idempotency-Key') || body.requestId;
        if (requestId !== undefined && requestId !== null && !/^[\w-]{8,64}$/.test(requestId))
          return json({ error: 'Idempotency-Key invalide' }, 400, cors);

        if (requestId) {
          const existing = await col.findOne({ requestId });
          if (existing) return json(existing, 200, cors); // doublon évité
        }

        const now = new Date();
        const doc = { name, description, ...(requestId && { requestId }), createdAt: now, updatedAt: now, __v: 0 };
        try {
          const r = await col.insertOne(doc);
          return json({ ...doc, _id: r.insertedId }, 201, cors);
        } catch (e) {
          if (e.code === 11000 && requestId) return json(await col.findOne({ requestId }), 200, cors);
          throw e;
        }
      } catch (e) {
        console.error(e);
        return json({ error: 'Erreur serveur' }, 500, cors);
      } finally {
        ctx.waitUntil(client.close());
      }
    }

    return json({ error: 'Route introuvable' }, 404, cors);
  },
};