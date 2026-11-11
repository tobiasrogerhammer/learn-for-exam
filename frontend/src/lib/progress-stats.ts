import type { LibraryItem, StudySet, Subject } from "./types";

export type PracticeEvent = {
  subjectKey: string;
  documentKey: string;
  topic: string;
  mode: string;
  score: number;
  at: number;
};

export type Confidence = { documentKey: string; topic: string; level: number };

export const CONFIDENCE_LEVELS = [
  { level: 1, label: "Usikker" },
  { level: 2, label: "Litt trygg" },
  { level: 3, label: "Trygg" },
] as const;

const DAY = 24 * 60 * 60 * 1000;
/** How many of the latest answers count as your current level on a topic */
const RECENT = 10;

export function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export type TopicStat = {
  topic: string;
  /** Questions about the topic in the study set */
  items: number;
  answers: number;
  /** Share right among your latest answers, 0–1, or null if not practised */
  current: number | null;
  /** Change from your earlier to your latest answers, in share points */
  change: number | null;
  lastAt: number | null;
  confidence: number | null;
};

export type DocumentStat = {
  document: LibraryItem;
  topics: TopicStat[];
  answers: number;
  current: number | null;
};

export type SubjectStat = {
  subject: Subject;
  documents: DocumentStat[];
  answers: number;
  current: number | null;
  /** Share right per week, oldest first, for the last weeks */
  weeks: { start: number; share: number | null; answers: number }[];
  confident: number;
  topicCount: number;
};

function topicStat(
  topic: string,
  items: number,
  events: PracticeEvent[],
  confidence: number | null,
): TopicStat {
  // events arrive newest first
  const recent = events.slice(0, RECENT).map((e) => e.score);
  const half = Math.floor(Math.min(events.length, RECENT * 2) / 2);
  const change =
    half >= 3
      ? (mean(events.slice(0, half).map((e) => e.score)) ?? 0) -
        (mean(events.slice(half, half * 2).map((e) => e.score)) ?? 0)
      : null;
  return {
    topic,
    items,
    answers: events.length,
    current: mean(recent),
    change,
    lastAt: events[0]?.at ?? null,
    confidence,
  };
}

function weekly(events: PracticeEvent[], now: number, weeks = 8) {
  const start = now - weeks * 7 * DAY;
  return Array.from({ length: weeks }, (_, i) => {
    const from = start + i * 7 * DAY;
    const inWeek = events.filter((e) => e.at >= from && e.at < from + 7 * DAY);
    return { start: from, share: mean(inWeek.map((e) => e.score)), answers: inWeek.length };
  });
}

/** Everything the progress page shows, per subject, document and topic */
export function buildStats(
  subjects: Subject[],
  documents: LibraryItem[],
  studySets: Record<string, StudySet>,
  events: PracticeEvent[],
  confidence: Confidence[],
  now: number,
): SubjectStat[] {
  const confidenceOf = new Map(confidence.map((c) => [`${c.documentKey}\u0000${c.topic}`, c.level]));
  const eventsOf = new Map<string, PracticeEvent[]>();
  for (const e of events) {
    const key = `${e.documentKey}\u0000${e.topic}`;
    eventsOf.set(key, [...(eventsOf.get(key) ?? []), e]);
  }

  return subjects
    .map((subject) => {
      const docs = documents
        .filter((d) => d.subjectId === subject.id && studySets[d.id])
        .sort((a, b) => a.title.localeCompare(b.title, "nb", { numeric: true }))
        .map((document) => {
          const set = studySets[document.id];
          const counts = new Map<string, number>();
          for (const item of [...set.flashcards, ...set.quiz, ...set.recall]) {
            const t = item.section.trim() || "Uten tema";
            counts.set(t, (counts.get(t) ?? 0) + 1);
          }
          const topics = [...counts].map(([topic, items]) => {
            const key = `${document.id}\u0000${topic}`;
            return topicStat(topic, items, eventsOf.get(key) ?? [], confidenceOf.get(key) ?? null);
          });
          const docEvents = events.filter((e) => e.documentKey === document.id);
          return {
            document,
            topics,
            answers: docEvents.length,
            current: mean(docEvents.slice(0, RECENT * 3).map((e) => e.score)),
          };
        });
      const subjectEvents = events.filter((e) => e.subjectKey === subject.id);
      const topics = docs.flatMap((d) => d.topics);
      return {
        subject,
        documents: docs,
        answers: subjectEvents.length,
        current: mean(subjectEvents.slice(0, RECENT * 5).map((e) => e.score)),
        weeks: weekly(subjectEvents, now),
        confident: topics.filter((t) => t.confidence === 3).length,
        topicCount: topics.length,
      };
    })
    .filter((s) => s.documents.length > 0);
}

/** Headline numbers across everything */
export function summary(events: PracticeEvent[], now: number) {
  const lastWeek = events.filter((e) => e.at >= now - 7 * DAY);
  const weekBefore = events.filter((e) => e.at >= now - 14 * DAY && e.at < now - 7 * DAY);
  const days = new Set(
    events.filter((e) => e.at >= now - 30 * DAY).map((e) => new Date(e.at).toDateString()),
  );
  const thisWeek = mean(lastWeek.map((e) => e.score));
  const before = mean(weekBefore.map((e) => e.score));
  return {
    answers: events.length,
    lastWeekAnswers: lastWeek.length,
    thisWeek,
    change: thisWeek !== null && before !== null ? thisWeek - before : null,
    activeDays: days.size,
  };
}

export function percent(share: number | null): string {
  return share === null ? "–" : `${Math.round(share * 100)} %`;
}
