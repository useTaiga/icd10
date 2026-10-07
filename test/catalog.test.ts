import { describe, expect, test } from "bun:test";
import { catalogs, getCatalogForDate, latest, normalizeCode } from "../src/index.js";

describe("offline catalog", () => {
  test("looks up the original claim-page examples and normalizes input", () => {
    expect(latest.lookup(" B351 ")).toEqual({ code: "B35.1", shortDescription: "Tinea unguium", description: "Tinea unguium", billable: true });
    expect(latest.lookup("m20.42")?.description).toBe("Other hammer toe(s) (acquired), left foot");
    expect(normalizeCode("S52501A")).toBe("S52.501A");
    expect(latest.lookup("ZZZ999")).toBeUndefined();
    for (const value of ["B3.51", "B35..1", "B35.1!", "", "B35 1"]) expect(latest.lookup(value)).toBeUndefined();
  });

  test("supports the QA genetic-disorder codes and category headers", () => {
    expect(latest.lookup("QA00101")?.description).toBe("SCN2A-related neurodevelopmental disorder");
    expect(latest.isBillable("QA00101")).toBe(true);
    expect(latest.lookup("QA0")?.billable).toBe(false);
    expect(latest.isBillable("A00")).toBe(false);
    expect(latest.isBillable("madeup")).toBe(false);
  });

  test("ranks exact codes ahead of prefixes and searches descriptions", () => {
    expect(latest.search("B351")[0]?.code).toBe("B35.1");
    expect(latest.search("cholera").every((row) => row.billable)).toBe(true);
    expect(latest.search("A00", { billableOnly: false })[0]?.code).toBe("A00");
    expect(latest.search("hammer toe", { limit: 2 })).toHaveLength(2);
    expect(latest.search(" ")).toEqual([]);
    for (const limit of [0, -1, 1.5, NaN, Infinity]) expect(() => latest.search("a", { limit })).toThrow(RangeError);
  });

  test("selects the appropriate release at both annual and April boundaries", () => {
    for (const [date, id] of [
      ["2025-10-01", "2025-10-01"], ["2026-03-31", "2025-10-01"],
      ["2026-04-01", "2026-04-01"], ["2026-09-30", "2026-04-01"],
      ["2026-10-01", "2026-10-01"], ["2027-09-30", "2026-10-01"],
    ] as const) expect(getCatalogForDate(date).release.id).toBe(id);
    for (const date of ["2025-09-30", "2027-10-01", "2026-02-30", "2026-2-1", "2026-01-01T00:00:00Z", "2026-99-99"]) {
      expect(() => getCatalogForDate(date)).toThrow(RangeError);
    }
  });

  test("preserves codes whose billability changed in FY2027", () => {
    const before = getCatalogForDate("2026-09-30");
    const after = getCatalogForDate("2026-10-01");
    expect(before.isBillable("D69.1")).toBe(true);
    expect(after.isBillable("D69.1")).toBe(false);
    expect(before.lookup("C78.31")).toBeUndefined();
    expect(after.isBillable("C78.31")).toBe(true);
    expect(catalogs["2026-04-01"].release.fiscalYear).toBe(2026);
  });
});
