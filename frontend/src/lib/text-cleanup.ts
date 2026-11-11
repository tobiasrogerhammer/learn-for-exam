/** Remove repeated headers/footers and page numbers from extracted text. */

const PAGE_NUMBER_RE =
  /^(?:side|page|s\.?)\s*\d+(?:\s*(?:av|of|\/)\s*\d+)?$|^\d{1,4}$/i;

const FORM_FEED = "\f";

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

function lineKey(line: string): string {
  return line.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Heuristic cleanup: drop short lines that repeat across many pages,
 * and strip standalone page numbers.
 */
export function cleanExtractedText(text: string): string {
  const pages = text.includes(FORM_FEED)
    ? text.split(FORM_FEED)
    : text.split(/\n{2,}(?=\S)/);

  const shortLineCounts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const raw of page.split("\n")) {
      const line = raw.trim();
      if (!line || line.length > 80) continue;
      const key = lineKey(line);
      if (seen.has(key)) continue;
      seen.add(key);
      shortLineCounts.set(key, (shortLineCounts.get(key) ?? 0) + 1);
    }
  }

  const pageCount = Math.max(pages.length, 1);
  const repeatThreshold = Math.max(3, Math.floor(pageCount * 0.4));
  const repeated = new Set(
    [...shortLineCounts.entries()]
      .filter(([, count]) => count >= repeatThreshold)
      .map(([key]) => key),
  );

  const cleanedPages = pages.map((page) => {
    const lines = page.split("\n").filter((raw) => {
      const line = raw.trim();
      if (!line) return true;
      if (PAGE_NUMBER_RE.test(line)) return false;
      if (repeated.has(lineKey(line))) return false;
      return true;
    });
    return lines.join("\n");
  });

  return normalizeWhitespace(cleanedPages.join("\n\n"));
}
