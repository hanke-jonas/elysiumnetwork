import { destroySession, clearCookieHeader } from '../../_lib/session.js';
import { json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  await destroySession(request, env.DB);
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookieHeader() } });
}
