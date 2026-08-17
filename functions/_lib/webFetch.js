// Lets the ugobongo admin chat assistant "research from the web" -- fetches
// a single URL server-side and extracts its visible text via HTMLRewriter
// (built into the Workers runtime, no external library needed). Capped
// hard on size/time so one fetch_url action can't hang the request or
// pull down something huge.
const MAX_FETCH_BYTES = 500_000;
const MAX_TEXT_CHARS = 8000;
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'head']);

class TextExtractor {
  constructor() {
    this.chunks = [];
    this.skipDepth = 0;
  }
  element(el) {
    if (SKIP_TAGS.has(el.tagName)) {
      this.skipDepth++;
      el.onEndTag(() => { this.skipDepth = Math.max(0, this.skipDepth - 1); });
    }
  }
  text(chunk) {
    if (this.skipDepth === 0 && chunk.text.trim()) this.chunks.push(chunk.text);
  }
}

export async function fetchAndExtractText(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'Not a valid URL.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Only http(s) URLs are allowed.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UgobongoAdminBot/1.0)' },
    });
  } catch (err) {
    return { error: `Fetch failed: ${err.message || err}` };
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return { error: `Fetch returned HTTP ${res.status}` };

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
    return { error: `Unsupported content type: ${contentType || 'unknown'}` };
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_FETCH_BYTES) {
    return { error: `Page too large (${Math.round(buf.byteLength / 1024)}KB, limit ${MAX_FETCH_BYTES / 1024}KB)` };
  }

  if (contentType.includes('text/plain')) {
    return { text: new TextDecoder().decode(buf).slice(0, MAX_TEXT_CHARS) };
  }

  const extractor = new TextExtractor();
  const rewriter = new HTMLRewriter().on('*', extractor);
  const transformed = rewriter.transform(new Response(buf));
  await transformed.text();

  const text = extractor.chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
  return { text: text || '(no readable text found on this page)' };
}
