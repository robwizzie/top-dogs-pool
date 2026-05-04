/**
 * Capture GraphQL traffic to gql.poolplayers.com from a Playwright Page.
 *
 * Apollo APA client batches multiple operations into a single POST whose
 * request body is an array of `{ operationName, variables, query }` and
 * whose response body is an array of `{ data, errors }`. We parse both
 * sides, pair them by index, and stream each into a buffer keyed by
 * operation name.
 */
import type { Page, Request } from "playwright";

export type CapturedOp = {
  operationName?: string;
  variables?: Record<string, unknown>;
  data?: Record<string, unknown> | null;
  errors?: unknown;
  capturedAt: number;
};

function parseRequestOps(req: Request): Array<{
  operationName?: string;
  variables?: Record<string, unknown>;
  query?: string;
}> {
  const body = req.method() === "POST" ? req.postData() : null;
  if (body) {
    try {
      const parsed = JSON.parse(body);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  }
  // GET — single op in querystring.
  const u = new URL(req.url());
  const op: Record<string, unknown> = {};
  for (const k of ["operationName", "variables", "query"]) {
    const v = u.searchParams.get(k);
    if (!v) continue;
    if (k === "variables")
      try {
        op[k] = JSON.parse(v);
      } catch {
        op[k] = v;
      }
    else op[k] = v;
  }
  return [op];
}

export class GraphqlCapture {
  private ops: CapturedOp[] = [];

  attach(page: Page) {
    page.on("response", async (resp) => {
      if (!resp.url().includes("gql.poolplayers.com")) return;
      const reqs = parseRequestOps(resp.request());
      let bodies: unknown;
      try {
        bodies = await resp.json();
      } catch {
        return;
      }
      const responses = Array.isArray(bodies) ? bodies : [bodies];
      const capturedAt = Date.now();
      for (let i = 0; i < responses.length; i++) {
        const reqOp = reqs[i] ?? reqs[0] ?? {};
        const resOp = (responses[i] as { data?: Record<string, unknown>; errors?: unknown }) ?? {};
        this.ops.push({
          operationName: reqOp.operationName,
          variables: reqOp.variables,
          data: resOp.data,
          errors: resOp.errors,
          capturedAt,
        });
      }
    });
  }

  /** Total ops captured, for debug logging. */
  get size() {
    return this.ops.length;
  }

  /** Drop everything older than `since` (ms epoch). */
  pruneBefore(since: number) {
    this.ops = this.ops.filter((o) => o.capturedAt >= since);
  }

  /** Most-recent successful response for an operation. */
  latest(name: string): CapturedOp | null {
    for (let i = this.ops.length - 1; i >= 0; i--) {
      const op = this.ops[i];
      if (op.operationName === name && op.data && !op.errors) return op;
    }
    return null;
  }

  /** Every successful response for an operation, in order captured. */
  all(name: string, opts: { minCapturedAt?: number } = {}): CapturedOp[] {
    const after = opts.minCapturedAt ?? 0;
    return this.ops.filter(
      (op) =>
        op.operationName === name &&
        op.data &&
        !op.errors &&
        op.capturedAt >= after,
    );
  }

  /**
   * Wait until a query with the given name completes successfully.
   * Useful right after navigation when we know which query the page fires.
   */
  async waitFor(
    name: string,
    opts: { timeoutMs?: number; minCapturedAt?: number } = {},
  ): Promise<CapturedOp | null> {
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const after = opts.minCapturedAt ?? 0;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (let i = this.ops.length - 1; i >= 0; i--) {
        const op = this.ops[i];
        if (op.capturedAt < after) break;
        if (op.operationName === name && op.data && !op.errors) return op;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  /** Snapshot the buffer (immutable copy). */
  snapshot(): CapturedOp[] {
    return [...this.ops];
  }

  summary(): Array<[string, number]> {
    const counts = new Map<string, number>();
    for (const op of this.ops) {
      const k = op.operationName ?? "(anonymous)";
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }
}
