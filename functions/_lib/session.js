// Shared session handling for both staff and public accounts. One cookie,
// one table, discriminated by `user_type` — see d1/schema.sql for why
// staff/public accounts themselves stay in separate tables.
const COOKIE_NAME = 'elysium_session';
const SESSION_DAYS = 30;

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db, userType, userId) {
  const id = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare('INSERT INTO sessions (id, user_type, user_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, userType, userId, expires)
    .run();
  return { id, expires };
}

export function sessionCookieHeader(sessionId, expires) {
  const parts = [
    `${COOKIE_NAME}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Expires=${new Date(expires).toUTCString()}`,
  ];
  return parts.join('; ');
}

export function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function readCookie(request) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

// Returns { type: 'staff'|'public', user: {...} } or null. Expired sessions
// are deleted opportunistically rather than needing a separate cron job.
export async function getSession(request, db) {
  const sessionId = readCookie(request);
  if (!sessionId) return null;

  const row = await db.prepare('SELECT * FROM sessions WHERE id = ?').bind(sessionId).first();
  if (!row) return null;

  if (new Date(row.expires_at) < new Date()) {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }

  const table = row.user_type === 'staff' ? 'staff_users' : 'public_users';
  const user = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(row.user_id).first();
  if (!user) return null;
  delete user.password_hash;
  return { type: row.user_type, user, sessionId };
}

export async function destroySession(request, db) {
  const sessionId = readCookie(request);
  if (sessionId) await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}
