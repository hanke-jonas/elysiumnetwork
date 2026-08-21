import { badRequest, json, randomId } from '../../_lib/http.js';
import { sanitizeBlocks, deriveCoreFields, validateCoreFields } from '../../_lib/dotsBlocks.js';

// Public, unauthenticated (but invite-gated) submission for the DOTS
// alumni gallery -- the first public upload endpoint in this codebase
// (every other one is staff- or account-gated). Gated by a personal
// access code staff generate per real participant in /admin/dots-codes/
// -- this isn't a fully open form, just one that doesn't require a full
// account. The code is single-use for CREATING an entry (claimed
// atomically below), but once linked to that entry it becomes a
// permanent editing key -- see check-code.js's 'edit' mode and
// propose-edit.js, which the same code keeps unlocking indefinitely.
// Submissions land as 'pending' in dots_alumni and only appear
// on the public gallery (and get an individual portfolio page at
// /dots/alumni/<slug>/) once staff approve them via /admin/dots-alumni/,
// so an open code doesn't mean open publishing either.
//
// The whole page is one unified block list (name/photo/bio are block
// types too, not separate fixed fields) -- see functions/_lib/
// dotsBlocks.js. Every image (including the identity photo) is uploaded
// ahead of time via upload-block-image.js as the participant builds their
// page, so this endpoint only ever receives already-hosted URLs inside
// the blocks JSON, never a raw file. That also means there's no upload
// work left for this handler to do itself.
//
// A plain honeypot field is kept as defense-in-depth even with the code
// gate -- this codebase has no rate-limiting or Turnstile anywhere yet
// (documented gap, see functions/api/shared/[slug].js).
const MAX_SLUG_CHARS = 60;

function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG_CHARS).replace(/-+$/, '');
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');

    // Honeypot: a real visitor never sees or fills this field (hidden via
    // CSS in the form); a filled value means a bot. Return a success-shaped
    // response without actually saving anything, so the bot has no signal
    // it was caught.
    if (form.get('website_hp')) return json({ ok: true }, { status: 201 });

    // The consent checkbox is `required` client-side, but that's only ever
    // a UX nicety a request can skip -- the actual record of "this person
    // agreed to have this published" has to be enforced here too.
    if (!form.get('consent')) return badRequest('Please confirm you agree to have your page published before submitting.');

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT edition, used_at FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow) return badRequest('That access code was not recognized.');
    if (codeRow.used_at) return badRequest('That access code has already been used to create an entry — enter it again on the submission page to edit that entry instead.');

    let blocks;
    try { blocks = sanitizeBlocks(JSON.parse(form.get('blocks') || '[]')); } catch { blocks = null; }
    if (!blocks) return badRequest('Your page is empty — add at least a name and bio.');

    const core = deriveCoreFields(blocks);
    const coreError = validateCoreFields(core);
    if (coreError) return badRequest(coreError);

    // The participant can pick their own page address (previewed live as
    // they type on the form); falls back to their name if left blank.
    // Checked for a collision BEFORE the code is claimed below, so a
    // taken address never burns their one-time code -- they just get
    // sent back to try a different one.
    const requestedSlug = slugify(form.get('slug')) || slugify(core.name) || 'alumnus';
    const existing = await env.DB.prepare('SELECT id FROM dots_alumni WHERE slug = ?').bind(requestedSlug).first();
    if (existing) return badRequest(`elysium.ngo/dots/alumni/${requestedSlug}/ is already taken — try a different page address.`);

    // Claimed last, right before the insert, and only if everything else
    // above already succeeded -- so a validation error never burns the
    // participant's one-time code. The WHERE used_at IS NULL makes this an
    // atomic claim: if two requests raced on the same code, only one can
    // win.
    const claim = await env.DB.prepare(
      "UPDATE dots_access_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL",
    ).bind(code).run();
    if (!claim.meta || claim.meta.changes !== 1) return badRequest('That access code has already been used.');

    const id = randomId();

    await env.DB.prepare(
      `INSERT INTO dots_alumni (id, slug, edition, name, pronouns, current_role, location, quote, bio, photo_url, photos_json, links_json, blocks_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, 'pending')`,
    ).bind(id, requestedSlug, codeRow.edition, core.name, core.pronouns, core.current_role, core.location, core.quote, core.bio, core.photo_url, core.links_json, JSON.stringify(blocks)).run();

    await env.DB.prepare('UPDATE dots_access_codes SET dots_alumni_id = ? WHERE code = ?').bind(id, code).run();

    return json({ ok: true, id, slug: requestedSlug }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
