import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';

export async function onRequestGet({ request, env, params }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const row = await env.DB.prepare('SELECT * FROM newsletter_campaigns WHERE id = ?').bind(params.id).first();
  if (!row) return json({ error: 'Not found' }, { status: 404 });
  return json(row);
}

// Only draft campaigns can be edited — once sending has started/finished the
// record is a historical log, not a document to keep mutating.
export async function onRequestPut({ request, env, params }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const existing = await env.DB.prepare('SELECT status FROM newsletter_campaigns WHERE id = ?').bind(params.id).first();
  if (!existing) return json({ error: 'Not found' }, { status: 404 });
  if (existing.status !== 'draft') return badRequest('Only draft campaigns can be edited');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');
  const subject = typeof body.subject === 'string' ? body.subject.trim() : null;
  const bodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml : null;
  if (!subject && !bodyHtml) return badRequest('Nothing to update');

  await env.DB.prepare(
    'UPDATE newsletter_campaigns SET subject = COALESCE(?, subject), body_html = COALESCE(?, body_html) WHERE id = ?'
  ).bind(subject, bodyHtml, params.id).run();

  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const existing = await env.DB.prepare('SELECT status FROM newsletter_campaigns WHERE id = ?').bind(params.id).first();
  if (!existing) return json({ error: 'Not found' }, { status: 404 });
  if (existing.status !== 'draft') return badRequest('Only draft campaigns can be deleted');

  await env.DB.prepare('DELETE FROM newsletter_campaigns WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
