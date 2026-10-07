export interface Release {
  readonly id: string;
  readonly fiscalYear: number;
  readonly effectiveFrom: string;
  readonly effectiveThrough: string;
  readonly sourceUrl: string;
  readonly archiveSha256: string;
  readonly orderFile: string;
  readonly orderFileSha256: string;
  readonly entryCount: number;
  readonly billableCount: number;
}

export interface Diagnosis {
  readonly code: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly billable: boolean;
}

export type RawCodes = Readonly<Record<string, readonly [string, string, boolean]>>;

export interface SearchOptions {
  readonly limit?: number;
  readonly billableOnly?: boolean;
}

export interface Catalog {
  readonly release: Release;
  lookup(code: string): Diagnosis | undefined;
  isBillable(code: string): boolean;
  search(query: string, options?: SearchOptions): Diagnosis[];
}

export function normalizeCode(code: string): string | undefined {
  const match = /^([A-Z][A-Z0-9]{2})(?:\.?([A-Z0-9]{1,4}))?$/.exec(code.trim().toUpperCase());
  return match ? match[1] + (match[2] ? `.${match[2]}` : "") : undefined;
}

export function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new RangeError("Expected a valid date in YYYY-MM-DD format");
  }
}

export function createCatalog(release: Release, codes: RawCodes): Catalog {
  const lookup = (input: string): Diagnosis | undefined => {
    const code = normalizeCode(input);
    const row = code ? codes[code] : undefined;
    return code && row ? { code, shortDescription: row[0], description: row[1], billable: row[2] } : undefined;
  };
  return Object.freeze({
    release: Object.freeze(release),
    lookup,
    isBillable: (code: string) => lookup(code)?.billable === true,
    search(query: string, { limit = 20, billableOnly = true }: SearchOptions = {}): Diagnosis[] {
      if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
      const text = query.trim().toLowerCase();
      if (!text) return [];
      const codeQuery = text.replaceAll(".", "");
      const results: { code: string; rank: number }[] = [];
      for (const [code, row] of Object.entries(codes)) {
        if (billableOnly && !row[2]) continue;
        const normalized = code.replaceAll(".", "").toLowerCase();
        const rank = normalized === codeQuery ? 0 : normalized.startsWith(codeQuery) ? 1 :
          row[1].toLowerCase().includes(text) || row[0].toLowerCase().includes(text) ? 2 : -1;
        if (rank >= 0) results.push({ code, rank });
      }
      return results.sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code))
        .slice(0, limit).map(({ code }) => lookup(code)!);
    },
  });
}
