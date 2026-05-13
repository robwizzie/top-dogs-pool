import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductGallery } from "@/components/store/ProductGallery";
import { AddToCart } from "@/components/store/AddToCart";
import { getAllProductHandles, getProduct } from "@/lib/shopify";

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
    return {
      title: product.title,
      description: product.description.slice(0, 160) || `Shop ${product.title} — Top Dawgs`,
      openGraph: {
        title: product.title,
        description: product.description.slice(0, 160),
        images: product.featuredImage ? [{ url: product.featuredImage.url }] : undefined,
      },
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
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        href="/store"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass-bright)]"
      >
        <ChevronLeft size={14} /> Back to shop
      </Link>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} title={product.title} />

        <div className="flex flex-col gap-6">
          <header>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-brass)]">
              Top Dawgs Pro Shop
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide sm:text-5xl">
              {product.title}
            </h1>
          </header>

          <AddToCart product={product} />

          {product.descriptionHtml && (
            <div
              className="prose prose-invert max-w-none text-sm leading-relaxed text-[var(--fg-dim)] [&_a]:text-[var(--color-brass-bright)] [&_strong]:text-[var(--fg)]"
              dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
            />
          )}

          {product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--fg-dim)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
