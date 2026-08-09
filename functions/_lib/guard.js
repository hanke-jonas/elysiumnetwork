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

// Elysium+ Cloud (the /portal/ area) is open to staff and members alike —
// a staff account's portal files live under users/<their staff id>/,
// exactly like a member's, just keyed by their staff_users row instead of
// a public_users one. session.user.id is a crypto.randomUUID() from
// either table, so there's no realistic collision between the two ID
// spaces sharing that prefix scheme.
export async function requireAnyUser(request, env) {
  const session = await getSession(request, env.DB);
  if (!session || (session.type !== 'public' && session.type !== 'staff')) return unauthorized('Sign-in required');
  return session;
}
