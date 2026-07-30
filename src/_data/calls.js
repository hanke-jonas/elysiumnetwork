const { fetchD1 } = require('../_lib/d1.js');

// Kept in sync with the single hardcoded call that used to live inline in
// calls.njk's `{% set calls = [...] %}` — same content, now the fallback
// used whenever D1 isn't configured/reachable at build time.
const fallback = [
  {
    id: 'call-1',
    title: 'Democracy on TrackS (DOTS)',
    branchSlug: 'germany',
    open: false,
    deadline: 'Applications closed 10 July 2026',
    summary: 'Five seats on a ten-day, fully funded rail journey from Berlin to Strasbourg — visiting the Bundestag, the European Commission, the Court of Justice and the European Parliament along the way. Open to young people aged 18–21 legally resident in Germany. No CV, no portfolio — just curiosity and a willingness to document the journey.',
    link: 'https://hub.elysium.ngo/dots',
    linkLabel: 'Project page',
  },
];

module.exports = async function () {
  const rows = await fetchD1('SELECT * FROM calls ORDER BY sort_order ASC');
  if (!rows) return fallback;

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    branchSlug: r.branch_slug,
    open: !!r.is_open,
    deadline: r.deadline_label,
    summary: r.summary,
    link: r.link,
    linkLabel: r.link_label,
  }));
};
