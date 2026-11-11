import type { Section } from "./types";

const HEADING_PATTERNS: { re: RegExp; level: number }[] = [
  {
    re: /^(?:kapittel|chapter|del|part|avsnitt)\s+[\dIVXLC]+(?:[.:)\s].*)?$/i,
    level: 1,
  },
  { re: /^\d+(?:\.\d+){0,2}\.?\s+\S.{2,80}$/, level: 2 },
  { re: /^#{1,3}\s+.+$/, level: 1 },
];

function isLikelyHeading(line: string): { title: string; level: number } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return null;

  for (const { re, level } of HEADING_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        title: trimmed.replace(/^#+\s*/, ""),
        level,
      };
    }
  }

  // Short ALL-CAPS / Title-like lines without sentence punctuation
  if (
    trimmed.length <= 80 &&
    !/[.!?]$/.test(trimmed) &&
    /^[A-ZÆØÅ0-9]/.test(trimmed) &&
    trimmed === trimmed.toUpperCase() &&
    /[A-ZÆØÅ]/.test(trimmed)
  ) {
    return { title: trimmed, level: 2 };
  }

  return null;
}

export function detectSections(text: string, fallbackTitle: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentTitle = fallbackTitle;
  let currentLevel = 1;
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (!body && sections.length === 0) return;
    if (!body) return;
    sections.push({
      id: `section-${sectionIndex++}`,
      title: currentTitle,
      level: currentLevel,
      text: body,
    });
    buffer = [];
  };

  for (const line of lines) {
    const heading = isLikelyHeading(line);
    if (heading && buffer.join("").trim().length > 40) {
      flush();
      currentTitle = heading.title;
      currentLevel = heading.level;
      continue;
    }
    if (heading && buffer.join("").trim().length === 0) {
      currentTitle = heading.title;
      currentLevel = heading.level;
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0) {
    sections.push({
      id: "section-0",
      title: fallbackTitle,
      level: 1,
      text: text.trim(),
    });
  }

  return sections;
}

/**
 * Split section text into TTS chunks — one sentence per chunk when possible
 * so playback highlighting can map 1:1 to measured audio durations.
 */
export function chunkSections(
  sections: Section[],
  maxChars = 1500,
): { id: string; text: string; title?: string; sectionId: string }[] {
  const chunks: {
    id: string;
    text: string;
    title?: string;
    sectionId: string;
  }[] = [];
  let counter = 0;

  for (const section of sections) {
    const pieces = splitIntoSentenceChunks(section.text, maxChars);
    pieces.forEach((piece, i) => {
      chunks.push({
        id: `chunk-${counter++}`,
        text: piece,
        title: i === 0 ? section.title : `${section.title} (forts.)`,
        sectionId: section.id,
      });
    });
  }

  return chunks;
}

function splitIntoSentenceChunks(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [
    normalized,
  ];
  const chunks: string[] = [];

  for (const sentence of sentences) {
    const next = sentence.trim();
    if (!next) continue;
    if (next.length <= maxChars) {
      chunks.push(next);
      continue;
    }
    // Hard-split only when a single sentence exceeds the API limit
    for (let i = 0; i < next.length; i += maxChars) {
      chunks.push(next.slice(i, i + maxChars).trim());
    }
  }

  return chunks.filter(Boolean);
}
