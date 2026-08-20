import { badRequest, json, randomId } from '../../_lib/http.js';

// A participant reuses their already-claimed access code to propose a
// change to their own existing entry. Never touches the live dots_alumni
// row directly -- writes to dots_alumni_edits as 'pending', which staff
// review and approve/reject in /admin/dots-edits/. This is the
// "complex system" half of the invite flow: functions/api/dots-alumni/
// submit.js's code claim is permanent once linked to an entry (see
// check-code.js's "edit" mode), so the same code that got someone in
// keeps working as their ongoing edit key.
//
// The submitted fields are always the participant's FULL current page
// (the edit form pre-fills every field from check-code's response, same
// as create mode), so there's no partial-field merging to do -- validate,
// store, done. blocks_json is explicitly nulled in the proposal: an older
// entry built through the since-retired drag-and-drop page builder still
// has one, and leaving it untouched would make the public profile page
// keep rendering the stale block order instead of these new field edits
// (see the {% if unified %} branch in src/dots/alumni-profile.njk).
const MAX_NAME_CHARS = 100;
const MAX_PRONOUNS_CHARS = 30;
const MAX_ROLE_CHARS = 120;
const MAX_LOCATION_CHARS = 80;
const MAX_QUOTE_CHARS = 300;
const MAX_BIO_CHARS = 600;
const MAX_STORY_CHARS = 4000;
const MAX_EXTRA_PHOTOS = 6;
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

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');
    if (form.get('website_hp')) return json({ ok: true }, { status: 201 });
    if (!form.get('consent')) return badRequest('Please confirm you agree to have your page published before submitting.');

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT used_at, dots_alumni_id FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow || !codeRow.used_at || !codeRow.dots_alumni_id) {
      return badRequest('That access code is not linked to an existing entry.');
    }

    const current = await env.DB.prepare('SELECT id FROM dots_alumni WHERE id = ?').bind(codeRow.dots_alumni_id).first();
    if (!current) return badRequest('That entry no longer exists.');

    const name = String(form.get('name') || '').trim().slice(0, MAX_NAME_CHARS);
    const pronouns = String(form.get('pronouns') || '').trim().slice(0, MAX_PRONOUNS_CHARS);
    const currentRole = String(form.get('current_role') || '').trim().slice(0, MAX_ROLE_CHARS);
    const location = String(form.get('location') || '').trim().slice(0, MAX_LOCATION_CHARS);
    const quote = String(form.get('quote') || '').trim().slice(0, MAX_QUOTE_CHARS);
    const bio = String(form.get('bio') || '').trim().slice(0, MAX_BIO_CHARS);
    const story = String(form.get('story') || '').trim().slice(0, MAX_STORY_CHARS);
    const photoUrl = String(form.get('photo_url') || '').trim().slice(0, 500);

    let extraPhotos;
    try { extraPhotos = JSON.parse(form.get('photos') || '[]'); } catch { extraPhotos = []; }
    if (!Array.isArray(extraPhotos)) extraPhotos = [];
    extraPhotos = extraPhotos.filter((u) => typeof u === 'string' && u).slice(0, MAX_EXTRA_PHOTOS);

    if (!name) return badRequest('A name is required');
    if (!bio) return badRequest('A short bio is required');

    const links = LINK_FIELDS
      .map(([field, label]) => ({ label, url: normalizeUrl(form.get(field)) }))
      .filter((l) => l.url);

    const proposed = {
      name,
      pronouns: pronouns || null,
      current_role: currentRole || null,
      location: location || null,
      quote: quote || null,
      bio,
      story: story || null,
      photo_url: photoUrl,
      photos_json: JSON.stringify(extraPhotos),
      links_json: JSON.stringify(links),
      blocks_json: null,
    };

    // If an earlier visit already left a proposal awaiting review, this
    // submission replaces that same draft rather than stacking a second
    // pending row. type is reset to 'edit' explicitly -- this also covers
    // "changed my mind": submitting an edit here overwrites a previously
    // pending deletion request on the same row (see request-deletion.js).
    const existingEdit = await env.DB.prepare(
      "SELECT id FROM dots_alumni_edits WHERE alumni_id = ? AND status = 'pending'",
    ).bind(current.id).first();

    if (existingEdit) {
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
