import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { catalogs, type ReleaseId } from "../src/index.js";
import type { RawCodes } from "../src/catalog.js";

test("every bundled snapshot agrees with its manifest and runtime lookups", async () => {
  for (const [id, catalog] of Object.entries(catalogs)) {
    const codes: RawCodes = JSON.parse(await readFile(`src/data/${id}.json`, "utf8"));
    const entries = Object.entries(codes);
    expect(entries.length).toBe(catalog.release.entryCount);
    expect(entries.filter(([, row]) => row[2]).length).toBe(catalog.release.billableCount);
    expect(catalog.release.archiveSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(catalog.release.orderFileSha256).toMatch(/^[a-f0-9]{64}$/);
    for (const [code, row] of entries) {
      if (row.length !== 3 || typeof row[0] !== "string" || !row[0] || typeof row[1] !== "string" ||
          !row[1] || typeof row[2] !== "boolean" || catalog.lookup(code)?.code !== code) {
        throw new Error(`Invalid bundled data: ${id} ${code}`);
      }
    }
    expect(catalogs[id as ReleaseId]).toBe(catalog);
  }
});
