function page(title, message) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;text-align:center">` +
      `<h1>${title}</h1><p>${message}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Public link clicked from the confirmation email — no login involved, the
// token itself is the credential (mirrors how every other newsletter
// confirm/unsubscribe link on the web works).
export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return page('Invalid link', 'This confirmation link is missing its token.');

  const row = await env.DB.prepare('SELECT id, status FROM newsletter_subscribers WHERE token = ?').bind(token).first();
  if (!row) return page('Invalid link', 'This confirmation link is invalid or has expired.');

  if (row.status !== 'confirmed') {
    await env.DB.prepare(
      "UPDATE newsletter_subscribers SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?"
    ).bind(row.id).run();
  }
  return page('Subscription confirmed', "You're on the list — thanks for subscribing to the Elysium+ Network newsletter.");
}
