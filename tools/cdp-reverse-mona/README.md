# MONA Media CDP Blog Crawler

A small crawler dedicated to `https://mona.media/blog/`.

This package contains only the code required to discover and crawl the MONA blog with Chromium + CDP.

## What changed in v3

- Fixed the `page.evaluate: ReferenceError: __name is not defined` issue by running browser
  extractors from raw browser-side JavaScript functions instead of tsx-transformed closures.
- Archive discovery now removes links that repeat across many archive pages. Those are
  normally header/footer/service navigation links, not blog articles.
- Real archive article URLs are prioritized, then `post-sitemap*.xml` fills any gaps.
- `crawl:mona:test` uses a clean separate output folder, one article worker, a target of
  10 successful articles, and a safety cap of 20 attempts.
- Archive discovery runs with a small worker pool so 126 archive pages do not have to be
  loaded strictly one by one.
- CDP network capture defaults to Document/XHR/Fetch metadata only. Response bodies are
  read only for XHR/Fetch text or JSON.
- Resume uses JSONL checkpoints and errors remain retryable on a later run.

## Install

```bash
npm install
npm run install:browsers
```

## Smoke test before full crawl

```bash
npm run crawl:mona:test
```

The test writes to `output/mona-test`, starts clean every time, and scans only the first 5 archive pages for a fast smoke test.

Recommended GO condition before a full crawl:

- `articles` is 10.
- `errors` is 0, or at most 1 after review.
- `articles.jsonl` has plausible title, canonical URL, publish date, content text,
  headings, images, links, JSON-LD, and crawl metadata.
- `contentText` contains the article body rather than the whole site navigation.

If you previously ran v2 into `output/mona`, start the first v3 full crawl clean:

```bash
npm run crawl:mona:fresh
```

After a v3 crawl has started, use `npm run crawl:mona` to resume it safely if interrupted.

## Main output

```text
output/mona/
  articles.jsonl
  archives.jsonl
  network.jsonl
  urls.json
  completed.jsonl
  skipped.jsonl
  errors.jsonl
  progress.json
  summary.json
  archive-html/
  html/
```

## Important config values

- `maxArticles: 0`: no successful-article limit.
- `maxAttempts: 0`: no candidate-attempt limit.
- `maxArchivePages: 0`: discover all archive pages.
- `concurrency: 2`: article CDP workers.
- `archiveConcurrency: 3`: archive discovery workers.
- `captureAllNetworkMetadata: false`: reduce `network.jsonl` size.
- `blockHeavyResources: true`: do not download image/font/media bytes during crawl.

## Useful commands

```bash
npm run crawl:mona:test
npm run crawl:mona:fresh
npm run crawl:mona
npm run crawl:mona:headed
npx tsx src/index.ts --config config.mona.json --limit 5 --max-attempts 10 --headed
```
