/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0D0F14',
        surface: '#161920',
        surface2: '#1E2230',
        surface3: '#252A3A',
        border: '#2A2F42',
        border2: '#353C55',
        accent: '#5B6AF0',
        accent2: '#7B8BFF',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
