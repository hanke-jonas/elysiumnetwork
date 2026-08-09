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
  // Uploads now accept any file type (not just images/PDFs). Serving an
  // arbitrary type inline at this origin would let something like an
  // uploaded .html or .svg file execute script in the browser when someone
  // opens its URL directly — nosniff plus forcing anything outside this
  // small known-safe set to download instead closes that off without
  // affecting the images/PDFs this endpoint has always served inline.
  const INLINE_SAFE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
  headers.set('X-Content-Type-Options', 'nosniff');
  const contentType = headers.get('content-type') || '';
  if (!INLINE_SAFE.has(contentType.split(';')[0].trim())) {
    headers.set('Content-Disposition', 'attachment');
  }

  return new Response(object.body, { headers });
}
