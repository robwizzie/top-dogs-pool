/**
 * Walk the APA auth flow: /login → /authorize "Continue" consent → /token
 * exchange → original page. Idempotent — if the page is already authenticated
 * it returns immediately.
 */
import type { Page } from "playwright";

async function submitForm(page: Page) {
  const ok = await page.evaluate(() => {
    const form = document.querySelector("form");
    if (!form) return false;
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
    return true;
  });
  if (!ok) {
    await page.click("button[type=submit]", { force: true, timeout: 10_000 });
  }
}

export async function authenticate(
  page: Page,
  creds: { username: string; password: string },
  opts: { screenshotOnFailure?: string } = {},
): Promise<void> {
  // 1. /login — email + password.
  if (page.url().includes("accounts.poolplayers.com/login")) {
    console.log("→ logging in as", creds.username);
    await page.fill("input[name=email]", creds.username);
    await page.fill("input[name=password]", creds.password);
    await submitForm(page);
    try {
      await page.waitForURL(
        (u) => !u.toString().includes("accounts.poolplayers.com/login"),
        { timeout: 30_000 },
      );
    } catch {
      if (opts.screenshotOnFailure) {
        await page.screenshot({ path: opts.screenshotOnFailure, fullPage: true });
      }
      throw new Error(`Login form did not advance. URL=${page.url()}`);
    }
  }

  // 2. /authorize — OAuth-style "Continue to Member Services" consent.
  // (No <form>; the button itself triggers the redirect.)
  if (page.url().includes("accounts.poolplayers.com/authorize")) {
    console.log("→ confirming OAuth consent");
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    const continueBtn = page.getByRole("button", { name: /continue/i });
    try {
      await continueBtn.waitFor({ state: "visible", timeout: 15_000 });
      await continueBtn.click({ force: true });
    } catch (e) {
      if (opts.screenshotOnFailure) {
        await page.screenshot({ path: opts.screenshotOnFailure, fullPage: true });
      }
      throw new Error(
        `OAuth consent failed at ${page.url()}: ${(e as Error).message}`,
      );
    }
  }

  // 3. Wait until we leave accounts.* AND finish the /token bounce.
  try {
    await page.waitForURL(
      (u) => {
        const s = u.toString();
        return (
          !s.includes("accounts.poolplayers.com") &&
          !s.includes("/login") &&
          !/league\.poolplayers\.com\/token\?/.test(s)
        );
      },
      { timeout: 45_000 },
    );
  } catch {
    if (opts.screenshotOnFailure) {
      await page.screenshot({ path: opts.screenshotOnFailure, fullPage: true });
    }
    throw new Error(`Auth chain stuck at ${page.url()}`);
  }
}
