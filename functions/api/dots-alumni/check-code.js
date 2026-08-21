import { badRequest, json } from '../../_lib/http.js';

// Public, unauthenticated -- lets the submission page validate a code
// before revealing the full form, and tells it which mode to show:
// - Fresh code (never used): "create" -- the normal new-submission form.
// - Already used, linked to an entry: "edit" -- the participant is
//   proposing changes to their existing page. Returns the entry's
//   current data so the form can be pre-filled.
//   If a proposal from an earlier visit is still awaiting review, that
//   pending proposal's data is returned instead of the live entry's, and
//   `hasPendingEdit: true` is set -- so re-entering the code continues
//   editing the same not-yet-approved draft rather than starting over
//   from stale live data or piling up a second pending proposal
//   (functions/api/dots-alumni/propose-edit.js updates that same row in
//   place when one already exists).
// Never claims/mutates the code itself -- functions/api/dots-alumni/
// submit.js and propose-edit.js do that atomically at actual submission.
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => null);
    const code = String((body && body.code) || '').trim().toUpperCase();
    if (!code) return badRequest('Code is required');

    const row = await env.DB.prepare('SELECT edition, used_at, dots_alumni_id, entry_deleted_at FROM dots_access_codes WHERE code = ?').bind(code).first();
    if (!row) return json({ valid: false, error: 'That code was not recognized.' });

    if (!row.used_at) {
      return json({ valid: true, mode: 'create', edition: row.edition });
    }

    if (!row.dots_alumni_id) {
      // entry_deleted_at is set (by the admin delete / approve-deletion
      // endpoints) whenever this is a real "your entry was removed" case --
      // that's the overwhelmingly common way a used code ends up
      // unlinked. Without it, dots_alumni_id is null only from the narrow
      // race in submit.js between claiming the code and linking it (should
      // basically never happen, but fail safe with a distinct message).
      return json({
        valid: false,
        error: row.entry_deleted_at
          ? 'The entry this code belonged to no longer exists — get in touch with staff if that seems wrong.'
          : "This code isn't linked to an entry — get in touch with staff if that seems wrong.",
      });
    }

    const alumnus = await env.DB.prepare('SELECT * FROM dots_alumni WHERE id = ?').bind(row.dots_alumni_id).first();
    if (!alumnus) return json({ valid: false, error: 'The entry this code belonged to no longer exists — get in touch with staff if that seems wrong.' });

    const pendingEdit = await env.DB.prepare(
      "SELECT type, proposed_json FROM dots_alumni_edits WHERE alumni_id = ? AND status = 'pending'",
    ).bind(alumnus.id).first();
    const pendingDeletion = Boolean(pendingEdit && pendingEdit.type === 'delete');

    // A pending deletion's proposed_json is just '{}' -- prefill from the
    // still-live data in that case, not the empty placeholder.
    let source = alumnus;
    if (pendingEdit && !pendingDeletion) {
      try { source = JSON.parse(pendingEdit.proposed_json); } catch { source = alumnus; }
    }

    return json({
      valid: true,
      mode: 'edit',
      edition: row.edition,
      hasPendingEdit: Boolean(pendingEdit) && !pendingDeletion,
      hasPendingDeletion: pendingDeletion,
      current: {
        slug: source.slug || alumnus.slug,
        name: source.name,
        pronouns: source.pronouns,
        currentRole: source.current_role,
        location: source.location,
        quote: source.quote,
        bio: source.bio,
        story: source.story,
        photoUrl: source.photo_url,
        photos: JSON.parse(source.photos_json || '[]'),
        links: JSON.parse(source.links_json || '[]'),
        blocks: JSON.parse(source.blocks_json || 'null'),
      },
    });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
