/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // EG: Cairo is a popular Arabic-first Google Font; falls back to system sans.
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand scale (logistics blue).
        brand: {
          50: '#f0f6ff',
          100: '#dcebff',
          200: '#bfd9ff',
          300: '#93bdff',
          400: '#5e95ff',
          500: '#1e5eff',
          600: '#1547cc',
          700: '#0e3699',
          800: '#0c2e7a',
          900: '#0b2a66',
        },
        // Semantic tokens — backed by CSS variables that flip in `.dark` (see styles.css).
        // `<alpha-value>` keeps Tailwind opacity utilities (e.g. bg-accent/10) working.
        accent: 'rgb(var(--accent) / <alpha-value>)',
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          muted: 'rgb(var(--surface-muted) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          soft: 'rgb(var(--line-soft) / <alpha-value>)',
        },
        ink: 'rgb(var(--ink) / <alpha-value>)',
        body: 'rgb(var(--body) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        pop: '0 10px 30px -10px rgb(15 23 42 / 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
