/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#166534',
          800: '#14532D',
        },
        accent: {
          violet: '#7C3AED',
          violetSoft: '#EDE9FE',
        },
      },
      boxShadow: {
        card:  '0 2px 10px rgba(0,0,0,0.06)',
        nav:   '0 1px 3px rgba(0,0,0,0.05)',
        toast: '0 4px 16px rgba(0,0,0,0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
