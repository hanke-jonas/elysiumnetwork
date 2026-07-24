module.exports = {
  content: ['./src/**/*.njk'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F1E2', 'paper-2': '#EFE6CE', ink: '#191712', fg: '#191712', muted: '#5B5748',
        line: 'rgba(25,23,18,.16)',
        blue: '#7C93D6', coral: '#FF6B54', sun: '#FFC93C', mint: '#59B37B', plum: '#B478D9',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['Caveat', 'cursive'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
