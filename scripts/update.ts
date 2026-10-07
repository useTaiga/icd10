import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import type { RawCodes, Release } from "../src/catalog.js";
import { discoverSources, parseOrderFile, SOURCE_PAGE, verifyBillableFile } from "./source.js";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  if (new URL(response.url).hostname !== "www.cms.gov") throw new Error("Unexpected CMS redirect");
  return new Uint8Array(await response.arrayBuffer());
}
const sources = discoverSources(strFromU8(await fetchBytes(SOURCE_PAGE)));
let previous: Release[] = [];
try { previous = JSON.parse(await readFile("src/data/releases.json", "utf8")); }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
for (const release of previous) {
  if (!sources.some((s) => s.id === release.id)) throw new Error(`CMS no longer lists ${release.id}; review source discovery`);
}
const prepared: { release: Release; codes: RawCodes }[] = [];
const report: string[] = ["# ICD-10-CM catalog update", "", `Source: ${SOURCE_PAGE}`, ""];
for (const source of sources) {
  const archive = await fetchBytes(source.sourceUrl);
  const files = unzipSync(archive);
  const orderFiles = Object.keys(files).filter((name) => /(?:^|\/)icd10cm_order_.*\.txt$/i.test(name) && !/addenda/i.test(name));
  if (orderFiles.length !== 1) throw new Error(`Expected one full order file in ${source.sourceUrl}`);
  const orderFile = orderFiles[0]!;
  const bytes = files[orderFile]!;
  const codes = parseOrderFile(strFromU8(bytes));
  const codeFiles = Object.keys(files).filter((name) => /(?:^|\/)icd10cm_codes_.*\.txt$/i.test(name) && !/addenda/i.test(name));
  if (codeFiles.length !== 1) throw new Error(`Expected one full billable codes file in ${source.sourceUrl}`);
  verifyBillableFile(strFromU8(files[codeFiles[0]!]!), codes);
  const entryCount = Object.keys(codes).length;
  const billableCount = Object.values(codes).filter((row) => row[2]).length;
  if (entryCount < 90_000 || billableCount < 70_000) throw new Error(`Suspiciously small catalog: ${source.id}`);
  const release: Release = { ...source, archiveSha256: sha256(archive), orderFile,
    orderFileSha256: sha256(bytes), entryCount, billableCount };
  prepared.push({ release, codes });
  let before: RawCodes = {};
  try { before = JSON.parse(await readFile(`src/data/${source.id}.json`, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const added = Object.keys(codes).filter((code) => !before[code]);
  const removed = Object.keys(before).filter((code) => !codes[code]);
  const changed = Object.keys(codes).filter((code) => before[code] && JSON.stringify(before[code]) !== JSON.stringify(codes[code]));
  const metadataChanged = JSON.stringify(previous.find((r) => r.id === source.id)) !== JSON.stringify(release);
  if (added.length || removed.length || changed.length || metadataChanged) {
    report.push(`## ${source.id} (FY${source.fiscalYear})`, "",
      `${entryCount} entries; ${billableCount} billable codes. Compared with the previously committed snapshot:`, "",
      `- Added: ${added.length}`, `- Removed: ${removed.length}`, `- Changed: ${changed.length}`, "");
    for (const [label, list] of [["Added", added], ["Removed", removed], ["Changed", changed]] as const) {
      if (list.length > 0 && list.length <= 1000) report.push(`**${label}:** ${list.join(", ")}`, "");
    }
  }
  console.log(`${source.id}: ${entryCount} entries, ${billableCount} billable`);
}
await mkdir("src/data", { recursive: true });
for (const { release, codes } of prepared) {
  await writeFile(`src/data/${release.id}.json`, "{\n" + Object.entries(codes)
    .map(([code, row]) => `  ${JSON.stringify(code)}: ${JSON.stringify(row)}`).join(",\n") + "\n}\n");
}
await writeFile("src/data/releases.json", JSON.stringify(prepared.map((p) => p.release), null, 2) + "\n");
await writeFile("UPDATE.md", report.join("\n"));
