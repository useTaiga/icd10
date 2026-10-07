import assert from "node:assert/strict";
import { catalogs, getCatalogForDate, latest } from "@usetaiga/icd10cm";
import { catalog } from "@usetaiga/icd10cm/releases/2026-10-01";
import raw from "@usetaiga/icd10cm/data/2026-10-01" with { type: "json" };
import manifest from "@usetaiga/icd10cm/data/releases" with { type: "json" };

assert.equal(latest.lookup("B35.1").description, "Tinea unguium");
assert.equal(catalog.lookup("M2042").description, "Other hammer toe(s) (acquired), left foot");
assert.equal(getCatalogForDate("2026-09-30").release.id, "2026-04-01");
assert.equal(getCatalogForDate("2026-10-01").isBillable("D69.1"), false);
assert.equal(raw["B35.1"][2], true);
assert.equal(manifest.length, Object.keys(catalogs).length);
assert.throws(() => getCatalogForDate("2026-02-30"), RangeError);
console.log(`Node artifact smoke test passed: ${latest.release.billableCount} FY${latest.release.fiscalYear} billable codes`);
