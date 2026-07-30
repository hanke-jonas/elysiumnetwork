import { getSession } from './session.js';
import { unauthorized, forbidden } from './http.js';

// Returns a session if the request is from a signed-in staff member,
// otherwise returns a Response to short-circuit the handler with. Callers
// do: `const s = await requireStaff(...); if (s instanceof Response) return s;`
export async function requireStaff(request, env, { requireOwner = false } = {}) {
  const session = await getSession(request, env.DB);
  if (!session || session.type !== 'staff') return unauthorized('Staff sign-in required');
  if (requireOwner && session.user.role !== 'owner') return forbidden('Owner role required');
  return session;
}

export async function requirePublic(request, env) {
  const session = await getSession(request, env.DB);
  if (!session || session.type !== 'public') return unauthorized('Sign-in required');
  return session;
}
