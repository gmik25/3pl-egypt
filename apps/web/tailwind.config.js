/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // EG: Cairo is a popular Arabic-first Google Font; falls back to system sans.
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f6ff',
          100: '#dcebff',
          500: '#1e5eff',
          600: '#1547cc',
          700: '#0e3699',
        },
      },
    },
  },
  plugins: [],
};
