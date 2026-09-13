const BAD_PATH_PARTS = [
  '/wp-admin/',
  '/wp-includes/',
  '/feed/',
  '/author/',
  '/tag/',
  '/search/',
  '/cart/',
  '/checkout/',
];

const STATIC_EXT_RE = /\.(?:jpg|jpeg|png|gif|webp|svg|ico|css|js|mjs|map|woff2?|ttf|eot|pdf|zip|rar|7z|mp4|webm|mp3|wav|xml|txt)$/i;

export function normalizeMonaUrl(input: string, baseUrl = 'https://mona.media'): string | undefined {
  try {
    const base = new URL(baseUrl);
    const url = new URL(input, base);
    if (!/^https?:$/.test(url.protocol)) return undefined;
    if (url.hostname !== base.hostname) return undefined;
    if (STATIC_EXT_RE.test(url.pathname)) return undefined;

    url.protocol = base.protocol;
    url.hostname = base.hostname;
    url.port = '';
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/{2,}/g, '/');
    if (!url.pathname.endsWith('/')) url.pathname += '/';

    const lowerPath = url.pathname.toLowerCase();
    if (BAD_PATH_PARTS.some((part) => lowerPath.includes(part))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isArchivePage(url: string): boolean {
  const path = new URL(url).pathname;
  return path === '/blog/' || /^\/blog\/page\/\d+\/$/.test(path);
}

export function isCandidateContentUrl(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  if (isArchivePage(url)) return false;
  if (path === '/' || path === '/blog/') return false;
  if (/^\/blog\/page\/\d+\/$/.test(path)) return false;
  return true;
}

export function archivePageNumber(url: string): number {
  const match = new URL(url).pathname.match(/^\/blog\/page\/(\d+)\/$/);
  return match ? Number(match[1]) : 1;
}

export function uniqueOrdered(urls: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
