/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Same institutional palette as the FlowEdge web app
        background: '#070b12',
        card: '#0c111c',
        border: '#1c2333',
        muted: '#151b29',
        foreground: '#dde3ee',
        subtle: '#8a93a6',
        primary: '#52a8ff',
        long: '#0d9d88',
        short: '#e5495a',
        warn: '#f0b429',
      },
    },
  },
  plugins: [],
}
