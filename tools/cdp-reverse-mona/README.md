# MONA Blog CDP Crawler v4 — Strapi migration build

This build is dedicated to `https://mona.media/blog/` and fixes the main v3 migration issue: v3 could choose a page-level wrapper as `contentHtml`, which leaked title/author/sidebar/related-post UI into article content.

## What v4 changes

- Deep crawls every article URL with Chromium + CDP/Playwright.
- Default `candidateMode=strict-blog`: URL must occur in both rendered blog archives and WordPress `post-sitemap*.xml`.
- Uses `.mona-content.blogContent` as the first-choice body root.
- Removes executable/UI-only elements (`script`, `form`, inputs, MONA entity/podcast/CTA boilerplate).
- Removes inline `on*` event handlers and absolutizes body `href/src/poster` URLs.
- Keeps semantic HTML: paragraphs, lists, tables, images, blockquotes, iframe/video, code, H2-H6.
- Page title is separate; any H1 found inside the body is normalized to H2 so the destination page can render exactly one H1 from `title`.
- Extracts headings from the cleaned body, not from the whole detail page.
- Writes both rich crawl records and a smaller CMS-neutral Strapi import source.
- Network capture is OFF by default for migration runs because it is not needed for Strapi content and adds runtime/file size.

## Output

```text
output/mona-strapi/
  articles.jsonl       # rich crawl records + metadata
  strapi-ready.jsonl   # use this as the source for a Strapi importer
  completed.jsonl
  skipped.jsonl
  errors.jsonl
  urls.json
  summary.json
  html/                # full rendered source snapshots (optional)
  archive-html/
  archives.jsonl       # discovery/debug only; NOT article content
```

### `strapi-ready.jsonl`

Each line is shaped as:

```json
{
  "source": {
    "requestedUrl": "https://mona.media/example/",
    "canonicalUrl": "https://mona.media/example/",
    "crawledAt": "..."
  },
  "data": {
    "title": "Article title",
    "slug": "example",
    "excerpt": "Meta description",
    "contentHtml": "<p>...</p><h2>...</h2><h3>...</h3>",
    "publishedAt": "...",
    "sourceModifiedAt": "...",
    "authors": ["..."],
    "categories": ["..."],
    "tags": [],
    "headings": [{"level":2,"text":"..."}],
    "headingCounts": {"h1":0,"h2":5,"h3":8,"h4":0,"h5":0,"h6":0},
    "images": [],
    "seo": {
      "metaTitle": "...",
      "metaDescription": "...",
      "canonicalUrl": "...",
      "robots": "index, follow",
      "keywords": []
    }
  }
}
```

The exact Strapi REST body still depends on your actual Strapi content-type schema. Map `data.contentHtml` into your HTML/Rich Text field. If your project uses Strapi Blocks, convert HTML to Blocks in the importer; do not recrawl.

## Run

```bash
npm install
npm run install:browsers
npm run typecheck
npm run crawl:mona:test
```

Validate `output/mona-strapi-test/strapi-ready.jsonl`, then run full:

```bash
npm run crawl:mona:fresh
```

Resume an interrupted v4 run with:

```bash
npm run crawl:mona
```

Do not resume into v3 output; schema version is intentionally bumped to v4.

## Reuse the existing v3 full crawl without crawling 2,000+ pages again

If you already have the old v3 `articles.jsonl`, v4 includes an offline repair command:

```bash
npm run repair:v3 -- --input path/to/articles.jsonl --output output/strapi-repaired.jsonl
```

It extracts `.mona-content.blogContent` from each legacy record, removes the same MONA boilerplate, normalizes body H1 to H2, rebuilds H2-H6 metadata, decodes text entities, and produces a clean Strapi import source. This is the fastest migration path for the 2,232 records already crawled.
