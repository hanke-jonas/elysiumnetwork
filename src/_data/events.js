const { fetchLive } = require('../_lib/d1.js');

module.exports = async function () {
  const rows = await fetchLive('/api/admin/events?status=published');
  if (!rows) return [];

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    bodyHtml: r.body_html,
    coverImage: r.cover_image,
    location: r.location,
    branchSlug: r.branch_slug,
    startDate: r.start_date,
    endDate: r.end_date,
    capacity: r.capacity,
  }));
};
