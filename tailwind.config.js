/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        glucose: {
          low: '#EF4444',
          normal: '#22C55E',
          elevated: '#F59E0B',
          high: '#EF4444',
          'very-high': '#DC2626',
        },
        plum: {
          50:  '#FAF5FF',
          100: '#F5F3FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          600: '#6B21A8',
          700: '#581C87',
          800: '#4B1684',
          900: '#3B0764',
        },
        honey: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          800: '#92400E',
        },
        brand: {
          50:  '#FAF5FF',
          100: '#F5F3FF',
          500: '#6B21A8',
          600: '#6B21A8',
          700: '#581C87',
          900: '#3B0764',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08)',
      },
    },
  },
  plugins: [],
}
