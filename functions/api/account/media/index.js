import { requirePublic } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';

// A signed-in member's own personal file space — same R2 bucket the admin
// media library uses, but every public user is hard-scoped to their own
// `users/<id>/` prefix regardless of what they pass in, so one member can
// never list, read the listing of, or delete another member's files (or
// anything in the org's own admin-managed folders outside `users/`).
function scopedPrefix(userId, raw) {
  let sub = String(raw || '').replace(/^\/+/, '').replace(/\.\./g, '');
  if (sub && !sub.endsWith('/')) sub += '/';
  return `users/${userId}/${sub}`;
}

export async function onRequestGet({ request, env }) {
  const session = await requirePublic(request, env);
  if (session instanceof Response) return session;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const url = new URL(request.url);
  const root = `users/${session.user.id}/`;
  const prefix = scopedPrefix(session.user.id, url.searchParams.get('prefix'));

  const listed = await env.UPLOADS.list({ prefix, delimiter: '/' });
  const folders = (listed.delimitedPrefixes || []).map((p) => p.slice(prefix.length, -1)).filter(Boolean);
  const files = listed.objects
    .filter((o) => !o.key.endsWith('/.keep'))
    .map((o) => ({
      key: o.key,
      name: o.key.slice(prefix.length),
      url: `/uploads/${o.key}`,
      size: o.size,
      uploaded: o.uploaded,
    }));

  // Returned relative to the user's own root so the client never needs to
  // know or handle its own user id in URLs/breadcrumbs.
  return json({ prefix: prefix.slice(root.length), folders, files });
}

export async function onRequestPost({ request, env }) {
  const session = await requirePublic(request, env);
  if (session instanceof Response) return session;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || !body.action) return badRequest('Missing action');
  const userId = session.user.id;

  if (body.action === 'create-folder') {
    const name = String(body.name || '').trim().replace(/[^a-zA-Z0-9 _-]/g, '');
    if (!name) return badRequest('Folder name is required');
    const prefix = scopedPrefix(userId, body.prefix);
    await env.UPLOADS.put(`${prefix}${name}/.keep`, new Uint8Array());
    return json({ ok: true });
  }

  if (body.action === 'delete' || body.action === 'delete-many') {
    const keys = body.action === 'delete' ? [body.key] : (Array.isArray(body.keys) ? body.keys : []);
    const root = `users/${userId}/`;
    // Every key must actually sit under this user's own root — a forged
    // key from outside it is silently dropped rather than acted on.
    const safeKeys = keys.filter((k) => typeof k === 'string' && k.startsWith(root));
    await Promise.all(safeKeys.map((k) => env.UPLOADS.delete(k)));
    return json({ ok: true, deleted: safeKeys.length });
  }

  if (body.action === 'delete-folder') {
    const prefix = scopedPrefix(userId, body.prefix);
    if (prefix === `users/${userId}/`) return badRequest('Refusing to delete your root folder');
    const listed = await env.UPLOADS.list({ prefix });
    await Promise.all(listed.objects.map((o) => env.UPLOADS.delete(o.key)));
    return json({ ok: true, deleted: listed.objects.length });
  }

  return badRequest('Unknown action');
}
