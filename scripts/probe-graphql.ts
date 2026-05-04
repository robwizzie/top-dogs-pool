/**
 * Probe the APA SPA — captures GraphQL traffic for any URL list. Use this
 * when the scraper breaks or when you need to discover a new query shape
 * (scoresheets, member career stats, past teams, etc.).
 *
 * Usage:
 *   npx tsx scripts/probe-graphql.ts \
 *     'https://league.poolplayers.com/southjersey/team/12894673' \
 *     'https://league.poolplayers.com/southjersey/match/48978855' \
 *     'https://league.poolplayers.com/southjersey/member/08203835'
 *
 * Defaults to: team page, schedule, roster, stats; one match URL; one member URL.
 *
 * Writes data/gql-captures.json (redacted, gitignored).
 */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

const USERNAME = process.env.APA_USERNAME!;
const PASSWORD = process.env.APA_PASSWORD!;
const TEAM_URL =
  process.env.APA_TEAM_URL ??
  "https://league.poolplayers.com/southjersey/team/12894673";

const URLS =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        TEAM_URL,
        `${TEAM_URL}/schedule`,
        `${TEAM_URL}/roster`,
        `${TEAM_URL}/stats`,
        // First completed match from the schedule scrape.
        TEAM_URL.replace(/\/team\/\d+$/, "/match/48978855"),
        // First member from the roster scrape (Meghan).
        TEAM_URL.replace(/\/team\/\d+$/, "/member/08203835"),
      ];

function redact(s: string): string {
  return s.replace(
    /("password"|"deviceRefreshToken"|"refreshToken"|"accessToken"|"token")\s*:\s*"([^"]+)"/g,
    '$1:"[REDACTED]"',
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  type Cap = {
    i: number;
    pageUrl: string;
    method: string;
    status: number;
    operationName?: string;
    variables?: unknown;
    data?: unknown;
    errors?: unknown;
  };
  const captures: Cap[] = [];
  let i = 0;
  let currentPageUrl = "";

  page.on("response", async (resp) => {
    if (!resp.url().includes("gql.poolplayers.com")) return;
    const idx = ++i;
    const body = redact((await resp.text().catch(() => "")) || "");
    const reqs = (() => {
      try {
        const raw = resp.request().postData();
        if (!raw) return [{}];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [{}];
      }
    })();
    const responses = (() => {
      try {
        const parsed = JSON.parse(body);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [{}];
      }
    })();
    for (let k = 0; k < responses.length; k++) {
      const op = reqs[k] ?? reqs[0] ?? {};
      const r = responses[k] ?? {};
      captures.push({
        i: idx,
        pageUrl: currentPageUrl,
        method: resp.request().method(),
        status: resp.status(),
        operationName: op.operationName,
        variables: op.variables,
        data: r.data,
        errors: r.errors,
      });
    }
  });

  // Auth (login + consent).
  currentPageUrl = TEAM_URL;
  await page.goto(TEAM_URL, { waitUntil: "networkidle" });
  if (page.url().includes("login")) {
    await page.fill("input[name=email]", USERNAME);
    await page.fill("input[name=password]", PASSWORD);
    await page.evaluate(() => {
      const f = document.querySelector("form")!;
      f.requestSubmit ? f.requestSubmit() : f.submit();
    });
    await page.waitForURL((u) => !u.toString().includes("/login"), {
      timeout: 30_000,
    });
  }
  if (page.url().includes("/authorize")) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByRole("button", { name: /continue/i }).click({ force: true });
  }
  await page.waitForURL(
    (u) => {
      const s = u.toString();
      return (
        !s.includes("accounts.poolplayers.com") &&
        !s.includes("/login") &&
        !/\/token\?/.test(s)
      );
    },
    { timeout: 45_000 },
  );

  for (const u of URLS) {
    currentPageUrl = u;
    console.log("→", u);
    try {
      await page.goto(u, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(2500);
    } catch (e) {
      console.warn("  skipped:", (e as Error).message);
    }
  }

  await mkdir("data", { recursive: true });
  await writeFile("data/gql-captures.json", JSON.stringify(captures, null, 2));
  console.log(`\ncaptured ${captures.length} entries → data/gql-captures.json`);

  // Per-page summary
  const byPage = new Map<string, Map<string, number>>();
  for (const c of captures) {
    if (!byPage.has(c.pageUrl)) byPage.set(c.pageUrl, new Map());
    const m = byPage.get(c.pageUrl)!;
    const k = c.operationName ?? "(anonymous)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  for (const [pageUrl, ops] of byPage) {
    console.log(`\n[${pageUrl}]`);
    for (const [op, n] of [...ops.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${op.padEnd(32)} ${n}x`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
