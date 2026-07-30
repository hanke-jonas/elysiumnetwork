function page(title, message) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;text-align:center">` +
      `<h1>${title}</h1><p>${message}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Public link clicked from the welcome email — the token itself is the
// credential, same pattern as the newsletter confirm/unsubscribe links.
export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return page('Invalid link', 'This verification link is missing its token.');

  const row = await env.DB.prepare(
    "SELECT id, user_id, expires_at, used_at FROM public_user_tokens WHERE id = ? AND kind = 'verify_email'"
  ).bind(token).first();
  if (!row) return page('Invalid link', 'This verification link is invalid.');
  if (row.used_at) return page('Already verified', 'This email address has already been verified.');
  if (new Date(row.expires_at) < new Date()) return page('Link expired', 'This verification link has expired — log in and request a new one from your account page.');

  await env.DB.batch([
    env.DB.prepare('UPDATE public_users SET email_verified = 1 WHERE id = ?').bind(row.user_id),
    env.DB.prepare("UPDATE public_user_tokens SET used_at = datetime('now') WHERE id = ?").bind(row.id),
  ]);

  return page('Email verified', 'Thanks — your email address is confirmed. You can close this tab.');
}
