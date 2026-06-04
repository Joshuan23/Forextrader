import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#0f1117',
        panel: '#161b22',
        border: '#21262d',
      },
    },
  },
  plugins: [],
}
export default config
