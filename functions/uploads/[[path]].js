import { bumpUsage } from '../_lib/usage.js';

const INLINE_SAFE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']);
const MAX_DIMENSION = 2000;

async function serveRaw(env, key, waitUntil) {
  const object = await env.UPLOADS.get(key);
  if (!object) return null;

  // Every file view on the site funnels through here — this is the hottest
  // path in the app, so the counter write must never add latency to it.
  // waitUntil lets the response return immediately while the write finishes
  // in the background.
  waitUntil(bumpUsage(env, 'view'));

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
  headers.set('X-Content-Type-Options', 'nosniff');
  const contentType = headers.get('content-type') || '';
  if (!INLINE_SAFE.has(contentType.split(';')[0].trim())) {
    headers.set('Content-Disposition', 'attachment');
  }

  return new Response(object.body, { headers });
}

// Public, unauthenticated — these are meant to be viewable on the public
// site (team photos, blog cover images, DOTS alumni photos). Keys are
// random UUIDs assigned at upload time, so nothing sensitive is exposed by
// serving them openly.
//
// Optional ?w=&h=(&face=1) query params request an automatically-cropped
// resize via Cloudflare's free Image Resizing (cf.image, up to 5,000
// unique transformations/month at no cost) -- added specifically so a
// photo with a face that isn't dead-center doesn't get awkwardly cropped
// by plain CSS object-fit:cover (see src/_data's callers, e.g. the DOTS
// alumni gallery/profile pages).
//
// cf.image only applies to an outgoing fetch() subrequest, not to bytes
// read directly off the R2 binding -- there's no Images-binding-style
// direct-bytes path on the free tier. So a transform request re-fetches
// this SAME route (adding a `__raw=1` marker, never used by real page
// markup) to get the untransformed bytes back as a normal HTTP response,
// and lets Cloudflare's edge transform pipeline act on that subrequest.
// Requests with no w/h params never take this branch and behave exactly
// as before.
export async function onRequestGet({ request, env, params, waitUntil }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : params.path;
  if (!env.UPLOADS) return new Response('Not found', { status: 404 });

  const url = new URL(request.url);
  const isRawRequest = url.searchParams.has('__raw');
  const width = parseInt(url.searchParams.get('w'), 10);
  const height = parseInt(url.searchParams.get('h'), 10);
  const wantsTransform = !isRawRequest && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;

  if (wantsTransform) {
    const rawUrl = new URL(request.url);
    rawUrl.searchParams.set('__raw', '1');
    try {
      const transformed = await fetch(rawUrl.toString(), {
        cf: {
          image: {
            fit: 'cover',
            width: Math.min(width, MAX_DIMENSION),
            height: Math.min(height, MAX_DIMENSION),
            gravity: url.searchParams.get('face') === '1' ? 'face' : 'auto',
          },
        },
      });
      // Falls through to the plain raw serve below if the source isn't an
      // image Cloudflare can transform (e.g. a PDF) or the transform
      // failed for any other reason -- a slightly-wrong crop beats a
      // broken image.
      if (transformed.ok) {
        const headers = new Headers(transformed.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(transformed.body, { headers });
      }
    } catch {
      // Same fallback reasoning as above -- fetch() itself can reject.
    }
  }

  const raw = await serveRaw(env, key, waitUntil);
  // Explicit no-store: this zone's cache rules key on path only (ignoring
  // query strings) for this route, so an uncached-by-default error
  // response is what stops one transient transform failure (a cold start,
  // a hiccup in the resize pipeline) from getting stuck serving 404 to
  // every other ?w=&h= variant of the same path for its full cache TTL.
  return raw || new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
