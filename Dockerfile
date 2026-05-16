# syntax=docker/dockerfile:1
# Multi-stage build for the Next.js 15 app, deployed on Coolify (Dockerfile build pack).

# --- deps: install node_modules ----------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
# Playwright's npm package skips its browser download by default; the runtime
# app never launches a browser (only the scraper script does, in CI).
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the app ------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they
# must be present here. In Coolify, mark these as "Build Variable" so they are
# passed through as --build-arg. Runtime-only secrets (RESEARCH_PASSWORD,
# REVALIDATE_SECRET, YOUTUBE_API_KEY, ...) are NOT needed at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_TIKTOK_HANDLE
ARG NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN
ARG NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN
ARG NEXT_PUBLIC_SHOPIFY_API_VERSION
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_TIKTOK_HANDLE=$NEXT_PUBLIC_TIKTOK_HANDLE \
    NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=$NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN \
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=$NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN \
    NEXT_PUBLIC_SHOPIFY_API_VERSION=$NEXT_PUBLIC_SHOPIFY_API_VERSION \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- runner: minimal production image ----------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone server output + the assets it does not bundle itself.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# apa.json / players-config.json are read at runtime via process.cwd();
# the standalone tracer cannot see those, so copy the data dir explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
