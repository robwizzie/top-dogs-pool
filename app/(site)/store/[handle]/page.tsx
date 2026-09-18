import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductDisplay } from "@/components/store/ProductDisplay";
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
    <article className="mx-auto max-w-7xl overflow-x-hidden px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <Link
        href="/store"
        className="mb-6 inline-flex items-center gap-1 text-sm text-[var(--fg-dim)] hover:text-[var(--color-brass-bright)]"
      >
        <ChevronLeft size={14} /> Back to shop
      </Link>

      <ProductDisplay product={product} />
    </article>
  );
}
