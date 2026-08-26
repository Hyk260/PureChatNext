import type { MetadataRoute } from 'next'

import { SITE_DESCRIPTION, SITE_NAME } from '@/const/site'

const manifest = (): MetadataRoute.Manifest => ({
  background_color: '#ffffff',
  description: SITE_DESCRIPTION,
  display: 'standalone',
  icons: [
    {
      sizes: 'any',
      src: '/logos/purechat-appicon.svg',
      type: 'image/svg+xml',
    },
    {
      sizes: '512x512',
      src: '/favicon.png',
      type: 'image/png',
    },
  ],
  name: SITE_NAME,
  short_name: SITE_NAME,
  start_url: '/',
  theme_color: '#0a0a0a',
})

export default manifest
