import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "icd10-consumer-"));
try {
  const packed = JSON.parse(execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", directory], { encoding: "utf8" }));
  const tarball = packed[0];
  assert(tarball.files.some((file: { path: string }) => file.path === "dist/index.d.ts"));
  assert(tarball.files.every((file: { path: string }) => /^(dist\/|package.json$|README.md$|NOTICE.md$|LICENSE$)/.test(file.path)));
  await writeFile(join(directory, "package.json"), JSON.stringify({ private: true, type: "module" }));
  execFileSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", join(directory, tarball.filename)], { cwd: directory, stdio: "inherit" });
  await copyFile("scripts/smoke.mjs", join(directory, "smoke.mjs"));
  execFileSync("node", ["smoke.mjs"], { cwd: directory, stdio: "inherit" });
  await writeFile(join(directory, "consumer.ts"), `
import { latest, getCatalogForDate, type Diagnosis, type ReleaseId } from "@usetaiga/icd10cm";
import { catalog } from "@usetaiga/icd10cm/releases/2026-10-01";
const release: ReleaseId = "2026-10-01";
const diagnosis: Diagnosis | undefined = getCatalogForDate("2026-10-01").lookup("B35.1");
catalog.search("cholera", { billableOnly: false, limit: 5 });
// @ts-expect-error unbundled release
const invalidRelease: ReleaseId = "1900-01-01";
// @ts-expect-error code must be a string
latest.lookup(123);
// @ts-expect-error release metadata is readonly
latest.release.fiscalYear = 2030;
`);
  execFileSync("node", [resolve("node_modules/typescript/bin/tsc"), "--noEmit", "--strict", "--module", "NodeNext", "--target", "ES2022", "consumer.ts"], { cwd: directory, stdio: "inherit" });
  console.log(`Installed tarball passed: ${(tarball.size / 1024 / 1024).toFixed(2)} MiB compressed`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
