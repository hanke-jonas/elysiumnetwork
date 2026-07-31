import { requirePublic } from '../../_lib/guard.js';
import { badRequest, json, randomId } from '../../_lib/http.js';

// Mirrors functions/api/calls/interest.js closely — same "public account
// required, one row per (item, user)" shape — but events additionally
// enforce an optional capacity limit, which calls never needed.
export async function onRequestPost({ request, env }) {
  try {
    const session = await requirePublic(request, env);
    if (session instanceof Response) return session;

    const body = await request.json().catch(() => null);
    if (!body || typeof body.eventId !== 'string' || !body.eventId.trim()) {
      return badRequest('eventId is required');
    }

    const event = await env.DB.prepare('SELECT id, capacity FROM events WHERE id = ?').bind(body.eventId).first();
    if (!event) return badRequest('Unknown event');

    const existing = await env.DB.prepare(
      'SELECT id FROM event_rsvps WHERE event_id = ? AND user_id = ?'
    ).bind(body.eventId, session.user.id).first();
    if (existing) return json({ ok: true, alreadyRsvped: true });

    if (event.capacity !== null && event.capacity !== undefined) {
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM event_rsvps WHERE event_id = ?').bind(body.eventId).first();
      if (count.n >= event.capacity) return badRequest('This event is full');
    }

    await env.DB.prepare(
      'INSERT INTO event_rsvps (id, event_id, user_id) VALUES (?, ?, ?)'
    ).bind(randomId(), body.eventId, session.user.id).run();

    return json({ ok: true, alreadyRsvped: false });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const session = await requirePublic(request, env);
    if (session instanceof Response) return session;

    const rows = await env.DB.prepare('SELECT event_id FROM event_rsvps WHERE user_id = ?').bind(session.user.id).all();
    return json({ eventIds: rows.results.map((r) => r.event_id) });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
