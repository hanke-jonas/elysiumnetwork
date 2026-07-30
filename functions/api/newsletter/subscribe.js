import { json } from '../../_lib/http.js';

export async function onRequestPost({ request, env }) {
  return json({ ok: true, debug: 'minimal handler, no D1, no email' });
}
