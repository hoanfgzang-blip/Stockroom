/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: '#0f172a',
          foreground: '#e2e8f0',
          accent: '#1e293b',
          border: '#334155',
        },
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
      },
    },
  },
  plugins: [],
}
