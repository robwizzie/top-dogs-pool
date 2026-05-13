const DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";
const TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? "";
const VERSION = process.env.NEXT_PUBLIC_SHOPIFY_API_VERSION ?? "2024-10";

const ENDPOINT = DOMAIN ? `https://${DOMAIN}/api/${VERSION}/graphql.json` : "";

export const SHOPIFY_CONFIGURED = Boolean(DOMAIN && TOKEN);

export type Money = { amount: string; currencyCode: string };

export type ProductImage = {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

export type ProductVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  quantityAvailable: number | null;
  price: Money;
  compareAtPrice: Money | null;
  selectedOptions: { name: string; value: string }[];
  image: ProductImage | null;
};

export type ProductOption = {
  name: string;
  values: string[];
};

export type ProductSummary = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  totalInventory: number | null;
  featuredImage: ProductImage | null;
  priceRange: { min: Money; max: Money };
  compareAtPriceRange: { min: Money; max: Money } | null;
  tags: string[];
};

export type Product = ProductSummary & {
  descriptionHtml: string;
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariant[];
};

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    image: ProductImage | null;
    selectedOptions: { name: string; value: string }[];
    product: { handle: string; title: string };
    price: Money;
  };
  cost: {
    totalAmount: Money;
    subtotalAmount: Money;
  };
};

export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  lines: CartLine[];
  cost: {
    subtotalAmount: Money;
    totalAmount: Money;
    totalTaxAmount: Money | null;
  };
  discountCodes: { code: string; applicable: boolean }[];
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function shopifyFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { cache?: RequestCache; next?: { revalidate?: number; tags?: string[] } } = {},
): Promise<T> {
  if (!SHOPIFY_CONFIGURED) {
    throw new Error("Shopify storefront is not configured.");
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
    cache: options.cache,
    next: options.next,
  });
  if (!res.ok) {
    throw new Error(`Shopify API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL: empty data");
  }
  return json.data;
}

const PRODUCT_SUMMARY_FRAGMENT = /* GraphQL */ `
  fragment ProductSummaryFields on Product {
    id
    handle
    title
    description
    availableForSale
    totalInventory
    tags
    featuredImage {
      url
      altText
      width
      height
    }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
  }
`;

const PRODUCT_DETAIL_FRAGMENT = /* GraphQL */ `
  fragment ProductDetailFields on Product {
    id
    handle
    title
    description
    descriptionHtml
    availableForSale
    totalInventory
    tags
    featuredImage { url altText width height }
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    images(first: 12) {
      edges { node { url altText width height } }
    }
    options {
      name
      values
    }
    variants(first: 100) {
      edges {
        node {
          id
          title
          availableForSale
          quantityAvailable
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
          image { url altText width height }
        }
      }
    }
  }
`;

type RawProductSummary = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  totalInventory: number | null;
  tags: string[];
  featuredImage: ProductImage | null;
  priceRange: { minVariantPrice: Money; maxVariantPrice: Money };
  compareAtPriceRange: { minVariantPrice: Money; maxVariantPrice: Money } | null;
};

type RawProductDetail = RawProductSummary & {
  descriptionHtml: string;
  images: { edges: { node: ProductImage }[] };
  options: ProductOption[];
  variants: { edges: { node: ProductVariant }[] };
};

function mapSummary(p: RawProductSummary): ProductSummary {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    availableForSale: p.availableForSale,
    totalInventory: p.totalInventory,
    tags: p.tags ?? [],
    featuredImage: p.featuredImage,
    priceRange: { min: p.priceRange.minVariantPrice, max: p.priceRange.maxVariantPrice },
    compareAtPriceRange: p.compareAtPriceRange
      ? { min: p.compareAtPriceRange.minVariantPrice, max: p.compareAtPriceRange.maxVariantPrice }
      : null,
  };
}

function mapDetail(p: RawProductDetail): Product {
  return {
    ...mapSummary(p),
    descriptionHtml: p.descriptionHtml,
    images: p.images.edges.map((e) => e.node),
    options: p.options,
    variants: p.variants.edges.map((e) => e.node),
  };
}

export async function getProducts(first = 50): Promise<ProductSummary[]> {
  const query = /* GraphQL */ `
    ${PRODUCT_SUMMARY_FRAGMENT}
    query Products($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        edges { node { ...ProductSummaryFields } }
      }
    }
  `;
  const data = await shopifyFetch<{ products: { edges: { node: RawProductSummary }[] } }>(
    query,
    { first },
    { next: { revalidate: 300, tags: ["shopify-products"] } },
  );
  return data.products.edges.map((e) => mapSummary(e.node));
}

export async function getProduct(handle: string): Promise<Product | null> {
  const query = /* GraphQL */ `
    ${PRODUCT_DETAIL_FRAGMENT}
    query Product($handle: String!) {
      product(handle: $handle) { ...ProductDetailFields }
    }
  `;
  const data = await shopifyFetch<{ product: RawProductDetail | null }>(
    query,
    { handle },
    { next: { revalidate: 300, tags: ["shopify-products", `shopify-product-${handle}`] } },
  );
  return data.product ? mapDetail(data.product) : null;
}

export async function getAllProductHandles(): Promise<string[]> {
  const query = /* GraphQL */ `
    query AllHandles { products(first: 250) { edges { node { handle } } } }
  `;
  const data = await shopifyFetch<{ products: { edges: { node: { handle: string } }[] } }>(
    query,
    {},
    { next: { revalidate: 600 } },
  );
  return data.products.edges.map((e) => e.node.handle);
}

/* ---------- Cart mutations (client-side) ---------- */

const CART_FRAGMENT = /* GraphQL */ `
  fragment CartFields on Cart {
    id
    checkoutUrl
    totalQuantity
    cost {
      subtotalAmount { amount currencyCode }
      totalAmount { amount currencyCode }
      totalTaxAmount { amount currencyCode }
    }
    discountCodes { code applicable }
    lines(first: 100) {
      edges {
        node {
          id
          quantity
          cost {
            totalAmount { amount currencyCode }
            subtotalAmount { amount currencyCode }
          }
          merchandise {
            ... on ProductVariant {
              id
              title
              price { amount currencyCode }
              image { url altText width height }
              selectedOptions { name value }
              product { handle title }
            }
          }
        }
      }
    }
  }
`;

type RawCart = Omit<Cart, "lines"> & {
  lines: { edges: { node: CartLine }[] };
};

function mapCart(c: RawCart): Cart {
  return { ...c, lines: c.lines.edges.map((e) => e.node) };
}

export async function clientCartCreate(): Promise<Cart> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation CartCreate { cartCreate { cart { ...CartFields } userErrors { message } } }
  `;
  const data = await shopifyFetch<{ cartCreate: { cart: RawCart; userErrors: { message: string }[] } }>(
    query,
    {},
    { cache: "no-store" },
  );
  return mapCart(data.cartCreate.cart);
}

export async function clientCartGet(cartId: string): Promise<Cart | null> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    query Cart($id: ID!) { cart(id: $id) { ...CartFields } }
  `;
  const data = await shopifyFetch<{ cart: RawCart | null }>(
    query,
    { id: cartId },
    { cache: "no-store" },
  );
  return data.cart ? mapCart(data.cart) : null;
}

export async function clientCartLinesAdd(cartId: string, variantId: string, quantity: number): Promise<Cart> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation Add($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { message } }
    }
  `;
  const data = await shopifyFetch<{ cartLinesAdd: { cart: RawCart; userErrors: { message: string }[] } }>(
    query,
    { cartId, lines: [{ merchandiseId: variantId, quantity }] },
    { cache: "no-store" },
  );
  if (data.cartLinesAdd.userErrors.length) {
    throw new Error(data.cartLinesAdd.userErrors.map((e) => e.message).join("; "));
  }
  return mapCart(data.cartLinesAdd.cart);
}

export async function clientCartLinesUpdate(cartId: string, lineId: string, quantity: number): Promise<Cart> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation Update($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { message } }
    }
  `;
  const data = await shopifyFetch<{ cartLinesUpdate: { cart: RawCart; userErrors: { message: string }[] } }>(
    query,
    { cartId, lines: [{ id: lineId, quantity }] },
    { cache: "no-store" },
  );
  if (data.cartLinesUpdate.userErrors.length) {
    throw new Error(data.cartLinesUpdate.userErrors.map((e) => e.message).join("; "));
  }
  return mapCart(data.cartLinesUpdate.cart);
}

export async function clientCartLinesRemove(cartId: string, lineIds: string[]): Promise<Cart> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation Remove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { message } }
    }
  `;
  const data = await shopifyFetch<{ cartLinesRemove: { cart: RawCart; userErrors: { message: string }[] } }>(
    query,
    { cartId, lineIds },
    { cache: "no-store" },
  );
  if (data.cartLinesRemove.userErrors.length) {
    throw new Error(data.cartLinesRemove.userErrors.map((e) => e.message).join("; "));
  }
  return mapCart(data.cartLinesRemove.cart);
}

export async function clientCartDiscountUpdate(cartId: string, codes: string[]): Promise<Cart> {
  const query = /* GraphQL */ `
    ${CART_FRAGMENT}
    mutation Discount($cartId: ID!, $codes: [String!]!) {
      cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $codes) {
        cart { ...CartFields }
        userErrors { message }
      }
    }
  `;
  const data = await shopifyFetch<{
    cartDiscountCodesUpdate: { cart: RawCart; userErrors: { message: string }[] };
  }>(
    query,
    { cartId, codes },
    { cache: "no-store" },
  );
  if (data.cartDiscountCodesUpdate.userErrors.length) {
    throw new Error(data.cartDiscountCodesUpdate.userErrors.map((e) => e.message).join("; "));
  }
  return mapCart(data.cartDiscountCodesUpdate.cart);
}

export function formatMoney(money: Money | null | undefined): string {
  if (!money) return "";
  const n = Number(money.amount);
  if (!Number.isFinite(n)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: money.currencyCode }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}
