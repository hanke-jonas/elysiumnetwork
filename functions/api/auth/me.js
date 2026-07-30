import { getSession } from '../../_lib/session.js';
import { json } from '../../_lib/http.js';

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env.DB);
  if (!session) return json({ signedIn: false });
  return json({ signedIn: true, type: session.type, user: session.user });
}
