import { badRequest, json, randomId } from '../../_lib/http.js';
import { bumpUsage } from '../../_lib/usage.js';
import { sanitizeBlocks } from '../../_lib/dotsBlocks.js';

// A participant reuses their already-claimed access code to propose a
// change to their own existing entry. Never touches the live dots_alumni
// row directly -- writes to dots_alumni_edits as 'pending', which staff
// review and approve/reject in /admin/dots-edits/. This is the
// "complex system" half of the invite flow: functions/api/dots-alumni/
// submit.js's code claim is permanent once linked to an entry (see
// check-code.js's "edit" mode), so the same code that got someone in
// keeps working as their ongoing edit key.
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_NAME_CHARS = 100;
const MAX_PRONOUNS_CHARS = 30;
const MAX_ROLE_CHARS = 120;
const MAX_LOCATION_CHARS = 80;
const MAX_QUOTE_CHARS = 300;
const MAX_BIO_CHARS = 600;
const MAX_STORY_CHARS = 4000;
const MAX_EXTRA_PHOTOS = 4;
const EXT_BY_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const LINK_FIELDS = [
  ['instagram', 'Instagram'],
  ['linkedin', 'LinkedIn'],
  ['website', 'Website'],
];

function normalizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function uploadImage(env, file) {
  if (!file || typeof file === 'string') return null;
  if (file.size > MAX_BYTES) throw new Error(`Photo is too large — ${Math.round(MAX_BYTES / (1024 * 1024))}MB maximum`);
  if (!EXT_BY_TYPE[file.type]) throw new Error('Photos must be JPEG, PNG, or WebP images');
  const key = `dots-alumni/${randomId()}.${EXT_BY_TYPE[file.type]}`;
  await env.UPLOADS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  bumpUsage(env, 'upload');
  return `/uploads/${key}`;
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.UPLOADS) return json({ error: 'UPLOADS storage is not configured' }, { status: 500 });

    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');
    if (form.get('website_hp')) return json({ ok: true }, { status: 201 });

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT used_at, dots_alumni_id FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow || !codeRow.used_at || !codeRow.dots_alumni_id) {
      return badRequest('That access code is not linked to an existing entry.');
    }

    const current = await env.DB.prepare('SELECT * FROM dots_alumni WHERE id = ?').bind(codeRow.dots_alumni_id).first();
    if (!current) return badRequest('That entry no longer exists.');

    // If an earlier visit already left a proposal awaiting review, this
    // submission continues/replaces that same draft rather than stacking a
    // second pending row -- so its still-unapproved photo/blocks/etc. are
    // the fallback base, not the older live data (which would otherwise
    // silently revert an in-review change whenever a field is omitted).
    const existingEdit = await env.DB.prepare(
      "SELECT id, proposed_json FROM dots_alumni_edits WHERE alumni_id = ? AND status = 'pending'",
    ).bind(current.id).first();
    let base = current;
    if (existingEdit) {
      try { base = JSON.parse(existingEdit.proposed_json); } catch { base = current; }
    }

    const name = String(form.get('name') || '').trim().slice(0, MAX_NAME_CHARS);
    const pronouns = String(form.get('pronouns') || '').trim().slice(0, MAX_PRONOUNS_CHARS);
    const currentRole = String(form.get('current_role') || '').trim().slice(0, MAX_ROLE_CHARS);
    const location = String(form.get('location') || '').trim().slice(0, MAX_LOCATION_CHARS);
    const quote = String(form.get('quote') || '').trim().slice(0, MAX_QUOTE_CHARS);
    const bio = String(form.get('bio') || '').trim().slice(0, MAX_BIO_CHARS);
    const story = String(form.get('story') || '').trim().slice(0, MAX_STORY_CHARS);
    if (!name) return badRequest('Name is required');
    if (!bio) return badRequest('A short bio is required');

    // Photo(s) are optional on an edit -- no new upload means "keep what's
    // already live", unlike the initial submission where a photo is
    // required.
    const file = form.get('photo');
    let photoUrl = base.photo_url;
    try {
      if (file && typeof file !== 'string') photoUrl = (await uploadImage(env, file)) || photoUrl;
    } catch (err) {
      return badRequest(err.message);
    }

    const extraFiles = form.getAll('photos').filter((f) => f && typeof f !== 'string').slice(0, MAX_EXTRA_PHOTOS);
    let extraPhotoUrls = JSON.parse(base.photos_json || '[]');
    if (extraFiles.length) {
      try {
        extraPhotoUrls = [];
        for (const extra of extraFiles) {
          const url = await uploadImage(env, extra);
          if (url) extraPhotoUrls.push(url);
        }
      } catch (err) {
        return badRequest(err.message);
      }
    }

    const links = LINK_FIELDS
      .map(([field, label]) => ({ label, url: normalizeUrl(form.get(field)) }))
      .filter((l) => l.url);

    let blocks = null;
    const rawBlocks = form.get('blocks');
    if (rawBlocks) {
      try { blocks = sanitizeBlocks(JSON.parse(rawBlocks)); } catch { blocks = null; }
    }

    const proposed = {
      name,
      pronouns: pronouns || null,
      current_role: currentRole || null,
      location: location || null,
      quote: quote || null,
      bio, story: story || null, photo_url: photoUrl,
      photos_json: JSON.stringify(extraPhotoUrls),
      links_json: JSON.stringify(links),
      blocks_json: blocks ? JSON.stringify(blocks) : null,
    };

    if (existingEdit) {
      // type is reset to 'edit' explicitly -- this also covers "changed my
      // mind": submitting an edit here overwrites a previously pending
      // deletion request on the same row (see request-deletion.js).
      await env.DB.prepare(
        "UPDATE dots_alumni_edits SET type = 'edit', proposed_json = ?, submitted_at = datetime('now') WHERE id = ?",
      ).bind(JSON.stringify(proposed), existingEdit.id).run();
      return json({ ok: true, id: existingEdit.id });
    }

    const id = randomId();
    await env.DB.prepare(
      "INSERT INTO dots_alumni_edits (id, alumni_id, type, proposed_json, status) VALUES (?, ?, 'edit', ?, 'pending')",
    ).bind(id, current.id, JSON.stringify(proposed)).run();

    return json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
