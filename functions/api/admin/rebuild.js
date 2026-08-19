import { requireStaff } from '../../_lib/guard.js';
import { json } from '../../_lib/http.js';
import { triggerDeploy } from '../../_lib/rebuild.js';

// Manual trigger backing the dashboard's "Publish changes" button. Most
// content saves now also trigger this automatically (see
// functions/_lib/rebuild.js's scheduleRebuild, wired into every
// content-mutating admin endpoint) -- this stays as a fallback for
// anything not covered, or for staff who just want to force a fresh build.
export async function onRequestPost({ request, env }) {
  const staff = await requireStaff(request, env);
  if (staff instanceof Response) return staff;

  const result = await triggerDeploy(env);
  if (!result.ok) {
    // 500, not 502 — Cloudflare's edge reserves 502 for real
    // origin-connectivity failures and replaces the response body with its
    // own generic error page even for a deliberate Worker response.
    return json({ error: result.error || 'Cloudflare API returned an error', status: result.status, detail: result.detail }, { status: 500 });
  }
  return json({ ok: true, triggeredAt: new Date().toISOString(), deploymentId: result.deploymentId });
}
