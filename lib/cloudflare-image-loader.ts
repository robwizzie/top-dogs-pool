/**
 * next/image loader used ONLY for the Cloudflare Workers build (see
 * next.config.ts). Workers have no built-in image optimizer, and the
 * Cloudflare Images binding has a monthly transformation quota, so this keeps
 * the free plan free:
 *
 *  - Shopify CDN already resizes on the fly via `?width=` — use it.
 *  - Everything else (YouTube thumbnails, APA, our own /public files) is
 *    served as-is, exactly like `images.unoptimized`.
 *
 * Vercel / Docker builds keep Next's built-in optimizer and never load this.
 */
export default function cloudflareImageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (src.startsWith("https://cdn.shopify.com/")) {
    try {
      const url = new URL(src);
      url.searchParams.set("width", String(width));
      return url.toString();
    } catch {
      return src;
    }
  }
  return src;
}
