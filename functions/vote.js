/**
 * Cloudflare Pages Function — /vote
 * Backs the interactive globe on the homepage with real, shared persistence
 * via Cloudflare D1 (env.DB, bound in the Pages project settings).
 *
 * GET  -> { counts: { "<iso-numeric-id>": {name, votes} }, total, mine: [] }
 * POST { id, name, action: "add"|"remove" } -> toggles this visitor's vote
 *      (deduped per-visitor via a hashed cookie, not IP, so offices/NAT
 *      don't collide) and returns the updated counts.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS expansion_votes (
  country_id TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS expansion_voters (
  visitor_id TEXT NOT NULL,
  country_id TEXT NOT NULL,
  PRIMARY KEY (visitor_id, country_id)
);`;

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function getVisitorId(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/ely_vid=([a-f0-9]{32})/);
  return match ? match[1] : null;
}

function newVisitorId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function ensureSchema(db) {
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }
}

async function allCounts(db) {
  const { results } = await db
    .prepare('SELECT country_id, country_name, votes FROM expansion_votes WHERE votes > 0 ORDER BY votes DESC')
    .all();
  const counts = {};
  let total = 0;
  for (const r of results) {
    counts[r.country_id] = { name: r.country_name, votes: r.votes };
    total += r.votes;
  }
  return { counts, total };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) {
    return jsonResponse({ error: 'D1 binding "DB" is not configured for this Pages project yet.' }, 500);
  }

  await ensureSchema(env.DB);

  let vid = getVisitorId(request);
  const cookieHeaders = {};
  if (!vid) {
    vid = newVisitorId();
    cookieHeaders['Set-Cookie'] = `ely_vid=${vid}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax; Secure`;
  }

  if (request.method === 'GET') {
    const { counts, total } = await allCounts(env.DB);
    const { results: mineRows } = await env.DB
      .prepare('SELECT country_id FROM expansion_voters WHERE visitor_id = ?')
      .bind(vid)
      .all();
    return jsonResponse({ counts, total, mine: mineRows.map((r) => r.country_id) }, 200, cookieHeaders);
  }

  if (request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { body = {}; }
    const id = String(body.id || '').replace(/[^0-9]/g, '');
    const name = String(body.name || '').slice(0, 60).trim();
    const action = body.action === 'remove' ? 'remove' : 'add';

    if (!id || !name) {
      return jsonResponse({ error: 'invalid country' }, 400, cookieHeaders);
    }

    if (action === 'add') {
      const already = await env.DB
        .prepare('SELECT 1 FROM expansion_voters WHERE visitor_id = ? AND country_id = ?')
        .bind(vid, id)
        .first();
      if (!already) {
        await env.DB.prepare('INSERT INTO expansion_voters (visitor_id, country_id) VALUES (?, ?)').bind(vid, id).run();
        await env.DB
          .prepare(`INSERT INTO expansion_votes (country_id, country_name, votes) VALUES (?, ?, 1)
                    ON CONFLICT(country_id) DO UPDATE SET votes = votes + 1, country_name = excluded.country_name`)
          .bind(id, name)
          .run();
      }
    } else {
      const del = await env.DB
        .prepare('DELETE FROM expansion_voters WHERE visitor_id = ? AND country_id = ?')
        .bind(vid, id)
        .run();
      if (del.meta.changes > 0) {
        await env.DB.prepare('UPDATE expansion_votes SET votes = MAX(0, votes - 1) WHERE country_id = ?').bind(id).run();
      }
    }

    const { counts, total } = await allCounts(env.DB);
    return jsonResponse({ counts, total }, 200, cookieHeaders);
  }

  return jsonResponse({ error: 'method not allowed' }, 405);
}
