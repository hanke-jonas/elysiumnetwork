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

  eleventyConfig.addPassthroughCopy('src/robots.txt');

  return {
    dir: { input: 'src', output: '_site', includes: '_includes', data: '_data' },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
};
