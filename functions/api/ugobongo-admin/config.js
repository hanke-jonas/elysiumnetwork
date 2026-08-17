import { requireUgobongoAdmin } from '../../_lib/ugobongoAuth.js';
import { json } from '../../_lib/http.js';

const DEFAULTS = {
  title: 'UGOBONGO — Official Executive Bio',
  subtitle: 'Tremendous Leader, World-Class Napper, Very Stable Genius — And Definitely Not a Racist, According to Me',
  bio_html: '',
  images: [],
  loading_ms: 12000,
  loading_messages: ['Preparing Official Bio…', 'Consulting the record…', 'Verifying tremendousness…', 'Almost ready…', 'Still preparing, on purpose…'],
  spinner_image_url: null,
};

export async function onRequestGet({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const row = await env.DB.prepare('SELECT * FROM ugobongo_config WHERE id = 1').first();
  if (!row) return json(DEFAULTS);

  return json({
    title: row.title || DEFAULTS.title,
    subtitle: row.subtitle || DEFAULTS.subtitle,
    bio_html: row.bio_html || DEFAULTS.bio_html,
    images: JSON.parse(row.images_json || '[]'),
    loading_ms: row.loading_ms ?? DEFAULTS.loading_ms,
    loading_messages: JSON.parse(row.loading_messages_json || 'null') || DEFAULTS.loading_messages,
    spinner_image_url: row.spinner_image_url || null,
    blocks: JSON.parse(row.blocks_json || 'null'),
  });
}

export async function onRequestPost({ request, env }) {
  const denied = requireUgobongoAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });

  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : DEFAULTS.title;
  const subtitle = typeof body.subtitle === 'string' ? body.subtitle.slice(0, 400) : DEFAULTS.subtitle;
  const bio_html = typeof body.bio_html === 'string' ? body.bio_html.slice(0, 50000) : '';
  const images = Array.isArray(body.images) ? body.images.slice(0, 30) : [];
  const loading_ms = Number.isFinite(body.loading_ms) ? Math.max(0, Math.min(60000, body.loading_ms)) : DEFAULTS.loading_ms;
  const loading_messages = Array.isArray(body.loading_messages) && body.loading_messages.length
    ? body.loading_messages.slice(0, 20).map((m) => String(m).slice(0, 200))
    : DEFAULTS.loading_messages;
  const spinner_image_url = typeof body.spinner_image_url === 'string' && body.spinner_image_url ? body.spinner_image_url : null;

  // Blocks: {id, type, ...} — the widget type registry mirrors the one in
  // functions/ugobongo-admin.js's canvas and functions/ugobongo.js's
  // renderBlock; adding a widget type means adding a case in all three.
  // `html`/paragraph content is trusted as-is (this endpoint is already
  // behind requireUgobongoAdmin) but every field is capped in count/size
  // the same way every other field here is. `columns` nests one level of
  // simple blocks (not `columns` itself) — a flexible two-up layout without
  // unbounded recursion.
  const ALLOWED_TYPES = new Set(['heading', 'paragraph', 'image', 'gallery', 'button', 'spacer', 'role', 'columns']);
  const COLUMN_CHILD_TYPES = new Set(['heading', 'paragraph', 'image', 'gallery', 'button', 'spacer', 'role']);

  function sanitizeBlock(b) {
    const clean = { id: String(b.id || '').slice(0, 40), type: b.type };
    if (b.type === 'heading') clean.text = String(b.text || '').slice(0, 300);
    if (b.type === 'paragraph') clean.html = String(b.html || '').slice(0, 20000);
    if (b.type === 'image') {
      clean.url = String(b.url || '').slice(0, 500);
      clean.caption = String(b.caption || '').slice(0, 300);
    }
    if (b.type === 'gallery') clean.images = Array.isArray(b.images) ? b.images.slice(0, 20).map(String) : [];
    if (b.type === 'button') {
      clean.label = String(b.label || '').slice(0, 100);
      clean.href = String(b.href || '').slice(0, 500);
    }
    if (b.type === 'spacer') clean.height = Number.isFinite(b.height) ? Math.max(0, Math.min(400, b.height)) : 40;
    if (b.type === 'role') {
      clean.title = String(b.title || '').slice(0, 200);
      clean.meta = String(b.meta || '').slice(0, 200);
      clean.items = Array.isArray(b.items) ? b.items.slice(0, 30).map((i) => String(i).slice(0, 2000)) : [];
    }
    if (b.type === 'columns') {
      const side = (arr) => (Array.isArray(arr) ? arr.slice(0, 20).filter((x) => x && COLUMN_CHILD_TYPES.has(x.type)).map(sanitizeBlock) : []);
      clean.left = side(b.left);
      clean.right = side(b.right);
    }
    return clean;
  }

  const blocks = Array.isArray(body.blocks)
    ? body.blocks.slice(0, 60).filter((b) => b && ALLOWED_TYPES.has(b.type)).map(sanitizeBlock)
    : null;

  await env.DB.prepare(`
    INSERT INTO ugobongo_config (id, title, subtitle, bio_html, images_json, loading_ms, loading_messages_json, spinner_image_url, blocks_json, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      bio_html = excluded.bio_html,
      images_json = excluded.images_json,
      loading_ms = excluded.loading_ms,
      loading_messages_json = excluded.loading_messages_json,
      spinner_image_url = excluded.spinner_image_url,
      blocks_json = excluded.blocks_json,
      updated_at = datetime('now')
  `).bind(title, subtitle, bio_html, JSON.stringify(images), loading_ms, JSON.stringify(loading_messages), spinner_image_url, blocks ? JSON.stringify(blocks) : null).run();

  return json({ ok: true });
}
