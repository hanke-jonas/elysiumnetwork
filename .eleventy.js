const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const site = require('./src/_data/site.js');

const ICONS = {
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>',
  telegram: '<path d="M21 4 3 11l5 2 2 6 3-4 5 4z"/><path d="m8 13 8-6"/>',
  whatsapp: '<path d="M3 21l1.6-4A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9c0 4 2 6 6 6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>',
  spark: '<path d="M12 3v6m0 6v6M3 12h6m6 0h6"/><path d="M5.6 5.6 9 9m6 6 3.4 3.4M18.4 5.6 15 9M9 15l-3.4 3.4"/>',
  heart: '<path d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  vote: '<path d="m9 12 2 2 4-4"/><rect x="3" y="4" width="18" height="16" rx="2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16z"/><path d="M4 20c3-6 7-9 12-10"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'arrow-ur': '<path d="M7 17 17 7M7 7h10v10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h4M14 14h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m14.5 9.5-2 5-5 2 2-5z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  venus: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M8.5 19h7"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.8-2 3.5"/><path d="M12 17h.01"/>',
  chart: '<path d="M4 20V10m8 10V4m8 16v-7"/><path d="M2 20h20"/>',
};

module.exports = function (eleventyConfig) {
  eleventyConfig.addShortcode('icon', function (name, cls) {
    cls = cls || 'w-5 h-5';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  });

  eleventyConfig.addShortcode('heartFill', function (color, cls) {
    cls = cls || 'w-5 h-5';
    color = color || 'currentColor';
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
  });

  eleventyConfig.addShortcode('year', () => String(new Date().getUTCFullYear()));

  // A consistent illustrated empty state (icon in a dashed badge + heading +
  // optional subtext) for every "nothing published yet" moment across the
  // public site — replaces what used to be a bare line of text in a card.
  eleventyConfig.addShortcode('emptyState', function (icon, title, subtitle) {
    const iconSvg = `<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon] || ''}</svg>`;
    return `<div class="card p-10 sm:p-14 text-center max-w-xl mx-auto">
      <div class="w-16 h-16 mx-auto rounded-2xl border-2 border-dashed border-ink grid place-items-center mb-5 rotate-2" style="color:var(--blue-ink)">${iconSvg}</div>
      <h2 class="h-card">${title}</h2>
      ${subtitle ? `<p class="mt-2 text-muted leading-relaxed">${subtitle}</p>` : ''}
    </div>`;
  });

  // e.g. {{ post.publishedAt | readableDate }} -> "30 July 2026"
  eleventyConfig.addFilter('readableDate', function (value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  // Nunjucks (unlike Jinja2) never shipped selectattr/rejectattr, so this
  // is the plain way to find "the one call to feature" in a nav dropdown:
  // prefer an open call, then one coming up, and only fall back to
  // whatever's first (which could be closed) so the panel is never empty
  // (calls.js's fallback data guarantees the array itself is never empty)
  // -- never surface a closed call ahead of a live/upcoming one.
  eleventyConfig.addFilter('firstOpenOrFirst', function (arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.find((c) => c.status === 'open') || arr.find((c) => c.status === 'coming_up') || arr[0];
  });

  eleventyConfig.addPassthroughCopy('src/robots.txt');
  eleventyConfig.addPassthroughCopy('src/_redirects');
  eleventyConfig.addPassthroughCopy('src/assets');

  // Compiled here (not via a separate package.json script) so the CSS is
  // always regenerated no matter how the build is actually invoked —
  // `npx eleventy`, `npm run build`, or whatever command Cloudflare Pages'
  // dashboard has configured — rather than depending on script ordering
  // that this config file has no visibility into.
  eleventyConfig.on('eleventy.before', () => {
    execSync('npx tailwindcss -i ./src/styles/main.css -o ./src/assets/tailwind.css --minify', { stdio: 'inherit' });
  });

  // Cache-Control on /assets/tailwind.css is 4h with no content hash in the
  // URL (Cloudflare's default browser TTL) — without this, anyone who
  // loaded the site in the last 4 hours keeps the pre-deploy CSS bundle
  // while getting post-deploy HTML, so newly-added utility classes (e.g. a
  // template switching to grid-cols-3) silently don't exist yet on their
  // end. Query string changes with the compiled file's content, so it's a
  // new URL — and a cache miss — on every deploy that actually changes CSS.
  eleventyConfig.addGlobalData('cssVersion', () => {
    try {
      const css = fs.readFileSync(path.join(__dirname, 'src/assets/tailwind.css'));
      return crypto.createHash('md5').update(css).digest('hex').slice(0, 10);
    } catch {
      return Date.now().toString(36);
    }
  });

  // Full-text search index, built from the final rendered HTML (results is
  // guaranteed complete here, unlike collections.all mid-build) so the
  // search bar can match any word anywhere on any page's real body copy —
  // not just a short hand-written blurb.
  eleventyConfig.on('eleventy.after', ({ dir, results }) => {
    const stripHtml = (html) =>
      String(html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

    const pages = results
      .filter((r) => r.url && r.content && r.url !== '/404.html' && !r.url.startsWith('/admin/') && !r.url.startsWith('/portal/'))
      .map((r) => {
        const titleMatch = r.content.match(/<title>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? stripHtml(titleMatch[1]) : r.url;
        const bodyMatch = r.content.match(/<!--SEARCH-CONTENT-START-->([\s\S]*?)<!--SEARCH-CONTENT-END-->/);
        const text = stripHtml(bodyMatch ? bodyMatch[1] : r.content);
        return { url: r.url, title, text };
      })
      .filter((p) => p.text.length > 0);

    fs.writeFileSync(path.join(dir.output, 'search-index.json'), JSON.stringify(pages));

    // Same collections.all-incompleteness issue as above rules out a normal
    // sitemap.njk template — built from the same guaranteed-complete
    // `results` array instead.
    const urls = results.filter((r) => r.url && !r.url.endsWith('.json') && r.url !== '/404.html').map((r) => r.url);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${site.url}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
    fs.writeFileSync(path.join(dir.output, 'sitemap.xml'), sitemap);
  });

  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
