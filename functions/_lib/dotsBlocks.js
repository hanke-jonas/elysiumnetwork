// Shared validation for the DOTS alumni mini-page block builder --
// participant-submitted content, so unlike the (staff-only, trusted)
// ugobongo block editor, paragraph/heading text here is plain text only,
// never raw HTML, and is rendered through Nunjucks' default auto-escaping
// on the public page (src/dots/alumni-profile.njk) rather than a `safe`
// filter. Reused by both the initial submission
// (functions/api/dots-alumni/submit.js) and edit proposals
// (functions/api/dots-alumni/propose-edit.js) so both go through
// identical limits.
//
// name/bio/photo/quote/subtitle/links are "identity" block types --
// unlike heading/paragraph/etc, a participant can drag these anywhere in
// their page, but the rest of the site (gallery cards, admin table, SEO
// description, search) needs a plain name/bio/photo_url/etc string
// regardless of where in the block order they ended up. deriveCoreFields
// below is the single place that reconciles "arbitrary block order" with
// "some flat columns everything else depends on" -- see submit.js and
// propose-edit.js, which call it right after sanitizeBlocks.
const ALLOWED_TYPES = new Set([
  'name', 'bio', 'photo', 'quote', 'subtitle', 'links',
  'heading', 'paragraph', 'image', 'gallery', 'button', 'spacer',
]);
const IDENTITY_TYPES = new Set(['name', 'bio', 'photo']);
const MAX_BLOCKS = 40;

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function sanitizeBlock(b) {
  const clean = { id: String(b.id || '').slice(0, 40), type: b.type };
  if (b.type === 'name') {
    clean.text = String(b.text || '').slice(0, 100);
    clean.pronouns = String(b.pronouns || '').slice(0, 30);
  }
  if (b.type === 'bio') clean.text = String(b.text || '').slice(0, 600);
  if (b.type === 'photo') clean.url = String(b.url || '').slice(0, 500);
  if (b.type === 'quote') clean.text = String(b.text || '').slice(0, 300);
  if (b.type === 'subtitle') {
    clean.role = String(b.role || '').slice(0, 120);
    clean.location = String(b.location || '').slice(0, 80);
  }
  if (b.type === 'links') {
    clean.instagram = normalizeUrl(b.instagram).slice(0, 300);
    clean.linkedin = normalizeUrl(b.linkedin).slice(0, 300);
    clean.website = normalizeUrl(b.website).slice(0, 300);
  }
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

// Returns null for "no blocks", or a sanitized array otherwise. A null/
// empty result is only ever meaningful for pre-unification legacy rows
// now (see the fallback branch in src/dots/alumni-profile.njk) -- current
// submissions always send at least the three identity blocks.
export function sanitizeBlocks(raw) {
  if (!Array.isArray(raw) || !raw.length) return null;
  return raw.slice(0, MAX_BLOCKS).filter((b) => b && ALLOWED_TYPES.has(b.type)).map(sanitizeBlock);
}

// True once a block list has been built through the unified editor (i.e.
// has an actual 'name' block in it), as opposed to an older entry whose
// blocks (if any) are only free-form content blocks layered on top of the
// separate flat name/bio/photo fields that predate this. Used to decide
// which rendering/edit path an entry takes.
export function isUnifiedBlocks(blocks) {
  return Array.isArray(blocks) && blocks.some((b) => b.type === 'name');
}

// Pulls the flat name/bio/photo_url/pronouns/current_role/location/quote/
// links_json columns every other template, the admin table, SEO
// description, and search still depend on out of an arbitrary-order block
// list -- first block of each identity type wins, so dragging a second
// "Photo" block below the first one never silently swaps the gallery
// card's thumbnail out from under someone.
export function deriveCoreFields(blocks) {
  const arr = Array.isArray(blocks) ? blocks : [];
  const find = (type) => arr.find((b) => b.type === type);
  const nameBlock = find('name');
  const bioBlock = find('bio');
  const photoBlock = find('photo');
  const quoteBlock = find('quote');
  const subtitleBlock = find('subtitle');
  const linksBlock = find('links');

  const links = [];
  if (linksBlock) {
    if (linksBlock.instagram) links.push({ label: 'Instagram', url: linksBlock.instagram });
    if (linksBlock.linkedin) links.push({ label: 'LinkedIn', url: linksBlock.linkedin });
    if (linksBlock.website) links.push({ label: 'Website', url: linksBlock.website });
  }

  return {
    name: (nameBlock && nameBlock.text) || '',
    pronouns: (nameBlock && nameBlock.pronouns) || null,
    bio: (bioBlock && bioBlock.text) || '',
    photo_url: (photoBlock && photoBlock.url) || '',
    current_role: (subtitleBlock && subtitleBlock.role) || null,
    location: (subtitleBlock && subtitleBlock.location) || null,
    quote: (quoteBlock && quoteBlock.text) || null,
    links_json: JSON.stringify(links),
  };
}

// The things the rest of the site can't function without -- a photo is
// encouraged (pre-seeded as a block by default) but optional, unlike
// name/bio which every gallery card and admin listing needs. Returns an
// error string naming what's missing, or null if all present -- checked
// AFTER sanitizeBlocks + deriveCoreFields, since a block can exist but
// still have an empty text/url after trimming/truncation.
export function validateCoreFields(core) {
  const missing = [];
  if (!core.name) missing.push('a name');
  if (!core.bio) missing.push('a bio');
  if (!missing.length) return null;
  return `Your page needs ${missing.join(', ')} — add ${missing.length > 1 ? 'them' : 'it'} as a block to continue.`;
}

export { IDENTITY_TYPES };
