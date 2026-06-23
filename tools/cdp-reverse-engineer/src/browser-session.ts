import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { CaptureConfig } from './types.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 LioraCDP/1.0';

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  browser: Browser | null;
  close: () => Promise<void>;
}

export function resolveStorageStatePath(path?: string): string | undefined {
  if (!path) return undefined;
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`Session file không tồn tại: ${abs}\n→ Chạy trước: npm run capture:ladipage:login`);
  }
  return abs;
}

export async function validateSession(path?: string): Promise<void> {
  if (!path) return;
  const abs = resolveStorageStatePath(path)!;
  const raw = JSON.parse(await readFile(abs, 'utf8')) as { cookies?: Array<{ name: string }> };
  const names = new Set((raw.cookies ?? []).map((c) => c.name));
  if (!names.has('SSID')) {
    console.warn('[cdp] ⚠ Session thiếu cookie SSID — có thể chưa login đủ. Chạy lại capture:ladipage:login');
  } else {
    console.log(`[cdp] Session OK (${raw.cookies?.length ?? 0} cookies, có SSID + STORE_ID)`);
  }
}

export async function openBrowserSession(config: CaptureConfig): Promise<BrowserSession> {
  const viewport = { width: 1440, height: 900 };
  console.log('[cdp] Đang mở browser...');

  if (config.userDataDir) {
    await mkdir(config.userDataDir, { recursive: true });
    const context = await chromium.launchPersistentContext(config.userDataDir, {
      headless: config.headless,
      viewport,
      userAgent: USER_AGENT,
    });
    const page = context.pages()[0] ?? (await context.newPage());
    console.log('[cdp] Browser ready (persistent profile)');
    return { context, page, browser: null, close: () => context.close() };
  }

  const storageState = resolveStorageStatePath(config.storageStatePath);
  if (storageState) await validateSession(storageState);

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    viewport,
    userAgent: USER_AGENT,
    storageState,
  });
  const page = await context.newPage();
  console.log('[cdp] Browser ready' + (storageState ? ' (session loaded)' : ''));
  return { context, page, browser, close: () => browser.close() };
}

export function isLoginPage(url: string): boolean {
  return /\/auth\/(login|register|forgot-password)/i.test(url);
}

export async function ensureLoggedIn(page: Page, config: CaptureConfig): Promise<boolean> {
  const pauseMs = config.pauseForLoginMs ?? 0;
  if (pauseMs <= 0) return Boolean(config.storageStatePath || config.userDataDir);

  const loginUrl = config.loginUrl ?? 'https://app.ladipage.com/auth/login';
  await gotoPage(page, loginUrl, 'login page');

  console.log(`[cdp] Đăng nhập trong cửa sổ browser (chờ tối đa ${Math.round(pauseMs / 1000)}s)...`);
  const deadline = Date.now() + pauseMs;

  while (Date.now() < deadline) {
    if (!isLoginPage(page.url())) {
      console.log(`[cdp] Đã đăng nhập → ${page.url()}`);
      return true;
    }
    await page.waitForTimeout(1500);
  }

  return !isLoginPage(page.url());
}

export async function gotoPage(page: Page, url: string, label?: string): Promise<void> {
  const tag = label ?? url;
  console.log(`[cdp] Đang load: ${tag}...`);
  const t0 = Date.now();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } catch (err) {
    console.warn(`[cdp] Load chậm/timeout (${tag}), thử lại...`);
    await page.goto(url, { waitUntil: 'commit', timeout: 60_000 });
  }

  await page.waitForTimeout(3000);
  console.log(`[cdp] Loaded (${((Date.now() - t0) / 1000).toFixed(1)}s): ${page.url()}`);
}

export async function saveSession(context: BrowserContext, path: string, finalUrl: string): Promise<void> {
  if (isLoginPage(finalUrl)) {
    console.warn('[cdp] Không lưu session — vẫn ở trang login');
    return;
  }
  const abs = resolve(path);
  await mkdir(dirname(abs), { recursive: true });
  await context.storageState({ path: abs });
  console.log(`[cdp] Đã lưu/cập nhật session → ${abs}`);
}