import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

// Pinned to deploy date — update when content changes significantly.
// Avoids sitemap churn on every build from `new Date()`.
const LAST_MODIFIED = '2026-05-07';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://motorsurveyos.web.app';

  return [
    {
      url: `${baseUrl}/`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
  ];
}
