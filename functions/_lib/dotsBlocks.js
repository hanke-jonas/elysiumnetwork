// Shared validation for the DOTS alumni mini-page block builder --
// participant-submitted content, so unlike the (staff-only, trusted)
// ugobongo block editor, paragraph/heading text here is plain text only,
// never raw HTML, and is rendered through Nunjucks' default auto-escaping
// on the public page (src/dots/alumni-profile.njk) rather than a `safe`
// filter. Reused by both the initial submission
// (functions/api/dots-alumni/submit.js) and edit proposals
// (functions/api/dots-alumni/propose-edit.js) so both go through
// identical limits.
const ALLOWED_TYPES = new Set(['heading', 'paragraph', 'image', 'gallery', 'button', 'spacer']);
const MAX_BLOCKS = 30;

function sanitizeBlock(b) {
  const clean = { id: String(b.id || '').slice(0, 40), type: b.type };
  if (b.type === 'heading') clean.text = String(b.text || '').slice(0, 200);
  if (b.type === 'paragraph') clean.text = String(b.text || '').slice(0, 4000);
  if (b.type === 'image') {
    clean.url = String(b.url || '').slice(0, 500);
    clean.caption = String(b.caption || '').slice(0, 300);
  }
  if (b.type === 'gallery') clean.images = Array.isArray(b.images) ? b.images.slice(0, 12).map(String) : [];
  if (b.type === 'button') {
    clean.label = String(b.label || '').slice(0, 100);
    clean.href = String(b.href || '').slice(0, 500);
  }
  if (b.type === 'spacer') clean.height = Number.isFinite(b.height) ? Math.max(0, Math.min(300, b.height)) : 40;
  return clean;
}

// Returns null for "no blocks" (falls back to the simple bio/story/photos
// fields), or a sanitized array otherwise.
export function sanitizeBlocks(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  return raw.slice(0, MAX_BLOCKS).filter((b) => b && ALLOWED_TYPES.has(b.type)).map(sanitizeBlock);
}
