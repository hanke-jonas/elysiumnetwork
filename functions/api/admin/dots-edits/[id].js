import { requireStaff } from '../../../_lib/guard.js';
import { badRequest, json } from '../../../_lib/http.js';
import { scheduleRebuild } from '../../../_lib/rebuild.js';

const PROPOSED_FIELD_MAP = {
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

// Approve copies proposed_json's fields onto the live dots_alumni row and
// closes out the edit; reject just closes it out. Neither ever touches
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

    if (body.action === 'approve') {
      let proposed;
      try { proposed = JSON.parse(edit.proposed_json); } catch { return badRequest('Stored proposal is corrupt'); }

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
