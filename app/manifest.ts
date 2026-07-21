import type { MetadataRoute } from 'next'

// PWA manifest — makes "Add to Home Screen" install as "FlowEdge" with the
// logo icon and a native-feeling standalone launch.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FlowEdge — FX Decision Engine',
    short_name: 'FlowEdge',
    description: 'Institutional-style forex trade plans: exact levels, contextual validation, ICT signals.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#070b12',
    theme_color: '#070b12',
    icons: [
      { src: '/flowedge-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/flowedge-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
