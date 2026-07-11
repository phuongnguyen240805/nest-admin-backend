/**
 * ladipage-bridge server entry (Instatic plugin QuickJS).
 * Pseudocode / template — wire to official plugin SDK when CMS is live.
 *
 * Required env (injected via plugin settings):
 *   LADIPAGE_BFF_BASE
 *   LADIPAGE_BRIDGE_HMAC_SECRET
 */

export async function onPublish(ctx) {
  const base = (ctx.settings.LADIPAGE_BFF_BASE || "").replace(/\/$/, "");
  const secret = ctx.settings.LADIPAGE_BRIDGE_HMAC_SECRET || "";
  if (!base || !secret) {
    ctx.log.warn("ladipage-bridge: missing BFF base or HMAC secret");
    return;
  }

  const body = JSON.stringify({
    pageId: ctx.meta.ladipagePageId || ctx.page.id,
    externalPageId: ctx.page.id,
    html: ctx.publishedHtml,
    seoTitle: ctx.page.title,
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  // Host must expose crypto.hmacSha256Hex in plugin sandbox
  const signature = await ctx.crypto.hmacSha256Hex(secret, `${timestamp}.${body}`);

  const res = await ctx.fetch(`${base}/api/internal/landing/publish-intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lp-timestamp": timestamp,
      "x-lp-signature": signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`publish-intent failed: ${res.status} ${text}`);
  }
}
