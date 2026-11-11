/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/components/**/*.{ts,tsx}', './src/app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Text
        ink: '#13211b',
        sub: '#46554e',
        faint: '#5f6e67',
        // Surfaces and rules, neutrals tinted toward the spruce
        ground: '#f3f6f4',
        line: '#dde4e0',
        'line-strong': '#b9c5be',
        mint: '#e2f0e8',
        // The one brand colour: shell, primary actions, selection
        spruce: {
          950: '#0a2a22',
          900: '#0d3329',
          800: '#124437',
          700: '#17574a',
          500: '#2c8f72',
          300: '#a8c6b8',
          100: '#e9f2ed',
        },
        // States
        warn: { bg: '#fcf2d9', line: '#ecd28f', ink: '#6f4700' },
        bad: { bg: '#fdecea', line: '#f1b9b2', ink: '#9b2318' },
      },
      boxShadow: {
        lift: '0 1px 2px rgba(13, 51, 41, 0.06), 0 8px 24px -12px rgba(13, 51, 41, 0.18)',
      },
    },
  },
  plugins: [],
};
