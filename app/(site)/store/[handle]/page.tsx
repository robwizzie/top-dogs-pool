import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductDisplay } from "@/components/store/ProductDisplay";
import { getAllProductHandles, getProduct } from "@/lib/shopify";
import { pageMetadata } from "@/lib/site";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const handles = await getAllProductHandles();
    return handles.map((handle) => ({ handle }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  try {
    const product = await getProduct(handle);
    if (!product) return { title: "Not found" };
    const base = pageMetadata({
      title: product.title,
      description: product.description.slice(0, 160) || `Shop ${product.title} — official Top Dawgs gear.`,
      path: `/store/${handle}`,
    });
    // The product photo beats the site card; without one, the site card
    // (app/opengraph-image.tsx) is filled in by Next.
    if (!product.featuredImage) return base;
    const images = [{ url: product.featuredImage.url, alt: product.title }];
    return {
      ...base,
      openGraph: { ...base.openGraph, images },
      twitter: { ...base.twitter, images },
    };
  } catch {
    return { title: "Shop" };
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  return (
    <article className="pm-grain relative mt-[calc(-5rem-env(safe-area-inset-top))] overflow-x-clip">
      {/* Lamp-lit felt behind the top of the page, fading into the night. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]" aria-hidden>
        <div className="pm-felt absolute inset-0" />
        <div className="pm-lamp pm-lamp-flicker absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_50%_0%,transparent_35%,rgba(0,0,0,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-[var(--bg)]" />
      </div>

      <div className="relative z-[2] mx-auto max-w-7xl px-4 pb-14 pt-[calc(5rem+env(safe-area-inset-top)+1.75rem)] sm:px-6 sm:pb-20 sm:pt-[calc(5rem+env(safe-area-inset-top)+2.75rem)] lg:px-8">
        <Link
          href="/store"
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/25 py-1.5 pl-2.5 pr-3.5 text-xs font-semibold tracking-wide text-[var(--color-cream)]/75 backdrop-blur-sm transition-colors hover:border-[var(--color-brass)]/50 hover:text-[var(--color-brass-bright)] sm:mb-8"
        >
          <ChevronLeft size={14} /> Back to shop
        </Link>

        <ProductDisplay product={product} />
      </div>
    </article>
  );
}
