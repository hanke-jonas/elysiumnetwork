export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
}

export function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

export function unauthorized(message = 'Not signed in') {
  return json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Not allowed') {
  return json({ error: message }, { status: 403 });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);
}

export function randomId() {
  return crypto.randomUUID();
}
