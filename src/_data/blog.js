const { fetchLive } = require('../_lib/d1.js');

// No hardcoded fallback content here (unlike branches/team/faqs/calls) —
// there's no pre-existing blog content to fall back to. Before the site is
// reachable yet, or once it is but there are no published posts, this is
// just an empty list and the blog pages render an empty state.
module.exports = async function () {
  const rows = await fetchLive('/api/admin/blog?status=published');
  if (!rows) return [];

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    bodyHtml: r.body_html,
    coverImage: r.cover_image,
    authorName: r.author_name,
    category: r.category,
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
    publishedAt: r.published_at,
  }));
};
