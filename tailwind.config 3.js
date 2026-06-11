/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        pitch: {
          950: '#030c03',
          900: '#071407',
          800: '#0e280e',
          700: '#173c17',
        },
        grass: {
          500: '#16a34a',
          400: '#22c55e',
          300: '#4ade80',
        },
        gold: {
          500: '#ca8a04',
          400: '#eab308',
          300: '#fde047',
          200: '#fef08a',
        },
        chalk: {
          50:  '#f8f9f0',
          100: '#eef0e2',
          200: '#d4d9bd',
          400: '#9aa37a',
          600: '#5c6640',
        }
      },
      backgroundImage: {
        'pitch-texture': "radial-gradient(ellipse at 50% 0%, #0e280e 0%, #030c03 70%)",
      }
    },
  },
  plugins: [],
}
