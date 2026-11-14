import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://masterofpipsology.com';
  return [
    { url: `${base}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/intelligence`, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
