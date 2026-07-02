import type { MetadataRoute } from 'next'
import { CURRENCY_PAIRS, pairSlug } from '@/lib/forex/pairs'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forextraderpro.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    {
      url: `${SITE_URL}/tools/position-size-calculator`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tools/prop-firm-drawdown-calculator`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]

  const pairPages: MetadataRoute.Sitemap = CURRENCY_PAIRS.map(p => ({
    url: `${SITE_URL}/tools/position-size-calculator/${pairSlug(p.symbol)}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [...staticPages, ...pairPages]
}
