import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { Section, PageHeader } from "@/components/ui/Section";
import { ProductCard } from "@/components/store/ProductCard";
import { PointerSheen } from "@/components/home/PointerSheen";
import { PoolBall } from "@/components/brand/PoolBall";
import { SHOPIFY_CONFIGURED, getProducts } from "@/lib/shopify";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Official Top Dawgs gear — shirts, hoodies, and team merch. Repping the rack and the run.",
};

export default async function StorePage() {
  if (!SHOPIFY_CONFIGURED) {
    return <ConfigMissing />;
  }

  let products = [] as Awaited<ReturnType<typeof getProducts>>;
  let fetchError: string | null = null;
  try {
    products = await getProducts(50);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Unknown error";
  }

  const inStock = products.filter((p) => p.availableForSale);
  const soldOut = products.filter((p) => !p.availableForSale);

  return (
    <>
      <PointerSheen />
      <PageHeader
        eyebrow="The Pro Shop"
        title="Top Dawgs Gear"
        subtitle="Rack-tested merch worn by the team. Shirts, hoodies, and patches in our colors."
      >
        {products.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/75 backdrop-blur-sm">
              <ShoppingBag size={12} className="text-[var(--color-brass-bright)]" />
              {inStock.length} in stock
            </span>
            {soldOut.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/25 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-cream)]/50 backdrop-blur-sm">
                {soldOut.length} sold out
              </span>
            )}
          </div>
        )}
      </PageHeader>

      {fetchError ? (
        <Section>
          <div className="pm-glass mx-auto max-w-2xl p-8 text-center sm:p-10">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-pop)]/40 bg-[var(--color-pop)]/10 text-[var(--color-pop-bright)]">
              <ShoppingBag size={20} />
            </span>
            <p className="mt-4 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-cream)]">
              Couldn&rsquo;t load the shop right now.
            </p>
            <p className="mx-auto mt-3 max-w-md break-words rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2 font-mono text-xs text-[var(--color-cream)]/55">
              {fetchError}
            </p>
          </div>
        </Section>
      ) : products.length === 0 ? (
        <Section>
          <ShopEmpty title="No products yet">
            Check back soon — fresh gear is on the way.
          </ShopEmpty>
        </Section>
      ) : (
        <>
          {inStock.length > 0 && (
            <Section eyebrow="In stock" title="Shop the rack">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                {inStock.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </Section>
          )}
          {soldOut.length > 0 && (
            <Section eyebrow="Sold out" title="On the bench">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
                {soldOut.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </>
  );
}

function ConfigMissing() {
  return (
    <>
      <PageHeader
        eyebrow="The Pro Shop"
        title="Top Dawgs Gear"
        subtitle="Rack-tested merch worn by the team. Shirts, hoodies, and patches in our colors."
      />
      <Section className="pt-2 sm:pt-4">
        <ShopEmpty title="Shop is not configured">
          Set{" "}
          <code className="rounded-md border border-white/[0.08] bg-black/40 px-1.5 py-0.5 font-mono text-[0.8em] text-[var(--color-brass-bright)]">
            NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
          </code>{" "}
          and{" "}
          <code className="rounded-md border border-white/[0.08] bg-black/40 px-1.5 py-0.5 font-mono text-[0.8em] text-[var(--color-brass-bright)]">
            NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
          </code>{" "}
          in your environment.
        </ShopEmpty>
      </Section>
    </>
  );
}

/**
 * "Closed" sign for the pro shop: a felt-lit glass card with a brass sign
 * hanging off two chains. Used for the not-configured and no-products states.
 */
function ShopEmpty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pm-glass pm-grain relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,rgba(46,139,87,0.28),transparent_70%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-8 opacity-40 blur-[1.5px] drop-shadow-[0_20px_20px_rgba(0,0,0,0.6)]"
        aria-hidden
      >
        <PoolBall number={8} size={120} />
      </div>

      <div className="relative z-[2] flex flex-col items-center px-6 pb-12 pt-6 text-center sm:px-12 sm:pb-16">
        {/* the sign, hanging from the top edge */}
        <div className="relative flex flex-col items-center" aria-hidden>
          <div className="flex w-36 justify-between px-6">
            <span className="h-10 w-px bg-gradient-to-b from-transparent to-[var(--color-brass)]/70" />
            <span className="h-10 w-px bg-gradient-to-b from-transparent to-[var(--color-brass)]/70" />
          </div>
          <div className="pm-sway rounded-2xl bg-[linear-gradient(180deg,#2b1c12,#1a110a)] px-7 py-3 shadow-[inset_0_1px_0_rgba(255,220,170,0.2),inset_0_0_0_1px_rgba(201,162,74,0.35),0_20px_40px_-16px_rgba(0,0,0,0.9)]">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.4em] text-[var(--color-brass)]/80">
              Pro shop
            </span>
            <span className="pm-foil mt-0.5 block font-[family-name:var(--font-display)] text-4xl leading-none tracking-[0.12em]">
              Closed
            </span>
          </div>
        </div>

        <h2 className="mt-8 font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--color-cream)] sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-cream)]/65 sm:text-base [overflow-wrap:anywhere]">
          {children}
        </p>
      </div>
    </div>
  );
}
