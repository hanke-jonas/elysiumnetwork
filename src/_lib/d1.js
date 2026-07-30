// Shared content-fetch helper for build-time Eleventy data files.
//
// Eleventy's build runs in a plain Node process (Cloudflare Pages' build
// step), not inside the Workers/Pages-Functions runtime — so it has no
// direct access to the `env.DB` binding the Functions in functions/api/*
// use, and Cloudflare Pages' "Wrangler configuration file (BETA)" build
// pipeline does not reliably expose custom project environment variables
// to that build step (confirmed empirically: a CF_D1_API_TOKEN set via the
// Pages API never showed up in process.env during an actual build, despite
// the same value being correctly attached to the deployment record).
//
// So instead of talking to Cloudflare's D1-over-HTTP API directly (which
// would need that unreliable secret at build time), this fetches from the
// site's OWN already-deployed public admin list endpoints — the exact same
// GET /api/admin/<resource> routes the admin panel itself uses, which are
// unauthenticated for reads (see functions/_lib/crud.js) and already return
// JSON fields pre-parsed into real arrays. No credentials needed at all.
//
// Every data file that calls this degrades to its hardcoded fallback when
// the fetch fails (e.g. the very first deployment ever, before any Function
// has gone live yet), so the site keeps building normally in that case and
// in local dev.
const SITE_BASE_URL = process.env.SITE_BUILD_FETCH_URL || 'https://elysium.ngo';

async function fetchLive(path) {
  try {
    const res = await fetch(SITE_BASE_URL + path);
    if (!res.ok) {
      console.warn(`Build-time content fetch failed (${res.status}) for ${path}, falling back to hardcoded content`);
      return null;
    }
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : null;
  } catch (e) {
    console.warn(`Build-time content fetch errored for ${path}, falling back to hardcoded content: ${e}`);
    return null;
  }
}

module.exports = { fetchLive };
