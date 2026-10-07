import { load } from "cheerio";
import { normalizeCode, type RawCodes } from "../src/catalog.js";

export const SOURCE_PAGE = "https://www.cms.gov/medicare/coding-billing/icd-10-codes";
export const FIRST_FISCAL_YEAR = 2026;

export interface Source {
  id: string;
  fiscalYear: number;
  effectiveFrom: string;
  effectiveThrough: string;
  sourceUrl: string;
}

export function discoverSources(html: string): Source[] {
  const $ = load(html);
  const sources: Source[] = [];
  $("a[href]").each((_, link) => {
    const label = $(link).text().replace(/\s+/g, " ");
    if (!/Code Descriptions in Tabular Order/i.test(label)) return;
    const labelYear = label.match(/\b(\d{4})\b/);
    if (labelYear && Number(labelYear[1]) < FIRST_FISCAL_YEAR) return;
    const paragraph = $(link).closest("ul").prevAll("p").toArray()
      .map((p) => $(p).text()).find((text) => /Use these codes/i.test(text));
    const date = paragraph?.match(/from\s+(October|April)\s+1,\s*(\d{4})\s*[–-]\s*(September|March)\s*(30|31),\s*(\d{4})/i);
    if (!date) throw new Error(`Missing effective date for ${label}`);
    const year = Number(date[2]);
    const october = date[1]!.toLowerCase() === "october";
    const fiscalYear = year + (october ? 1 : 0);
    if (fiscalYear < FIRST_FISCAL_YEAR) return;
    const id = `${year}-${october ? "10" : "04"}-01`;
    const effectiveThrough = `${date[5]}-${date[3]!.toLowerCase() === "september" ? "09" : "03"}-${date[4]}`;
    const sourceUrl = new URL($(link).attr("href")!, SOURCE_PAGE).href;
    if (new URL(sourceUrl).hostname !== "www.cms.gov" || !sourceUrl.endsWith(".zip")) {
      throw new Error(`Unexpected source: ${sourceUrl}`);
    }
    if (Number(date[5]) !== fiscalYear || effectiveThrough <= id) throw new Error(`Unexpected effective period for ${label}`);
    sources.push({ id, fiscalYear, effectiveFrom: id, effectiveThrough, sourceUrl });
  });
  if (!sources.length) throw new Error("No supported ICD-10-CM releases found; check CMS page layout");
  if (new Set(sources.map((s) => s.id)).size !== sources.length) throw new Error("Duplicate CMS release dates");
  sources.sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < sources.length - 1; i++) {
    const current = sources[i]!;
    const next = sources[i + 1]!;
    if (next.effectiveFrom <= current.effectiveThrough) {
      const end = new Date(`${next.effectiveFrom}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() - 1);
      current.effectiveThrough = end.toISOString().slice(0, 10);
    }
  }
  return sources;
}

export function parseOrderFile(text: string): RawCodes {
  const codes: Record<string, [string, string, boolean]> = {};
  let expectedOrder = 1;
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const raw = line.slice(6, 13).trim();
    const code = normalizeCode(raw);
    const shortDescription = line.slice(16, 76).trimEnd();
    const description = line.slice(77).trimEnd();
    if (!/^\d{5} [A-Z0-9 ]{7} [01] /.test(line) || Number(line.slice(0, 5)) !== expectedOrder++ ||
        !code || code.replaceAll(".", "") !== raw || !shortDescription || !description) {
      throw new Error(`Malformed order-file row: ${line.slice(0, 80)}`);
    }
    if (codes[code]) throw new Error(`Duplicate code: ${code}`);
    codes[code] = [shortDescription, description, line[14] === "1"];
  }
  if (!Object.keys(codes).length) throw new Error("Empty order file");
  return codes;
}

export function verifyBillableFile(text: string, codes: RawCodes): void {
  const seen = new Set<string>();
  for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const code = normalizeCode(line.slice(0, 7).trim());
    const description = line.slice(8).trimEnd();
    if (!code || seen.has(code) || !codes[code]?.[2] || codes[code]?.[1] !== description) {
      throw new Error(`Billable codes file disagrees with order file: ${line.slice(0, 80)}`);
    }
    seen.add(code);
  }
  if (seen.size !== Object.values(codes).filter((row) => row[2]).length) {
    throw new Error("Billable codes file is incomplete");
  }
}
