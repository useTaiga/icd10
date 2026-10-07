import { expect, test } from "bun:test";
import { discoverSources, parseOrderFile, verifyBillableFile } from "../scripts/source.js";

const row = (order: number, code: string, billable: boolean, short: string, long = short) =>
  `${String(order).padStart(5, "0")} ${code.padEnd(7)} ${billable ? "1" : "0"} ${short.padEnd(60)} ${long}`;

test("parses fixed columns, long descriptions, CRLF and a BOM", () => {
  const result = parseOrderFile("\uFEFF" + [row(1, "A00", false, "Cholera"),
    row(2, "A000", true, "Short title", "A complete long title"), row(3, "QA00101", true, "SCN2A-related neurodevelopmental disorder")].join("\r\n") + "\r\n");
  expect(result["A00"]).toEqual(["Cholera", "Cholera", false]);
  expect(result["A00.0"]).toEqual(["Short title", "A complete long title", true]);
  expect(result["QA0.0101"]?.[2]).toBe(true);
});

test("rejects malformed, empty, duplicate and out-of-sequence order files", () => {
  for (const text of ["", "Add: A000", row(1, "A000", true, ""), row(2, "A000", true, "Cholera"),
    row(1, "A000", true, "Cholera") + "\n" + row(2, "A000", true, "Cholera")]) {
    expect(() => parseOrderFile(text)).toThrow();
  }
});

test("cross-checks official billable descriptions and completeness", () => {
  const codes = parseOrderFile(row(1, "A00", false, "Cholera") + "\n" + row(2, "A000", true, "Short", "Long description"));
  expect(() => verifyBillableFile("A000    Long description\r\n", codes)).not.toThrow();
  for (const text of ["", "A000    Wrong description", "A00     Cholera", "A000    Long description\nA000    Long description"]) {
    expect(() => verifyBillableFile(text, codes)).toThrow();
  }
});

const section = (label: string, from: string, through: string, href: string) =>
  `<p>Use these codes for discharges occurring from ${from} – ${through}.</p><ul><li><a href="${href}">${label} Code Descriptions in Tabular Order (ZIP)</a></li></ul>`;

test("discovers releases by official effective periods and splits overlapping annual windows", () => {
  const html = section("2027", "October 1, 2026", "September 30, 2027", "/files/zip/2027.zip") +
    section("April 1, 2026", "April 1, 2026", "September 30, 2026", "/files/zip/april.zip") +
    section("2026", "October 1, 2025", "September 30, 2026", "/files/zip/2026.zip") +
    `<a href="old.zip">2025 Code Descriptions in Tabular Order</a>`;
  const sources = discoverSources(html);
  expect(sources.map((r) => r.id)).toEqual(["2025-10-01", "2026-04-01", "2026-10-01"]);
  expect(sources[0]?.effectiveThrough).toBe("2026-03-31");
  expect(sources[1]?.fiscalYear).toBe(2026);
  expect(sources[2]?.sourceUrl).toBe("https://www.cms.gov/files/zip/2027.zip");
});

test("fails visibly if dates, source hosts or the page layout change", () => {
  for (const html of ["<p>Maintenance</p>", `<a href="/files/zip/2027.zip">2027 Code Descriptions in Tabular Order</a>`,
    section("2027", "October 1, 2026", "September 30, 2027", "https://example.com/a.zip")]) {
    expect(() => discoverSources(html)).toThrow();
  }
});
