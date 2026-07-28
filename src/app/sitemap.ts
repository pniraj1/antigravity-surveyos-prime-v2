import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;

  return [
    { url: `${baseUrl}/`,                      lastModified: new Date(), changeFrequency: 'monthly', priority: 1.0 },
    { url: `${baseUrl}/landing`,               lastModified: new Date(), changeFrequency: 'monthly', priority: 1.0 },
    { url: `${baseUrl}/products`,              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/products/motor-surveyos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/blog`,                  lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${baseUrl}/blog/surveyos-sync`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/privacy`,               lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/terms`,                 lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
