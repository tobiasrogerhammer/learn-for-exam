import { api } from "../../convex/_generated/api";
import { convex } from "./convex";
import { content, signedIn } from "./storage";

export type PracticeModeId = "flashcards" | "quiz" | "recall" | "typing" | "match" | "kahoot";

type PracticeEvent = {
  subjectKey: string;
  documentKey: string;
  topic: string;
  mode: PracticeModeId;
  score: number;
  at: number;
};

const queue: PracticeEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Notes one answer so progress can be followed per subject and topic.
 * Item ids start with the document id ("<doc>:fc:3"), which tells us where it belongs.
 * Only signed-in users are tracked; answers are sent in small batches.
 */
export function recordAnswer(
  itemId: string,
  topic: string,
  mode: PracticeModeId,
  score: number,
): void {
  if (!signedIn() || !convex) return;
  const documentKey = itemId.split(":")[0];
  const subjectKey = content.studySets[documentKey]?.subjectId;
  if (!subjectKey) return;
  queue.push({
    subjectKey,
    documentKey,
    topic: topic.trim() || "Uten tema",
    mode,
    score: Math.min(1, Math.max(0, score)),
    at: Date.now(),
  });
  timer ??= setTimeout(flush, 2000);
}

async function flush() {
  timer = null;
  const events = queue.splice(0, 100);
  if (events.length === 0) return;
  try {
    await convex!.mutation(api.practice.record, { events });
  } catch (err) {
    console.warn("Kunne ikke lagre øvingssvar", err);
  }
  if (queue.length) timer = setTimeout(flush, 500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void flush());
}

/** Shares of right answers grouped by a key, e.g. per topic */
export function accuracy<T extends { score: number }>(events: T[]): number {
  return events.length ? events.reduce((sum, e) => sum + e.score, 0) / events.length : 0;
}
