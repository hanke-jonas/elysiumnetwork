// Shared read/validate/persist logic for the ugobongo_config single-row
// table -- used by both the human visual editor (api/ugobongo-admin/config.js)
// and the AI chat assistant (api/ugobongo-admin/chat.js), so an AI-proposed
// change goes through the exact same sanitization as a human edit.

export const DEFAULTS = {
  title: 'UGOBONGO — Official Executive Bio',
  subtitle: 'Tremendous Leader, World-Class Napper, Very Stable Genius — And Definitely Not a Racist, According to Me',
  bio_html: '',
  images: [],
  loading_ms: 12000,
  loading_messages: ['Preparing Official Bio…', 'Consulting the record…', 'Verifying tremendousness…', 'Almost ready…', 'Still preparing, on purpose…'],
  spinner_image_url: null,
  spinner_speed_ms: 2000,
};

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

export function sanitizeConfig(body) {
  const title = typeof body.title === 'string' ? body.title.slice(0, 200) : DEFAULTS.title;
  const subtitle = typeof body.subtitle === 'string' ? body.subtitle.slice(0, 400) : DEFAULTS.subtitle;
  const bio_html = typeof body.bio_html === 'string' ? body.bio_html.slice(0, 50000) : '';
  const images = Array.isArray(body.images) ? body.images.slice(0, 30) : [];
  const loading_ms = Number.isFinite(body.loading_ms) ? Math.max(0, Math.min(60000, body.loading_ms)) : DEFAULTS.loading_ms;
  const loading_messages = Array.isArray(body.loading_messages) && body.loading_messages.length
    ? body.loading_messages.slice(0, 20).map((m) => String(m).slice(0, 200))
    : DEFAULTS.loading_messages;
  const spinner_image_url = typeof body.spinner_image_url === 'string' && body.spinner_image_url ? body.spinner_image_url : null;
  const spinner_speed_ms = Number.isFinite(body.spinner_speed_ms) ? Math.max(200, Math.min(10000, body.spinner_speed_ms)) : DEFAULTS.spinner_speed_ms;
  const blocks = Array.isArray(body.blocks)
    ? body.blocks.slice(0, 60).filter((b) => b && ALLOWED_TYPES.has(b.type)).map(sanitizeBlock)
    : null;

  return { title, subtitle, bio_html, images, loading_ms, loading_messages, spinner_image_url, spinner_speed_ms, blocks };
}

export async function readConfig(env) {
  const row = await env.DB.prepare('SELECT * FROM ugobongo_config WHERE id = 1').first();
  if (!row) return { ...DEFAULTS, blocks: null };

  return {
    title: row.title || DEFAULTS.title,
    subtitle: row.subtitle || DEFAULTS.subtitle,
    bio_html: row.bio_html || DEFAULTS.bio_html,
    images: JSON.parse(row.images_json || '[]'),
    loading_ms: row.loading_ms ?? DEFAULTS.loading_ms,
    loading_messages: JSON.parse(row.loading_messages_json || 'null') || DEFAULTS.loading_messages,
    spinner_image_url: row.spinner_image_url || null,
    spinner_speed_ms: row.spinner_speed_ms ?? DEFAULTS.spinner_speed_ms,
    blocks: JSON.parse(row.blocks_json || 'null'),
  };
}

export async function saveConfig(env, body) {
  const clean = sanitizeConfig(body);

  await env.DB.prepare(`
    INSERT INTO ugobongo_config (id, title, subtitle, bio_html, images_json, loading_ms, loading_messages_json, spinner_image_url, spinner_speed_ms, blocks_json, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      bio_html = excluded.bio_html,
      images_json = excluded.images_json,
      loading_ms = excluded.loading_ms,
      loading_messages_json = excluded.loading_messages_json,
      spinner_image_url = excluded.spinner_image_url,
      spinner_speed_ms = excluded.spinner_speed_ms,
      blocks_json = excluded.blocks_json,
      updated_at = datetime('now')
  `).bind(
    clean.title, clean.subtitle, clean.bio_html, JSON.stringify(clean.images), clean.loading_ms,
    JSON.stringify(clean.loading_messages), clean.spinner_image_url, clean.spinner_speed_ms,
    clean.blocks ? JSON.stringify(clean.blocks) : null,
  ).run();

  return clean;
}
