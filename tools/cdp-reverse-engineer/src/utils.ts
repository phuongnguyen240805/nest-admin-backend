export function nowIso(): string {
  return new Date().toISOString();
}

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…[truncated ${text.length - max} bytes]`;
}

export function parseUrlParts(raw: string): { host: string; path: string } {
  try {
    const u = new URL(raw);
    return { host: u.host, path: u.pathname };
  } catch {
    return { host: '', path: raw };
  }
}

export function matchService(
  value: string,
  patterns: { name: string; urlIncludes?: string[]; wsIncludes?: string[] }[],
  kind: 'url' | 'ws',
): string | undefined {
  const lower = value.toLowerCase();
  for (const p of patterns) {
    const list = kind === 'url' ? p.urlIncludes : p.wsIncludes;
    if (!list) continue;
    if (list.some((k) => lower.includes(k.toLowerCase()))) return p.name;
  }
  return undefined;
}

export function inferDtoName(path: string, suffix: 'Request' | 'Response'): string {
  const cleaned = path
    .replace(/^\/+/, '')
    .split(/[/?#]/)
    .filter(Boolean)
    .slice(-2)
    .join(' ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  return `${cleaned || 'Unknown'}${suffix}Dto`;
}