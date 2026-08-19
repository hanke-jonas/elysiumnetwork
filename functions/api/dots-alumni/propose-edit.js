import { badRequest, json, randomId } from '../../_lib/http.js';
import { sanitizeBlocks, deriveCoreFields, validateCoreFields } from '../../_lib/dotsBlocks.js';

// A participant reuses their already-claimed access code to propose a
// change to their own existing entry. Never touches the live dots_alumni
// row directly -- writes to dots_alumni_edits as 'pending', which staff
// review and approve/reject in /admin/dots-edits/. This is the
// "complex system" half of the invite flow: functions/api/dots-alumni/
// submit.js's code claim is permanent once linked to an entry (see
// check-code.js's "edit" mode), so the same code that got someone in
// keeps working as their ongoing edit key.
//
// The submitted `blocks` is always the participant's FULL current page
// (the edit form pre-fills every block from check-code's response, same
// as create mode), so unlike the old per-field version of this endpoint
// there's no partial-field merging to do -- sanitize, derive, validate,
// store, done.
export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData().catch(() => null);
    if (!form) return badRequest('Invalid form submission');
    if (form.get('website_hp')) return json({ ok: true }, { status: 201 });

    const code = String(form.get('code') || '').trim().toUpperCase();
    if (!code) return badRequest('An access code is required');
    const codeRow = await env.DB.prepare('SELECT used_at, dots_alumni_id FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!codeRow || !codeRow.used_at || !codeRow.dots_alumni_id) {
      return badRequest('That access code is not linked to an existing entry.');
    }

    const current = await env.DB.prepare('SELECT id FROM dots_alumni WHERE id = ?').bind(codeRow.dots_alumni_id).first();
    if (!current) return badRequest('That entry no longer exists.');

    let blocks;
    try { blocks = sanitizeBlocks(JSON.parse(form.get('blocks') || '[]')); } catch { blocks = null; }
    if (!blocks) return badRequest('Your page is empty — add at least a name, photo, and bio.');

    const core = deriveCoreFields(blocks);
    const coreError = validateCoreFields(core);
    if (coreError) return badRequest(coreError);

    const proposed = {
      name: core.name,
      pronouns: core.pronouns,
      current_role: core.current_role,
      location: core.location,
      quote: core.quote,
      bio: core.bio,
      photo_url: core.photo_url,
      photos_json: '[]',
      links_json: core.links_json,
      blocks_json: JSON.stringify(blocks),
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
