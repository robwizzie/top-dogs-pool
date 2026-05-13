import type { Metadata } from "next";
import { Section, PageHeader } from "@/components/ui/Section";
import { ProductCard } from "@/components/store/ProductCard";
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
      <PageHeader
        eyebrow="The Pro Shop"
        title="Top Dawgs Gear"
        subtitle="Rack-tested merch worn by the team. Shirts, hoodies, and patches in our colors."
      />

      {fetchError ? (
        <Section>
          <div className="surface p-6 text-center">
            <p className="text-sm text-[var(--color-pop-bright)]">
              Couldn&rsquo;t load the shop right now.
            </p>
            <p className="mt-2 text-xs text-[var(--fg-dim)]">{fetchError}</p>
          </div>
        </Section>
      ) : products.length === 0 ? (
        <Section>
          <div className="surface p-10 text-center">
            <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
              No products yet
            </h2>
            <p className="mt-2 text-sm text-[var(--fg-dim)]">
              Check back soon — fresh gear is on the way.
            </p>
          </div>
        </Section>
      ) : (
        <>
          {inStock.length > 0 && (
            <Section eyebrow="In stock" title="Shop the rack">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {inStock.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </Section>
          )}
          {soldOut.length > 0 && (
            <Section eyebrow="Sold out" title="On the bench">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
    <Section>
      <div className="surface p-10 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide">
          Shop is not configured
        </h2>
        <p className="mt-2 text-sm text-[var(--fg-dim)]">
          Set <code>NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code> and{" "}
          <code>NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN</code> in your environment.
        </p>
      </div>
    </Section>
  );
}
