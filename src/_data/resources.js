const { fetchLive } = require('../_lib/d1.js');

module.exports = async function () {
  const rows = await fetchLive('/api/admin/resources?status=published');
  if (!rows) return [];

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    fileUrl: r.file_url,
    fileType: r.file_type,
    category: r.category,
    publishedAt: r.published_at,
  }));
};
