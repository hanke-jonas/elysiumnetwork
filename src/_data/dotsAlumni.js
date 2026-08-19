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
    slug: r.slug,
    edition: r.edition,
    name: r.name,
    bio: r.bio,
    story: r.story,
    photoUrl: r.photo_url,
    photos: JSON.parse(r.photos_json || '[]'),
    links: JSON.parse(r.links_json || '[]'),
    blocks: JSON.parse(r.blocks_json || 'null'),
    publishedAt: r.published_at,
  }));
};
