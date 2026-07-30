import { requireStaff } from '../../../../_lib/guard.js';
import { badRequest, json } from '../../../../_lib/http.js';
import { sendBatch } from '../../../../_lib/email.js';

// Deliberately its own endpoint rather than a PUT {status: 'sent'} on the
// campaign — sending has an irreversible side effect (real emails go out),
// so it gets its own explicit action rather than piggybacking on a generic
// update.
export async function onRequestPost({ request, env, params }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const campaign = await env.DB.prepare('SELECT * FROM newsletter_campaigns WHERE id = ?').bind(params.id).first();
  if (!campaign) return json({ error: 'Not found' }, { status: 404 });
  if (campaign.status !== 'draft') return badRequest('This campaign has already been sent');

  const subscribers = await env.DB.prepare(
    "SELECT email, token FROM newsletter_subscribers WHERE status = 'confirmed'"
  ).all();
  if (subscribers.results.length === 0) return badRequest('No confirmed subscribers to send to');

  await env.DB.prepare("UPDATE newsletter_campaigns SET status = 'sending' WHERE id = ?").bind(params.id).run();

  const emails = subscribers.results.map((s) => {
    const unsubUrl = new URL(`/api/newsletter/unsubscribe?token=${s.token}`, request.url).toString();
    return {
      to: s.email,
      subject: campaign.subject,
      html: `${campaign.body_html}<hr><p style="font-size:12px;color:#888"><a href="${unsubUrl}">Unsubscribe</a></p>`,
    };
  });

  try {
    const { sent } = await sendBatch(env, emails);
    await env.DB.prepare(
      "UPDATE newsletter_campaigns SET status = 'sent', sent_at = datetime('now'), recipient_count = ? WHERE id = ?"
    ).bind(sent, params.id).run();
    return json({ ok: true, sent });
  } catch (err) {
    // Left in 'sending' rather than reverted to 'draft' — a partial batch
    // failure may have already emailed some subscribers, so re-sending from
    // scratch would double-send them. Needs a human to look at it.
    return json({ error: 'Send failed partway through', detail: String(err) }, { status: 502 });
  }
}
