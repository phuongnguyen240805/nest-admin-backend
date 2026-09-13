import type { Page } from 'playwright';
import type { MonaPageExtraction } from './types.js';

interface ExtractArgs {
  requestedUrl: string;
  baseUrl: string;
}

const EXTRACT_BROWSER_SCRIPT = String.raw`
({ requestedUrl, baseUrl }) => {
  const cleanText = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const uniq = (values) => Array.from(new Set(values));
  const absolute = (value) => {
    if (!value) return '';
    try {
      return new URL(value, location.href).toString();
    } catch {
      return String(value);
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

  const candidates = [];
  const selectors = [
    'main article',
    'article',
    '[class*="post-content" i]',
    '[class*="entry-content" i]',
    '[class*="article-content" i]',
    '[class*="single-content" i]',
    '[class*="content-post" i]',
    '.mona-content',
    'main',
  ];

  for (const selector of selectors) {
    for (const el of document.querySelectorAll(selector)) {
      if (!candidates.includes(el)) candidates.push(el);
    }
  }

  const scoreElement = (el) => {
    const textLength = cleanText(el.textContent).length;
    const paragraphs = el.querySelectorAll('p').length;
    const headings = el.querySelectorAll('h2,h3,h4').length;
    const images = el.querySelectorAll('img').length;
    const links = el.querySelectorAll('a').length;
    const tag = el.tagName.toLowerCase();
    const tagBonus = tag === 'article' ? 5000 : tag === 'main' ? 400 : 0;
    const linkPenalty = Math.max(0, links - paragraphs * 3) * 15;
    return textLength + paragraphs * 180 + headings * 120 + images * 25 + tagBonus - linkPenalty;
  };

  const contentRoot = candidates.sort((a, b) => scoreElement(b) - scoreElement(a))[0] || document.body;
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
    '[class*="sidebar" i]',
    '[class*="newsletter" i]',
  ];
  contentClone.querySelectorAll(noiseSelectors.join(',')).forEach((el) => el.remove());

  const contentText = cleanText(contentClone.textContent);
  const contentHtml = contentClone.innerHTML;
  const canonicalUrl = absolute((document.querySelector('link[rel="canonical"]') || {}).href || location.href);
  const h1 = cleanText((document.querySelector('h1') || {}).textContent);
  const ldHeadline = articleLd && typeof articleLd.headline === 'string' ? articleLd.headline : undefined;
  const title = cleanText(ldHeadline || h1 || metaFirst('og:title') || document.title);

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

  const headings = Array.from(contentRoot.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: cleanText(el.textContent),
      id: el.id || undefined,
    }))
    .filter((item) => item.text);

  const images = Array.from(contentRoot.querySelectorAll('img'))
    .map((img) => {
      const figure = img.closest('figure');
      const src = absolute(img.currentSrc || img.src || img.dataset.src || img.getAttribute('data-lazy-src'));
      return {
        src,
        srcset: img.srcset || img.getAttribute('data-srcset') || undefined,
        sizes: img.sizes || undefined,
        alt: img.alt || undefined,
        title: img.title || undefined,
        caption: cleanText(figure && figure.querySelector('figcaption') && figure.querySelector('figcaption').textContent) || undefined,
        width: img.naturalWidth || img.width || undefined,
        height: img.naturalHeight || img.height || undefined,
        loading: img.loading || undefined,
      };
    })
    .filter((img) => img.src);

  const baseHost = new URL(baseUrl).hostname;
  const links = Array.from(contentRoot.querySelectorAll('a[href]'))
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

  const media = Array.from(contentRoot.querySelectorAll('video[src], audio[src], iframe[src], source[src]'))
    .map((el) => ({
      type: el.tagName.toLowerCase(),
      src: absolute(el.getAttribute('src')),
      title: el.getAttribute('title') || undefined,
    }))
    .filter((item) => item.src);

  const tables = Array.from(contentRoot.querySelectorAll('table')).map((table) => ({
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
  if (document.querySelector('article')) {
    articleSignals.push('dom:article');
    articleScore += 1;
  }
  if (h1) {
    articleSignals.push('dom:h1');
    articleScore += 1;
  }
  if (contentText.length >= 800) {
    articleSignals.push('content>=800');
    articleScore += 2;
  }
  if (contentRoot.querySelectorAll('p').length >= 5) {
    articleSignals.push('paragraphs>=5');
    articleScore += 1;
  }

  const keywords = uniq((metaFirst('keywords') || '').split(',').map(cleanText).filter(Boolean));
  const wordCount = contentText ? contentText.split(/\s+/).filter(Boolean).length : 0;

  return {
    requestedUrl,
    finalUrl: location.href,
    canonicalUrl,
    isArticle: articleScore >= 5 && contentText.length >= 300,
    articleSignals,
    lang: document.documentElement.lang || undefined,
    documentTitle: document.title,
    title,
    description: metaFirst('description', 'og:description'),
    keywords,
    robots: metaFirst('robots'),
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
