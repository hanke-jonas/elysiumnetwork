import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';
import { sanitizeBlocks, deriveCoreFields, validateCoreFields } from '../../../_lib/dotsBlocks.js';

const MAX_SLUG_CHARS = 60;
function slugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG_CHARS).replace(/-+$/, '');
}

const PROPOSED_FIELD_MAP = {
  slug: 'slug',
  name: 'name',
  pronouns: 'pronouns',
  current_role: 'current_role',
  location: 'location',
  quote: 'quote',
  bio: 'bio',
  story: 'story',
  photo_url: 'photo_url',
  photos_json: 'photos_json',
  links_json: 'links_json',
  blocks_json: 'blocks_json',
};

// Approve on an 'edit' row normally copies proposed_json's fields onto
// the live dots_alumni row verbatim -- but the review screen
// (src/admin/dots.njk) lets staff adjust the proposed blocks (and
// the requested page address) right there before approving, so an
// optional `blocks` array (and `slug` string) in the request body
// overrides the stored proposal entirely: this re-derives the flat
// columns from whatever staff actually left in the editor, same as a
// normal submission. Approve on a 'delete' row (see functions/api/
// dots-alumni/request-deletion.js) deletes it outright, same FK-safe
// order as the direct admin delete in functions/api/admin/dots-alumni/
// [id].js. Reject just closes the review out either way -- the live
// entry (or lack of one) is untouched. Neither ever touches
// dots_alumni.status -- an edit proposal can't un-publish or re-queue an
// already-published entry, it only changes its content.
export async function onRequestPut({ request, env, params, waitUntil }) {
  try {
    const staff = await requireStaff(request, env);
    if (staff instanceof Response) return staff;

    const body = await request.json().catch(() => null);
    if (!body || (body.action !== 'approve' && body.action !== 'reject')) {
      return badRequest("action must be 'approve' or 'reject'");
    }

    const edit = await env.DB.prepare('SELECT * FROM dots_alumni_edits WHERE id = ?').bind(params.id).first();
    if (!edit) return json({ error: 'Not found' }, { status: 404 });
    if (edit.status !== 'pending') return badRequest('This proposal has already been reviewed.');

    if (body.action === 'approve' && edit.type === 'delete') {
      await env.DB.prepare("UPDATE dots_access_codes SET dots_alumni_id = NULL, entry_deleted_at = datetime('now') WHERE dots_alumni_id = ?").bind(edit.alumni_id).run();
      await env.DB.prepare('DELETE FROM dots_alumni_edits WHERE alumni_id = ?').bind(edit.alumni_id).run();
      await env.DB.prepare('DELETE FROM dots_alumni WHERE id = ?').bind(edit.alumni_id).run();
      waitUntil(scheduleRebuild(env));
      return json({ ok: true });
    }

    if (body.action === 'approve') {
      let proposed;
      if (Array.isArray(body.blocks)) {
        const blocks = sanitizeBlocks(body.blocks);
        if (!blocks) return badRequest('Your page is empty — add at least a name and bio.');
        const core = deriveCoreFields(blocks);
        const coreError = validateCoreFields(core);
        if (coreError) return badRequest(coreError);
        proposed = {
          name: core.name, pronouns: core.pronouns, current_role: core.current_role, location: core.location,
          quote: core.quote, bio: core.bio, photo_url: core.photo_url, photos_json: '[]',
          links_json: core.links_json, blocks_json: JSON.stringify(blocks),
        };
        if (typeof body.slug === 'string') proposed.slug = slugify(body.slug) || slugify(core.name) || 'alumnus';
      } else {
        try { proposed = JSON.parse(edit.proposed_json); } catch { return badRequest('Stored proposal is corrupt'); }
      }

      // Re-checked here (not just at propose-edit time) since the address
      // could have been claimed by someone else in the time this proposal
      // sat pending review.
      if (proposed.slug) {
        const collision = await env.DB.prepare('SELECT id FROM dots_alumni WHERE slug = ? AND id != ?').bind(proposed.slug, edit.alumni_id).first();
        if (collision) return badRequest(`elysium.ngo/dots/alumni/${proposed.slug}/ is already taken by another entry — change the page address before approving.`);
      }

      const sets = [];
      const values = [];
      for (const [key, col] of Object.entries(PROPOSED_FIELD_MAP)) {
        if (!(key in proposed)) continue;
        sets.push(`${col} = ?`);
        values.push(proposed[key] === undefined ? null : proposed[key]);
      }
      if (sets.length) {
        values.push(edit.alumni_id);
        await env.DB.prepare(`UPDATE dots_alumni SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
      }
    }

    await env.DB.prepare(
      "UPDATE dots_alumni_edits SET status = ?, reviewed_at = datetime('now') WHERE id = ?",
    ).bind(body.action === 'approve' ? 'approved' : 'rejected', params.id).run();

    if (body.action === 'approve') waitUntil(scheduleRebuild(env));
    return json({ ok: true });
  } catch (err) {
    return json({ error: 'Unexpected server error', detail: String(err) }, { status: 500 });
  }
}
