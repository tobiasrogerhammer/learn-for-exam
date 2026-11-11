import type {
  CardReview,
  Flashcard,
  QuizQuestion,
  RecallPrompt,
  ReviewGrade,
  StudySet,
} from "./types";
import { api } from "../../convex/_generated/api";
import { convex } from "./convex";
import { content, readKey, save, writeKey } from "./storage";

const REVIEWS_KEY = "learn-for-exam:card-reviews:v1";

const read = readKey;
const write = writeKey;

// --- Study sets (one per document) ---

function readSets(): Record<string, StudySet> {
  return content.studySets;
}

export function getStudySet(documentId: string): StudySet | undefined {
  return readSets()[documentId];
}

export function listStudySets(subjectId: string): StudySet[] {
  return Object.values(readSets()).filter((s) => s.subjectId === subjectId);
}

export function saveStudySet(set: StudySet): void {
  content.studySets = { ...readSets(), [set.documentId]: set };
  save(() =>
    convex!.mutation(api.content.saveStudySet, {
      documentKey: set.documentId,
      subjectKey: set.subjectId,
      data: set,
    }),
  );
}

/**
 * Drops the sets and your review history for them. Convex deletes the sets
 * itself together with their document, and saveStudySet replaces an old set.
 */
export function deleteStudySets(documentIds: string[]): void {
  const sets = { ...readSets() };
  const reviews = { ...readReviews() };
  for (const id of documentIds) {
    const set = sets[id];
    set?.flashcards.forEach((c) => delete reviews[c.id]);
    delete sets[id];
  }
  content.studySets = sets;
  write(REVIEWS_KEY, reviews);
}

// --- Converting API / imported JSON into a StudySet ---

type RawStudySet = {
  summary?: unknown;
  model?: unknown;
  flashcards?: unknown;
  quiz?: unknown;
  recall?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];

/**
 * Accepts both the backend shape (snake_case) and camelCase, so JSON written
 * by hand or by Claude Code outside the app can be imported too.
 */
export function toStudySet(
  raw: RawStudySet,
  meta: Pick<StudySet, "documentId" | "subjectId" | "documentTitle" | "source">,
): StudySet {
  const prefix = meta.documentId;
  const flashcards: Flashcard[] = arr(raw.flashcards)
    .map((c, i) => ({
      id: `${prefix}:fc:${i}`,
      front: str(c.front),
      back: str(c.back),
      section: str(c.section),
    }))
    .filter((c) => c.front && c.back);

  const quiz: QuizQuestion[] = arr(raw.quiz)
    .map((q, i) => {
      const options = Array.isArray(q.options) ? q.options.map(str) : [];
      const answerIndex = Number(q.answer_index ?? q.answerIndex);
      return {
        id: `${prefix}:quiz:${i}`,
        question: str(q.question),
        options,
        answerIndex,
        explanation: str(q.explanation),
        section: str(q.section),
      };
    })
    .filter(
      (q) =>
        q.question &&
        q.options.length >= 2 &&
        Number.isInteger(q.answerIndex) &&
        q.answerIndex >= 0 &&
        q.answerIndex < q.options.length,
    );

  const recall: RecallPrompt[] = arr(raw.recall)
    .map((r, i) => {
      const points = r.key_points ?? r.keyPoints;
      return {
        id: `${prefix}:recall:${i}`,
        prompt: str(r.prompt),
        keyPoints: Array.isArray(points) ? points.map(str).filter(Boolean) : [],
        section: str(r.section),
      };
    })
    .filter((r) => r.prompt);

  return {
    ...meta,
    generatedAt: new Date().toISOString(),
    model: typeof raw.model === "string" ? raw.model : null,
    summary: str(raw.summary),
    flashcards,
    quiz,
    recall,
  };
}

export function parseStudySetJson(
  json: string,
  meta: Pick<StudySet, "documentId" | "subjectId" | "documentTitle">,
): StudySet {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Filen er ikke gyldig JSON");
  }
  if (!raw || typeof raw !== "object") throw new Error("Fant ikke øvingsmateriale i filen");
  const set = toStudySet(raw as RawStudySet, { ...meta, source: "import" });
  if (!set.flashcards.length && !set.quiz.length && !set.recall.length) {
    throw new Error("Filen har ingen flashcards, quiz eller gjenkallingsspørsmål");
  }
  return set;
}

export function exportStudySetJson(set: StudySet): string {
  return JSON.stringify(
    {
      summary: set.summary,
      flashcards: set.flashcards.map(({ front, back, section }) => ({ front, back, section })),
      quiz: set.quiz.map(({ question, options, answerIndex, explanation, section }) => ({
        question,
        options,
        answer_index: answerIndex,
        explanation,
        section,
      })),
      recall: set.recall.map(({ prompt, keyPoints, section }) => ({
        prompt,
        key_points: keyPoints,
        section,
      })),
    },
    null,
    2,
  );
}

// --- Spaced repetition ---

function readReviews(): Record<string, CardReview> {
  return read<Record<string, CardReview>>(REVIEWS_KEY, {});
}

export function getReviews(): Record<string, CardReview> {
  return readReviews();
}

export function isDue(review: CardReview | undefined, now = new Date()): boolean {
  return !review || new Date(review.due) <= now;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** SM-2-like scheduling. "again" brings the card back in 10 minutes. */
export function scheduleReview(
  cardId: string,
  grade: ReviewGrade,
  previous?: CardReview,
  now = new Date(),
): CardReview {
  const prev: CardReview = previous ?? {
    cardId,
    due: now.toISOString(),
    intervalDays: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
  };

  if (grade === "again") {
    return {
      ...prev,
      due: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
      intervalDays: 0,
      ease: Math.max(1.3, prev.ease - 0.2),
      reps: 0,
      lapses: prev.lapses + 1,
    };
  }

  const easeDelta = grade === "hard" ? -0.15 : grade === "easy" ? 0.15 : 0;
  const ease = Math.max(1.3, prev.ease + easeDelta);
  let interval: number;
  if (prev.reps === 0) interval = grade === "easy" ? 3 : 1;
  else if (prev.reps === 1) interval = grade === "hard" ? 2 : grade === "easy" ? 6 : 4;
  else {
    const factor = grade === "hard" ? 1.2 : grade === "easy" ? ease * 1.3 : ease;
    interval = Math.max(prev.intervalDays + 1, Math.round(prev.intervalDays * factor));
  }

  return {
    cardId,
    due: new Date(now.getTime() + interval * DAY_MS).toISOString(),
    intervalDays: interval,
    ease,
    reps: prev.reps + 1,
    lapses: prev.lapses,
  };
}

export function saveReview(review: CardReview): void {
  write(REVIEWS_KEY, { ...readReviews(), [review.cardId]: review });
}

export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- Active recall scores ---

const RECALL_KEY = "learn-for-exam:recall-scores:v1";

export type RecallScore = { covered: number; total: number; at: string };

export function getRecallScores(): Record<string, RecallScore> {
  return read<Record<string, RecallScore>>(RECALL_KEY, {});
}

export function saveRecallScore(promptId: string, score: RecallScore): void {
  write(RECALL_KEY, { ...getRecallScores(), [promptId]: score });
}
