import type { MonaArticleRecord, StrapiReadyRecord } from './types.js';

export function toStrapiReady(record: MonaArticleRecord): StrapiReadyRecord {
  return {
    source: {
      requestedUrl: record.requestedUrl,
      canonicalUrl: record.canonicalUrl,
      crawledAt: record.crawl.crawledAt,
    },
    data: {
      title: record.title,
      slug: record.slug,
      excerpt: record.description,
      contentHtml: record.contentHtml,
      publishedAt: record.publishedAt,
      sourceModifiedAt: record.modifiedAt,
      authors: record.authors,
      categories: record.categories,
      tags: record.tags,
      headings: record.headings,
      headingCounts: record.headingCounts,
      images: record.images,
      seo: {
        metaTitle: record.title,
        metaDescription: record.description,
        canonicalUrl: record.canonicalUrl,
        robots: record.robots,
        keywords: record.keywords,
      },
    },
  };
}
