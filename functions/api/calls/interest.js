import { requirePublic } from '../../_lib/guard.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

// Express interest in an Active Call — requires a public account so staff
// have a way to follow up, but no separate application form/CRM: just a
// call_id + optional message, one row per (call, user) via the schema's
// UNIQUE(call_id, user_id).
export async function onRequestPost({ request, env }) {
  const session = await requirePublic(request, env);
  if (session instanceof Response) return session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.callId !== 'string' || !body.callId.trim()) {
    return badRequest('callId is required');
  }

  const call = await env.DB.prepare('SELECT id FROM calls WHERE id = ?').bind(body.callId).first();
  if (!call) return badRequest('Unknown call');

  const existing = await env.DB.prepare(
    'SELECT id FROM call_interest WHERE call_id = ? AND user_id = ?'
  ).bind(body.callId, session.user.id).first();
  if (existing) return json({ ok: true, alreadyExpressed: true });

  await env.DB.prepare(
    'INSERT INTO call_interest (id, call_id, user_id, message) VALUES (?, ?, ?, ?)'
  ).bind(randomId(), body.callId, session.user.id, typeof body.message === 'string' ? body.message.slice(0, 2000) : null).run();

  return json({ ok: true, alreadyExpressed: false });
}

// Staff-visible list of who's interested in which call is served by the
// generic admin CRUD list on call_interest if/when needed; kept out of this
// public-facing file on purpose.
export async function onRequestGet({ request, env }) {
  const session = await requirePublic(request, env);
  if (session instanceof Response) return session;

  const rows = await env.DB.prepare(
    'SELECT call_id FROM call_interest WHERE user_id = ?'
  ).bind(session.user.id).all();
  return json({ callIds: rows.results.map((r) => r.call_id) });
}
