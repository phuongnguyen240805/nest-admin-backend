import type { Page } from 'playwright';
import type { MonaPageExtraction } from './types.js';

interface ExtractArgs {
  requestedUrl: string;
  baseUrl: string;
}

/*
 * IMPORTANT: this script is created with new Function so tsx/esbuild cannot
 * inject helpers such as __name into code serialized by Playwright.
 */
const EXTRACT_BROWSER_SCRIPT = String.raw`
({ requestedUrl, baseUrl }) => {
  const entityDecoder = document.createElement('textarea');
  const decodeText = (value) => {
    entityDecoder.innerHTML = String(value || '');
    return entityDecoder.value;
  };
  const cleanText = (value) => decodeText(value).replace(/\s+/g, ' ').trim();
  const uniq = (values) => Array.from(new Set(values));
  const absolute = (value) => {
    if (!value) return '';
    try {
      return new URL(value, location.href).toString();
    } catch {
      return String(value);
    }
  };
  const slugFromUrl = (value) => {
    try {
      const parts = new URL(value, location.href).pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || 'article';
    } catch {
      return 'article';
    }
  };

  const metaTags = {};
  for (const meta of document.querySelectorAll('meta')) {
    const key = (meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv') || '').toLowerCase();
    const value = (meta.content || '').trim();
    if (!key || !value) continue;
    if (!metaTags[key]) metaTags[key] = [];
    metaTags[key].push(value);
  }

  const metaFirst = (...keys) => {
    for (const key of keys) {
      const values = metaTags[String(key).toLowerCase()];
      if (values && values[0]) return values[0];
    }
    return undefined;
  };

  const jsonLd = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    const text = (script.textContent || '').trim();
    if (!text) continue;
    try {
      jsonLd.push(JSON.parse(text));
    } catch {
      jsonLd.push({ _parseError: true, raw: text.slice(0, 100000) });
    }
  }

  const ldNodes = [];
  const walkLd = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walkLd);
      return;
    }
    if (!value || typeof value !== 'object') return;
    ldNodes.push(value);
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(walkLd);
  };
  jsonLd.forEach(walkLd);

  const typeNames = (obj) => {
    const raw = obj['@type'];
    return Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  };

  const articleLd = ldNodes.find((node) => typeNames(node).some((type) => /^(Article|BlogPosting|NewsArticle)$/i.test(type)));
  const breadcrumbLd = ldNodes.find((node) => typeNames(node).some((type) => type === 'BreadcrumbList'));

  const canonicalUrl = absolute((document.querySelector('link[rel="canonical"]') || {}).href || location.href);
  const pageH1 = cleanText((document.querySelector('h1') || {}).textContent);
  const ldHeadline = articleLd && typeof articleLd.headline === 'string' ? articleLd.headline : undefined;
  const title = cleanText(ldHeadline || pageH1 || metaFirst('og:title') || document.title);

  // Prefer the actual WordPress/MONA article body. Scoring the entire page used
  // to select a much larger wrapper and leaked related-post headings into content.
  const bodySelectors = [
    '.mona-content.blogContent',
    '.blog-large-content .mona-content',
    '.blogContent',
    'article .entry-content',
    'article .post-content',
    '.entry-content',
    '.post-content',
    '[class*="article-content" i]',
    '[class*="single-content" i]',
    '[class*="content-post" i]',
    'main article',
    'article',
  ];

  let contentRoot = null;
  let bodySelector = '';
  for (const selector of bodySelectors) {
    const matches = Array.from(document.querySelectorAll(selector));
    for (const el of matches) {
      const textLength = cleanText(el.textContent).length;
      const paragraphs = el.querySelectorAll('p').length;
      if (textLength >= 300 && paragraphs >= 2) {
        contentRoot = el;
        bodySelector = selector;
        break;
      }
    }
    if (contentRoot) break;
  }

  // Last-resort fallback keeps the crawl from crashing but is deliberately
  // marked so validation can reject it before Strapi import.
  if (!contentRoot) {
    contentRoot = document.querySelector('main') || document.body;
    bodySelector = contentRoot.tagName.toLowerCase();
  }

  const contentClone = contentRoot.cloneNode(true);

  const noiseSelectors = [
    'script',
    'style',
    'noscript',
    'svg',
    'form',
    'button',
    'input',
    'textarea',
    'select',
    '[class*="social-share" i]',
    '[class*="related-post" i]',
    '[class*="related-article" i]',
    '[class*="newsletter" i]',
    '.mona-entity-anchor',
    '.mona-pod-inbody',
    '.mona-pod-cta',
    '.js-cta-card',
  ];
  contentClone.querySelectorAll(noiseSelectors.join(',')).forEach((el) => el.remove());

  // Strip executable/event-handler attributes while preserving semantic HTML.
  for (const el of contentClone.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
    for (const attrName of ['href', 'src', 'poster']) {
      const value = el.getAttribute(attrName);
      if (value) el.setAttribute(attrName, absolute(value));
    }
  }

  // The Strapi/front-end title should own the only H1. If a source body has an
  // H1, normalize it to H2 rather than importing multiple page-level H1s.
  let normalizedBodyH1s = 0;
  for (const h1 of Array.from(contentClone.querySelectorAll('h1'))) {
    const h2 = document.createElement('h2');
    for (const attr of Array.from(h1.attributes)) h2.setAttribute(attr.name, attr.value);
    h2.innerHTML = h1.innerHTML;
    h1.replaceWith(h2);
    normalizedBodyH1s += 1;
  }

  const contentText = cleanText(contentClone.textContent);
  const contentHtml = contentClone.innerHTML.trim();

  const authors = [];
  const addAuthor = (value) => {
    if (!value) return;
    if (typeof value === 'string') authors.push(cleanText(value));
    else if (Array.isArray(value)) value.forEach(addAuthor);
    else if (typeof value === 'object' && typeof value.name === 'string') authors.push(cleanText(value.name));
  };
  if (articleLd) addAuthor(articleLd.author);
  addAuthor(metaFirst('author'));
  for (const el of document.querySelectorAll('[rel="author"], [class*="author-name" i], [class*="post-author" i] a')) {
    const text = cleanText(el.textContent);
    if (text && text.length < 160) authors.push(text);
  }

  const categories = [];
  const tags = [];
  const addStrings = (target, value) => {
    if (!value) return;
    if (Array.isArray(value)) value.forEach((item) => addStrings(target, item));
    else if (typeof value === 'string') {
      value.split(',').map(cleanText).filter(Boolean).forEach((item) => target.push(item));
    }
  };
  if (articleLd) {
    addStrings(categories, articleLd.articleSection);
    addStrings(tags, articleLd.keywords);
  }
  addStrings(categories, metaTags['article:section']);
  addStrings(tags, metaTags['article:tag']);
  addStrings(tags, metaFirst('keywords'));

  const breadcrumbs = [];
  if (breadcrumbLd && Array.isArray(breadcrumbLd.itemListElement)) {
    for (const item of breadcrumbLd.itemListElement) {
      if (!item || typeof item !== 'object') continue;
      const nested = item.item && typeof item.item === 'object' ? item.item : undefined;
      const name = cleanText(String(item.name || (nested && nested.name) || ''));
      const rawUrl = typeof item.item === 'string' ? item.item : nested && nested['@id'];
      const url = absolute(rawUrl || '');
      if (name) breadcrumbs.push({ name, url: url || undefined });
    }
  }

  if (breadcrumbs.length === 0) {
    const crumbRoot = document.querySelector('[aria-label*="breadcrumb" i], [class*="breadcrumb" i]');
    if (crumbRoot) {
      for (const el of crumbRoot.querySelectorAll('a, span')) {
        const name = cleanText(el.textContent);
        if (!name || breadcrumbs.some((crumb) => crumb.name === name)) continue;
        const href = el.tagName === 'A' ? absolute(el.href) : undefined;
        breadcrumbs.push({ name, url: href });
      }
    }
  }

  const headings = Array.from(contentClone.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: cleanText(el.textContent),
      id: el.id || undefined,
    }))
    .filter((item) => item.text);

  const headingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const heading of headings) {
    const key = 'h' + heading.level;
    if (Object.prototype.hasOwnProperty.call(headingCounts, key)) headingCounts[key] += 1;
  }

  const images = Array.from(contentClone.querySelectorAll('img'))
    .map((img) => {
      const figure = img.closest('figure');
      const src = absolute(img.currentSrc || img.src || img.dataset.src || img.getAttribute('data-lazy-src'));
      return {
        src,
        srcset: img.srcset || img.getAttribute('data-srcset') || undefined,
        sizes: img.sizes || undefined,
        alt: cleanText(img.alt) || undefined,
        title: cleanText(img.title) || undefined,
        caption: cleanText(figure && figure.querySelector('figcaption') && figure.querySelector('figcaption').textContent) || undefined,
        width: img.naturalWidth || img.width || undefined,
        height: img.naturalHeight || img.height || undefined,
        loading: img.loading || undefined,
      };
    })
    .filter((img) => img.src);

  const baseHost = new URL(baseUrl).hostname;
  const links = Array.from(contentClone.querySelectorAll('a[href]'))
    .map((anchor) => {
      const url = absolute(anchor.href);
      let internal = false;
      try {
        internal = new URL(url).hostname === baseHost;
      } catch {
        internal = false;
      }
      return {
        url,
        text: cleanText(anchor.textContent),
        rel: anchor.rel || undefined,
        target: anchor.target || undefined,
        internal,
      };
    })
    .filter((link) => link.url && /^https?:/i.test(link.url));

  const media = Array.from(contentClone.querySelectorAll('video[src], audio[src], iframe[src], source[src]'))
    .map((el) => ({
      type: el.tagName.toLowerCase(),
      src: absolute(el.getAttribute('src')),
      title: cleanText(el.getAttribute('title')) || undefined,
    }))
    .filter((item) => item.src);

  const tables = Array.from(contentClone.querySelectorAll('table')).map((table) => ({
    headers: Array.from(table.querySelectorAll('thead th')).map((th) => cleanText(th.textContent)),
    rows: Array.from(table.querySelectorAll('tbody tr, tr'))
      .map((tr) => Array.from(tr.querySelectorAll('th,td')).map((cell) => cleanText(cell.textContent)))
      .filter((row) => row.length > 0),
  }));

  const openGraph = {};
  const twitter = {};
  for (const [key, values] of Object.entries(metaTags)) {
    if (key.startsWith('og:') || key.startsWith('article:')) openGraph[key] = values;
    if (key.startsWith('twitter:')) twitter[key] = values;
  }

  const publishedAt = String((articleLd && articleLd.datePublished) || metaFirst('article:published_time', 'date', 'datepublished') || '') || undefined;
  const modifiedAt = String((articleLd && articleLd.dateModified) || metaFirst('article:modified_time', 'datemodified') || '') || undefined;

  const articleSignals = [];
  let articleScore = 0;
  if (articleLd) {
    articleSignals.push('jsonld:Article');
    articleScore += 5;
  }
  if (metaFirst('article:published_time')) {
    articleSignals.push('meta:article:published_time');
    articleScore += 3;
  }
  if (/\bsingle-post\b/i.test(document.body.className)) {
    articleSignals.push('body:single-post');
    articleScore += 3;
  }
  if (/mona-content|blogContent|entry-content|post-content/i.test(bodySelector)) {
    articleSignals.push('dom:article-body');
    articleScore += 3;
  }
  if (pageH1) {
    articleSignals.push('dom:h1');
    articleScore += 1;
  }
  if (contentText.length >= 800) {
    articleSignals.push('content>=800');
    articleScore += 2;
  }
  if (contentClone.querySelectorAll('p').length >= 5) {
    articleSignals.push('paragraphs>=5');
    articleScore += 1;
  }

  const keywords = uniq((metaFirst('keywords') || '').split(',').map(cleanText).filter(Boolean));
  const wordCount = contentText ? contentText.split(/\s+/).filter(Boolean).length : 0;

  return {
    requestedUrl,
    finalUrl: location.href,
    canonicalUrl,
    isArticle: articleScore >= 6 && contentText.length >= 300 && bodySelector !== 'body',
    articleSignals,
    lang: document.documentElement.lang || undefined,
    documentTitle: cleanText(document.title),
    title,
    slug: slugFromUrl(canonicalUrl || location.href),
    description: cleanText(metaFirst('description', 'og:description')) || undefined,
    keywords,
    robots: cleanText(metaFirst('robots')) || undefined,
    publishedAt,
    modifiedAt,
    authors: uniq(authors.filter(Boolean)),
    categories: uniq(categories.filter(Boolean)),
    tags: uniq(tags.filter(Boolean)),
    metaTags,
    openGraph,
    twitter,
    jsonLd,
    breadcrumbs,
    contentHtml,
    contentText,
    wordCount,
    headings,
    headingCounts,
    bodySelector,
    normalizedBodyH1s,
    images,
    links,
    media,
    tables,
  };
}
`;

const SCROLL_BROWSER_SCRIPT = String.raw`
async () => {
  const maxY = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const steps = Math.max(3, Math.min(10, Math.ceil(maxY / Math.max(window.innerHeight, 800))));
  for (let i = 1; i <= steps; i += 1) {
    window.scrollTo(0, Math.floor((maxY * i) / steps));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  await new Promise((resolve) => setTimeout(resolve, 180));
  window.scrollTo(0, 0);
}
`;

const EXTRACT_BROWSER_FN = new Function(`return (${EXTRACT_BROWSER_SCRIPT})`)() as (
  args: ExtractArgs,
) => MonaPageExtraction;
const SCROLL_BROWSER_FN = new Function(`return (${SCROLL_BROWSER_SCRIPT})`)() as () => Promise<void>;

export async function extractMonaPage(
  page: Page,
  requestedUrl: string,
  baseUrl: string,
): Promise<MonaPageExtraction> {
  return page.evaluate(EXTRACT_BROWSER_FN, { requestedUrl, baseUrl });
}

export async function scrollArticlePage(page: Page): Promise<void> {
  await page.evaluate(SCROLL_BROWSER_FN);
}
