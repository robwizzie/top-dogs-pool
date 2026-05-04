/**
 * File-based cache for raw APA GraphQL responses.
 *
 * Layout:
 *   data/cache/<kind>/<id>.json     — raw entity payload + fetched-at metadata
 *   data/cache/meta.json            — cross-cutting state (current session id, etc.)
 *
 * Each cache file looks like:
 *   { "fetchedAt": "2026-05-02T19:34:57Z", "data": { ...raw graphql data... } }
 *
 * Records are immutable from the cache layer's perspective — overwriting is the
 * only way to "update" them. The scraper checks freshness before deciding to
 * re-fetch.
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type CacheKind = "teams" | "matches" | "members" | "divisions";

export type CacheRecord<T = unknown> = {
  fetchedAt: string;
  data: T;
};

export class ApaCache {
  constructor(public readonly root: string = resolve("data/cache")) {}

  private path(kind: CacheKind, id: string | number) {
    return join(this.root, kind, `${id}.json`);
  }

  async read<T>(kind: CacheKind, id: string | number): Promise<CacheRecord<T> | null> {
    try {
      const raw = await readFile(this.path(kind, id), "utf8");
      return JSON.parse(raw) as CacheRecord<T>;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async write<T>(kind: CacheKind, id: string | number, data: T): Promise<void> {
    const dir = join(this.root, kind);
    await mkdir(dir, { recursive: true });
    const record: CacheRecord<T> = {
      fetchedAt: new Date().toISOString(),
      data,
    };
    await writeFile(this.path(kind, id), JSON.stringify(record, null, 2));
  }

  async list(kind: CacheKind): Promise<string[]> {
    try {
      const files = await readdir(join(this.root, kind));
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  /** Bulk-load every cached entity of a given kind. */
  async readAll<T>(kind: CacheKind): Promise<Array<{ id: string; record: CacheRecord<T> }>> {
    const ids = await this.list(kind);
    const out: Array<{ id: string; record: CacheRecord<T> }> = [];
    for (const id of ids) {
      const record = await this.read<T>(kind, id);
      if (record) out.push({ id, record });
    }
    return out;
  }

  /** Read meta.json (small JSON of cross-cutting state). */
  async readMeta<T = Record<string, unknown>>(): Promise<T | null> {
    try {
      const raw = await readFile(join(this.root, "meta.json"), "utf8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async writeMeta<T>(data: T): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, "meta.json"), JSON.stringify(data, null, 2));
  }

  async existsAndFresh(
    kind: CacheKind,
    id: string | number,
    isFresh: (record: CacheRecord) => boolean,
  ): Promise<boolean> {
    const record = await this.read(kind, id);
    return record !== null && isFresh(record);
  }

  async statMtime(kind: CacheKind, id: string | number): Promise<Date | null> {
    try {
      const s = await stat(this.path(kind, id));
      return s.mtime;
    } catch {
      return null;
    }
  }
}

/* Freshness predicates --------------------------------------------------- */

export function olderThan(record: CacheRecord, ms: number): boolean {
  return Date.now() - new Date(record.fetchedAt).getTime() > ms;
}

export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * ONE_HOUR;
export const ONE_WEEK = 7 * ONE_DAY;
