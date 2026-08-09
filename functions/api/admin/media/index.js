import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json, randomId } from '../../../_lib/http.js';
import { hashPassword } from '../../../_lib/password.js';

// Staff-only media library: browse and organise everything already sitting
// in the UPLOADS bucket (including files other admin pages — team photos,
// blog covers, resources — already put there) plus whatever staff upload
// here directly. R2 has no real directories, only object keys; "folders"
// are just key prefixes, made to list even when empty by writing a small
// `.keep` marker object under them (see the folder-create branch below).
function safePrefix(raw) {
  let p = String(raw || '').replace(/^\/+/, '').replace(/\.\./g, '');
  if (p && !p.endsWith('/')) p += '/';
  return p;
}

export async function onRequestGet({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const url = new URL(request.url);
  const prefix = safePrefix(url.searchParams.get('prefix'));

  const listed = await env.UPLOADS.list({ prefix, delimiter: '/' });
  const folders = (listed.delimitedPrefixes || [])
    .map((p) => p.slice(prefix.length, -1))
    .filter(Boolean);
  const files = listed.objects
    .filter((o) => !o.key.endsWith('/.keep'))
    .map((o) => ({
      key: o.key,
      name: o.key.slice(prefix.length),
      url: `/uploads/${o.key}`,
      size: o.size,
      uploaded: o.uploaded,
      contentType: o.httpMetadata ? o.httpMetadata.contentType : null,
    }));

  // Which of these subfolders are password-protected, so the UI can show a
  // lock — looked up by exact prefix match against every folder at this
  // level rather than a LIKE scan, since there's at most a handful per page.
  let protectedByName = {};
  if (env.DB && folders.length) {
    const fullPrefixes = folders.map((name) => `${prefix}${name}/`);
    const placeholders = fullPrefixes.map(() => '?').join(',');
    const rows = await env.DB.prepare(`SELECT prefix, slug FROM protected_folders WHERE prefix IN (${placeholders})`).bind(...fullPrefixes).all();
    (rows.results || []).forEach((r) => {
      const name = r.prefix.slice(prefix.length, -1);
      protectedByName[name] = r.slug;
    });
  }

  return json({ prefix, folders, files, protectedByName });
}

// Body: { action: 'create-folder', prefix, name } or { action: 'delete', key }
// or { action: 'delete-folder', prefix }.
export async function onRequestPost({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;
  if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

  const body = await request.json().catch(() => null);
  if (!body || !body.action) return badRequest('Missing action');

  if (body.action === 'create-folder') {
    const name = String(body.name || '').trim().replace(/[^a-zA-Z0-9 _-]/g, '');
    if (!name) return badRequest('Folder name is required');
    const prefix = safePrefix(body.prefix);
    await env.UPLOADS.put(`${prefix}${name}/.keep`, new Uint8Array());
    return json({ ok: true });
  }

  if (body.action === 'delete') {
    if (!body.key) return badRequest('Missing key');
    await env.UPLOADS.delete(String(body.key));
    return json({ ok: true });
  }

  if (body.action === 'delete-many') {
    const keys = Array.isArray(body.keys) ? body.keys.filter((k) => typeof k === 'string') : [];
    await Promise.all(keys.map((k) => env.UPLOADS.delete(k)));
    return json({ ok: true, deleted: keys.length });
  }

  if (body.action === 'protect-folder') {
    const prefix = safePrefix(body.prefix);
    if (!prefix) return badRequest('Refusing to password-protect the root');
    if (!body.password || String(body.password).length < 6) return badRequest('Password must be at least 6 characters');
    if (!env.DB) return json({ error: 'DB is not configured' }, { status: 500 });
    const passwordHash = await hashPassword(String(body.password));
    const existing = await env.DB.prepare('SELECT slug FROM protected_folders WHERE prefix = ?').bind(prefix).first();
    const slug = existing ? existing.slug : randomId();
    await env.DB.prepare(
      `INSERT INTO protected_folders (slug, prefix, password_hash, label) VALUES (?, ?, ?, ?)
       ON CONFLICT(prefix) DO UPDATE SET password_hash = excluded.password_hash, label = excluded.label`
    ).bind(slug, prefix, passwordHash, body.label || null).run();
    return json({ ok: true, slug, shareUrl: `/shared/?f=${slug}` });
  }

  if (body.action === 'unprotect-folder') {
    const prefix = safePrefix(body.prefix);
    if (!env.DB) return json({ error: 'DB is not configured' }, { status: 500 });
    await env.DB.prepare('DELETE FROM protected_folders WHERE prefix = ?').bind(prefix).run();
    return json({ ok: true });
  }

  if (body.action === 'delete-folder') {
    const prefix = safePrefix(body.prefix);
    if (!prefix) return badRequest('Refusing to delete the root');
    // R2 list() caps at 1000 keys per call — a plain uploads folder is
    // nowhere near that, so one page is enough here rather than looping
    // on `cursor`.
    const listed = await env.UPLOADS.list({ prefix });
    await Promise.all(listed.objects.map((o) => env.UPLOADS.delete(o.key)));
    if (env.DB) await env.DB.prepare('DELETE FROM protected_folders WHERE prefix = ?').bind(prefix).run();
    return json({ ok: true, deleted: listed.objects.length });
  }

  return badRequest('Unknown action');
}
