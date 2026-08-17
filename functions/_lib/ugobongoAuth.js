// HTTP Basic Auth gate for the hidden /ugobongo-admin mini panel -- kept
// completely separate from the real site's staff/session auth on purpose,
// since this only ever controls one joke page. Credentials come from
// UGOBONGO_ADMIN_USER / UGOBONGO_ADMIN_PASS (Cloudflare Pages secrets),
// never from a string committed to the repo -- a value like "Trump"/
// "Trump" is fine to actually use, but only as a secret you set yourself
// in the Cloudflare dashboard, not as plaintext sitting in git history
// for anyone with repo access to read.
export function requireUgobongoAdmin(request, env) {
  if (!env.UGOBONGO_ADMIN_USER || !env.UGOBONGO_ADMIN_PASS) {
    return new Response('Ugobongo admin is not configured -- set UGOBONGO_ADMIN_USER and UGOBONGO_ADMIN_PASS as Pages secrets.', { status: 503 });
  }

  const auth = request.headers.get('Authorization') || '';
  const expected = 'Basic ' + btoa(`${env.UGOBONGO_ADMIN_USER}:${env.UGOBONGO_ADMIN_PASS}`);

  // Constant-time-ish compare isn't critical here (this isn't the main
  // site's real auth, and Basic Auth over HTTPS already sends the
  // credential in the clear to this Worker on every request) -- a plain
  // compare is consistent with the low stakes of this one joke feature.
  if (auth !== expected) {
    return new Response('Authentication required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Ugobongo Admin"' },
    });
  }

  return null;
}
