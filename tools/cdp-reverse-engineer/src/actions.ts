import type { Page } from 'playwright';
import type { CaptureAction } from './types.js';

export async function runAction(page: Page, action: CaptureAction, index: number): Promise<void> {
  const label = action.label ? ` (${action.label})` : '';
  const n = index + 1;

  switch (action.type) {
    case 'wait':
      console.log(`[cdp] Action ${n}${label}: chờ ${action.ms ?? 1000}ms`);
      await page.waitForTimeout(action.ms ?? 1000);
      break;

    case 'navigate':
      if (!action.value) break;
      console.log(`[cdp] Action ${n}${label}: navigate → ${action.value}`);
      await page.goto(action.value, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(3000);
      break;

    case 'waitForSelector':
      if (!action.selector) break;
      console.log(`[cdp] Action ${n}${label}: waitForSelector ${action.selector}`);
      await page.waitForSelector(action.selector, { timeout: action.ms ?? 15_000 }).catch(() => undefined);
      break;

    case 'click':
      if (!action.selector) break;
      console.log(`[cdp] Action ${n}${label}: click ${action.selector}`);
      await page
        .locator(action.selector)
        .first()
        .click({ timeout: 15_000, force: action.force ?? false })
        .catch(() => undefined);
      await page.waitForTimeout(800);
      break;

    case 'dblclick':
      if (!action.selector) break;
      console.log(`[cdp] Action ${n}${label}: dblclick ${action.selector}`);
      await page
        .locator(action.selector)
        .first()
        .dblclick({ timeout: 15_000, force: action.force ?? false })
        .catch(() => undefined);
      await page.waitForTimeout(1200);
      break;

    case 'hover':
      if (!action.selector) break;
      console.log(`[cdp] Action ${n}${label}: hover ${action.selector}`);
      await page.locator(action.selector).first().hover({ timeout: 15_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
      break;

    case 'fill':
      if (!action.selector) break;
      console.log(`[cdp] Action ${n}${label}: fill ${action.selector}`);
      await page.locator(action.selector).first().fill(action.value ?? '', { timeout: 15_000 }).catch(() => undefined);
      break;

    case 'scroll':
      console.log(`[cdp] Action ${n}${label}: scroll`);
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      break;

    case 'press':
      if (!action.value) break;
      console.log(`[cdp] Action ${n}${label}: press ${action.value}`);
      await page.keyboard.press(action.value);
      break;
  }
}