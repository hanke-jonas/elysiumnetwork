import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const rows = await env.DB.prepare(
    'SELECT id, subject, status, created_at, sent_at, recipient_count FROM newsletter_campaigns ORDER BY created_at DESC'
  ).all();
  return json({ items: rows.results });
}

// Creates a draft only — sending is a separate, deliberate step via
// [id]/send.js so a campaign is never emailed as a side effect of saving it.
export async function onRequestPost({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.subject !== 'string' || !body.subject.trim()) return badRequest('subject is required');
  if (typeof body.bodyHtml !== 'string' || !body.bodyHtml.trim()) return badRequest('bodyHtml is required');

  const id = randomId();
  await env.DB.prepare(
    'INSERT INTO newsletter_campaigns (id, subject, body_html, status, created_by) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.subject.trim(), body.bodyHtml, 'draft', staff.user.id).run();

  return json({ id }, { status: 201 });
}
