// Public, unauthenticated — these are meant to be viewable on the public
// site (team photos, blog cover images). Keys are random UUIDs assigned at
// upload time, so nothing sensitive is exposed by serving them openly.
export async function onRequestGet({ env, params }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!env.UPLOADS) return new Response('Not found', { status: 404 });

  const object = await env.UPLOADS.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  // Keys are random and never reused for different content, so this is
  // always safe to cache indefinitely.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
