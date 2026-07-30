function page(title, message) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;text-align:center">` +
      `<h1>${title}</h1><p>${message}</p></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return page('Invalid link', 'This unsubscribe link is missing its token.');

  const row = await env.DB.prepare('SELECT id FROM newsletter_subscribers WHERE token = ?').bind(token).first();
  if (!row) return page('Invalid link', 'This unsubscribe link is invalid or has expired.');

  await env.DB.prepare(
    "UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE id = ?"
  ).bind(row.id).run();
  return page("You're unsubscribed", 'You will no longer receive the Elysium+ Network newsletter.');
}
