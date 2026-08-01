const { fetchLive } = require('../_lib/d1.js');

// Kept in sync with the single hardcoded call that used to live inline in
// calls.njk's `{% set calls = [...] %}` — same content, now the fallback
// used whenever the live site's admin API isn't reachable at build time.
const fallback = [
  {
    id: 'call-1',
    title: 'Democracy on TrackS (DOTS)',
    branchSlug: 'germany',
    status: 'closed',
    deadline: 'Applications closed 10 July 2026',
    summary: 'Five seats on a ten-day, fully funded rail journey from Berlin to Strasbourg — visiting the Bundestag, the European Commission, the Court of Justice and the European Parliament along the way. Open to young people aged 18–21 legally resident in Germany. No CV, no portfolio — just curiosity and a willingness to document the journey.',
    link: 'https://hub.elysium.ngo/dots',
    linkLabel: 'Project page',
  },
  {
    id: 'call-2',
    title: 'Roma Voices: Media against discrimination',
    branchSlug: 'germany',
    status: 'coming_up',
    deadline: 'Coming summer 2027',
    summary: 'An Erasmus+ youth exchange in Bucharest exploring discrimination and racism against Sinti and Roma communities through critical media literacy — participants will produce their own podcasts, videos and social media campaigns as counter-narratives. Funding has been secured through Erasmus+ Youth — stay tuned for more.',
    link: '/germany/',
    linkLabel: 'Learn more',
  },
];

module.exports = async function () {
  const rows = await fetchLive('/api/admin/calls');
  if (!rows) return fallback;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    branchSlug: r.branch_slug,
    status: r.status || 'closed',
    deadline: r.deadline_label,
    summary: r.summary,
    link: r.link,
    linkLabel: r.link_label,
  }));
};
