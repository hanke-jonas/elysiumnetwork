const { fetchLive } = require('../_lib/d1.js');

// No hardcoded fallback content (same reasoning as blog.js) -- entries
// only ever come from the public submission form, so before the site is
// reachable at build time, or before anyone's been approved yet, this is
// just an empty list and the alumni page renders an empty state.
module.exports = async function () {
  const rows = await fetchLive('/api/admin/dots-alumni?status=published');
  if (!rows) return [];

  return rows.map((r) => ({
    id: r.id,
    edition: r.edition,
    name: r.name,
    bio: r.bio,
    photoUrl: r.photo_url,
    publishedAt: r.published_at,
  }));
};
