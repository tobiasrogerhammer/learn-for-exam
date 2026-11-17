/**
 * The fixed way through a lesson: for each chapter you read or listen and mark
 * what matters, then the chapter is hidden and you write notes from your
 * markings alone. After the last chapter you sum up the whole lesson, and only
 * then do the practice methods open.
 */

import { frontMatterCount } from "../../convex/lib/frontMatter";
import { readKey, writeKey } from "./storage";
import type { DocumentMeta, LibraryItem, Section } from "./types";

export type Chapter = {
  id: string;
  title: string;
  body: string;
  /** Title page, summary and contents shown before the first chapter's text */
  preface?: string;
};

/**
 * The cleaned-up reading text is Markdown: "## " starts a chapter, "### " a
 * subheading, and tables use the usual pipe syntax.
 */
export function toChapters(source: string) {
  // Footnote definitions sit at the end, but each chapter is rendered on its own,
  // so every chapter gets the definitions it refers to
  const notes = new Map<string, string>();
  const markdown = source.replace(/^\[\^([^\]]+)\]:.*$/gm, (line, id: string) => {
    notes.set(id, line);
    return "";
  });
  const withNotes = (body: string) => {
    const used = [...new Set([...body.matchAll(/\[\^([^\]]+)\](?!:)/g)].map((m) => m[1]))];
    const defs = used.map((id) => notes.get(id)).filter(Boolean);
    return defs.length ? `${body}\n\n${defs.join("\n\n")}` : body;
  };
  const parts = markdown.split(/^## +/m);
  const intro = parts[0].replace(/^# .*$/m, "").trim();
  const chapters = parts.slice(1).map((part, i) => {
    const newline = part.indexOf("\n");
    return {
      id: `kapittel-${i}`,
      title: (newline < 0 ? part : part.slice(0, newline)).trim(),
      body: withNotes(newline < 0 ? "" : part.slice(newline + 1).trim()),
    };
  });
  return { intro: withNotes(intro), chapters };
}

/**
 * The chapters you go through, the same ones Pensum counts. Text before the
 * first chapter belongs to the first one.
 */
/** How many sections at the start are folded into the first chapter's preface */
export function lessonFrontMatter(item: LibraryItem): number {
  return item.reading?.markdown ? 0 : frontMatterCount(item.document.sections);
}

export function lessonChapters(item: LibraryItem): Chapter[] {
  const markdown = item.reading?.markdown;
  if (markdown) {
    const { intro, chapters } = toChapters(markdown);
    if (chapters.length === 0) return intro ? [{ id: "kapittel-0", title: item.title, body: intro }] : [];
    if (intro) chapters[0] = { ...chapters[0], body: `${intro}\n\n${chapters[0].body}` };
    return chapters;
  }
  // Title page, summary and contents become a preface to the first real chapter
  const sections = item.document.sections;
  const front = frontMatterCount(sections);
  const preface = sections
    .slice(0, front)
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n\n");
  return sections.slice(front).map((s, i) => ({
    id: s.id,
    title: s.title,
    ...(i === 0 && preface ? { preface } : {}),
    // Plain text keeps its line breaks as paragraphs
    body: s.text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n\n"),
  }));
}

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 5),
  );
}

/** Short word stems, so "kostnaden" and "kostnadene" count as the same word */
export function wordStems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4)
      .map((w) => w.slice(0, 6)),
  );
}

/**
 * Pairs each source text with the target text it shares most words with,
 * keeping the order: the targets picked never go backwards. Returns the target
 * index for each source.
 */
export function alignInOrder(
  sources: string[],
  targets: string[],
  tokens: (text: string) => Set<string> = contentWords,
): number[] {
  const n = sources.length;
  const m = targets.length;
  if (n === 0 || m === 0) return sources.map(() => 0);
  const targetWords = targets.map(tokens);
  const score = sources.map((text) => {
    const words = tokens(text);
    return targetWords.map((tw) => {
      if (words.size === 0) return 0;
      let shared = 0;
      for (const w of words) if (tw.has(w)) shared++;
      return shared / Math.sqrt(words.size * Math.max(tw.size, 1));
    });
  });

  // best[i][j]: best total for the first i+1 sources with source i on target j
  const best = score.map(() => new Array<number>(m).fill(-Infinity));
  const from = score.map(() => new Array<number>(m).fill(0));
  for (let j = 0; j < m; j++) best[0][j] = score[0][j];
  for (let i = 1; i < n; i++) {
    let runMax = -Infinity;
    let runArg = 0;
    for (let j = 0; j < m; j++) {
      if (best[i - 1][j] > runMax) {
        runMax = best[i - 1][j];
        runArg = j;
      }
      best[i][j] = runMax + score[i][j];
      from[i][j] = runArg;
    }
  }
  const out = new Array<number>(n);
  let j = best[n - 1].indexOf(Math.max(...best[n - 1]));
  for (let i = n - 1; i >= 0; i--) {
    out[i] = j;
    j = from[i][j];
  }
  return out;
}

/**
 * The audiobook is written for listening, so its sections don't line up with
 * the reading chapters. Each audio section goes to the chapter whose words it
 * shares most, keeping the order, so a chapter gets a run of audio sections.
 * Returns the audio section ids for each chapter.
 */
export function alignAudio(chapters: Chapter[], sections: Section[]): string[][] {
  const out: string[][] = chapters.map(() => []);
  if (chapters.length === 0 || sections.length === 0) return out;
  const picks = alignInOrder(
    sections.map((s) => `${s.title} ${s.text}`),
    chapters.map((c) => `${c.title} ${c.body}`),
  );
  picks.forEach((chapter, i) => out[chapter].push(sections[i].id));
  return out;
}

export type Highlight = {
  /** Character offsets in the chapter's rendered text */
  start: number;
  end: number;
  text: string;
};

export type LessonProgress = {
  /** Chapters you have read to the end, so the text is hidden */
  read: number[];
  /** Chapters you have written notes for */
  done: number[];
  highlights: Record<number, Highlight[]>;
  notes: Record<number, string>;
  summary: string;
  summaryDone: boolean;
  /**
   * 2 once chapter numbers count from the first real chapter. Progress saved
   * before that counted title page, summary and contents as chapters too.
   */
  layout?: number;
};

const EMPTY: LessonProgress = {
  read: [],
  done: [],
  highlights: {},
  notes: {},
  summary: "",
  summaryDone: false,
  layout: 2,
};

const key = (documentId: string) => `learn-for-exam:lesson-flow:${documentId}`;

/**
 * Your progress in a lesson. Pass how many sections were folded into the
 * preface, so progress saved before that moves to the right chapters.
 */
export function getLessonProgress(documentId: string, frontMatter = 0): LessonProgress {
  const stored = readKey<Partial<LessonProgress>>(key(documentId), {});
  const progress = { ...EMPTY, ...stored };
  if (stored.layout === 2 || frontMatter === 0) return { ...progress, layout: 2 };
  const move = (i: number) => i - frontMatter;
  const keep = (i: number) => move(i) >= 0;
  const notes: Record<number, string> = {};
  for (const [i, text] of Object.entries(progress.notes)) {
    // Notes on a folded-in section join the first chapter's notes
    const to = Math.max(0, move(Number(i)));
    notes[to] = [notes[to], text].filter(Boolean).join("\n\n");
  }
  return {
    ...progress,
    read: progress.read.filter(keep).map(move),
    done: progress.done.filter(keep).map(move),
    highlights: Object.fromEntries(
      Object.entries(progress.highlights)
        .filter(([i]) => keep(Number(i)))
        .map(([i, list]) => [move(Number(i)), list]),
    ),
    notes,
    layout: 2,
  };
}

export function saveLessonProgress(documentId: string, progress: LessonProgress): void {
  writeKey(key(documentId), progress);
}

export function resetLessonProgress(documentId: string): LessonProgress {
  writeKey(key(documentId), EMPTY);
  return EMPTY;
}

const WORD = /[\p{L}\p{N}]/u;

/** Adds a marking, widened to whole words and joined with any it overlaps or touches */
export function addHighlight(list: Highlight[], next: Highlight, fullText: string): Highlight[] {
  let start = next.start;
  let end = next.end;
  while (start > 0 && WORD.test(fullText[start - 1]) && WORD.test(fullText[start])) start--;
  while (end < fullText.length && WORD.test(fullText[end - 1]) && WORD.test(fullText[end])) end++;
  const rest: Highlight[] = [];
  for (const h of list) {
    if (h.end >= start && h.start <= end) {
      start = Math.min(start, h.start);
      end = Math.max(end, h.end);
    } else {
      rest.push(h);
    }
  }
  return [...rest, { start, end, text: fullText.slice(start, end).trim() }].sort(
    (a, b) => a.start - b.start,
  );
}

/**
 * How far you are through the lessons: chapters you have written notes for,
 * and lessons you have summed up. Only the subjects you picked count, when you
 * have picked any.
 */
export function lessonFlowTotals(lessons: DocumentMeta[]) {
  let chaptersDone = 0;
  let chaptersTotal = 0;
  let lessonsDone = 0;
  let lessonsStarted = 0;
  for (const lesson of lessons) {
    const total = lesson.chapterCount;
    const progress = getLessonProgress(lesson.id);
    chaptersTotal += total;
    chaptersDone += progress.done.filter((i) => i < total).length;
    if (progress.summaryDone) lessonsDone++;
    else if (progress.done.length || progress.read.length) lessonsStarted++;
  }
  return { chaptersDone, chaptersTotal, lessonsDone, lessonsStarted, lessonsTotal: lessons.length };
}
