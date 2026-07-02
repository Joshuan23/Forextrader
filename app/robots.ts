import type { MetadataRoute } from 'next'
import { SITE_URL } from './sitemap'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Subscriber-only app pages — no SEO value, keep crawlers on the tools
      disallow: ['/dashboard', '/signals', '/charts', '/backtesting', '/strategies', '/positions', '/challenge', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
