import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { Release } from "../src/catalog.js";

const releases: Release[] = JSON.parse(await readFile("src/data/releases.json", "utf8"));
await rm("src/releases", { recursive: true, force: true });
await mkdir("src/releases", { recursive: true });
for (const release of releases) {
  await writeFile(`src/releases/${release.id}.ts`,
    `import data from "../data/${release.id}.json" with { type: "json" };\n` +
    `import { createCatalog, type Catalog, type RawCodes } from "../catalog.js";\n` +
    `export const catalog: Catalog = createCatalog(${JSON.stringify(release)}, data as unknown as RawCodes);\n` +
    `export default catalog;\n`);
}
await writeFile("src/index.ts",
  `import { validateDate, type Catalog, type Release } from "./catalog.js";\n` +
  `import manifest from "./data/releases.json" with { type: "json" };\n` +
  `export { normalizeCode } from "./catalog.js";\n` +
  `export type { Catalog, Diagnosis, Release, SearchOptions } from "./catalog.js";\n` +
  releases.map((r, i) => `import release${i} from "./releases/${r.id}.js";\n`).join("") +
  `export const catalogs = Object.freeze({\n` +
  releases.map((r, i) => `  "${r.id}": release${i},\n`).join("") + `});\n` +
  `export type ReleaseId = keyof typeof catalogs;\n` +
  `export const releases: readonly Release[] = Object.freeze(manifest);\n` +
  `export const latest = release${releases.length - 1};\n` +
  `export function getCatalogForDate(date: string): Catalog {\n` +
  `  validateDate(date);\n` +
  `  const catalog = Object.values(catalogs).find(({ release }) => date >= release.effectiveFrom && date <= release.effectiveThrough);\n` +
  `  if (!catalog) throw new RangeError(\`No bundled ICD-10-CM release covers \${date}\`);\n` +
  `  return catalog;\n` + `}\n`);
