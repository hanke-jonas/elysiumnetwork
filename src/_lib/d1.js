// Shared D1-over-HTTP helper for build-time Eleventy data files.
//
// Eleventy's build runs in a plain Node process (Cloudflare Pages' build
// step), not inside the Workers/Pages-Functions runtime — so it has no
// access to the `env.DB` binding the Functions in functions/api/* use.
// Instead it talks to D1 the same way any external script would: Cloudflare's
// REST API, authenticated with an API token scoped to D1 read access only.
//
// Every data file that calls this degrades to its hardcoded fallback when
// these env vars aren't set, so the site keeps building normally before the
// database exists and in local dev without needing D1 credentials at all.
async function fetchD1(sql, params = []) {
  const { CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_D1_API_TOKEN } = process.env;
  if (!CF_ACCOUNT_ID || !CF_D1_DATABASE_ID || !CF_D1_API_TOKEN) return null;

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_D1_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  if (!res.ok) {
    console.warn(`D1 query failed (${res.status}), falling back to hardcoded content: ${sql}`);
    return null;
  }
  const data = await res.json();
  const results = data.result?.[0]?.results;
  return Array.isArray(results) ? results : null;
}

module.exports = { fetchD1 };
