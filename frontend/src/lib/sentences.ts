import type { Section, TextChunk } from "./types";

export type TimedSentence = {
  index: number;
  text: string;
  sectionId: string;
  /** Absolute start time in seconds */
  startSec: number;
  /** Absolute end time in seconds */
  endSec: number;
};

export type TimedChunkInput = {
  id: string;
  text: string;
  sectionId?: string;
  /** Measured WAV duration for this TTS chunk; falls back to char weight */
  durationSec?: number | null;
};

const SENTENCE_RE = /[^.!?…]+(?:[.!?…]+|$)/g;

/**
 * Build a playback timeline from the same TTS chunks that were synthesized.
 * Uses measured per-chunk WAV durations when available so highlighting
 * tracks real speech tempo instead of uniform character estimates.
 */
export function buildTimedSentencesFromChunks(
  chunks: TimedChunkInput[],
  totalAudioDuration?: number,
): TimedSentence[] {
  const usable = chunks.filter((c) => c.text.trim().length > 0);
  if (usable.length === 0) return [];

  const measured = usable.map((c) =>
    typeof c.durationSec === "number" && c.durationSec > 0
      ? c.durationSec
      : null,
  );
  const allMeasured = measured.every((d) => d !== null);
  const measuredSum = measured.reduce<number>((sum, d) => sum + (d ?? 0), 0);

  // Fallback weights when a chunk has no duration yet
  const weights = usable.map((c) => Math.max(c.text.length, 12));
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  // Prefer summing measured chunk lengths; otherwise scale to player duration
  const timelineDuration =
    allMeasured && measuredSum > 0
      ? measuredSum
      : totalAudioDuration && totalAudioDuration > 0
        ? totalAudioDuration
        : measuredSum > 0
          ? measuredSum
          : 1;

  const sentences: TimedSentence[] = [];
  let cursor = 0;
  const unknownWeightTotal = usable.reduce((sum, _c, i) => {
    if (measured[i] === null) return sum + weights[i];
    return sum;
  }, 0);
  const measuredKnown = usable.reduce(
    (sum, _c, i) => sum + (measured[i] ?? 0),
    0,
  );
  const remainingForUnknown = Math.max(timelineDuration - measuredKnown, 0);

  usable.forEach((chunk, chunkIndex) => {
    const chunkDuration =
      measured[chunkIndex] !== null
        ? (measured[chunkIndex] as number)
        : unknownWeightTotal > 0
          ? (weights[chunkIndex] / unknownWeightTotal) * remainingForUnknown
          : (weights[chunkIndex] / weightSum) * timelineDuration;

    // With sentence-per-chunk TTS, parts is usually a single sentence
    const parts = splitSentences(chunk.text);
    const partWeights = parts.map((p) => Math.max(p.length, 8));
    const partWeightSum = partWeights.reduce((a, b) => a + b, 0) || 1;

    parts.forEach((text, partIndex) => {
      const share = partWeights[partIndex] / partWeightSum;
      const dur = chunkDuration * share;
      const startSec = cursor;
      const endSec = cursor + dur;
      cursor = endSec;
      sentences.push({
        index: sentences.length,
        text,
        sectionId: chunk.sectionId ?? "",
        startSec,
        endSec,
      });
    });
  });

  // Normalize tiny float drift to exact total when we know player duration
  if (
    totalAudioDuration &&
    totalAudioDuration > 0 &&
    sentences.length > 0 &&
    Math.abs(cursor - totalAudioDuration) > 0.05
  ) {
    const scale = totalAudioDuration / cursor;
    let t = 0;
    for (const s of sentences) {
      const len = (s.endSec - s.startSec) * scale;
      s.startSec = t;
      s.endSec = t + len;
      t = s.endSec;
    }
  }

  return sentences;
}

/** Fallback when no job/chunk timing exists yet. */
export function buildTimedSentences(sections: Section[]): TimedSentence[] {
  const chunks: TimedChunkInput[] = [];
  for (const section of sections) {
    for (const text of splitSentences(section.text)) {
      chunks.push({ id: section.id, text, sectionId: section.id });
    }
  }
  return buildTimedSentencesFromChunks(chunks);
}

export function sentenceIndexAtTime(
  sentences: TimedSentence[],
  currentTime: number,
  duration: number,
): number {
  if (sentences.length === 0) return -1;
  if (currentTime <= 0) return 0;

  const t =
    duration > 0 ? Math.min(currentTime, duration - 0.0001) : currentTime;

  const found = sentences.findIndex((s) => t >= s.startSec && t < s.endSec);
  if (found >= 0) return found;

  if (t >= sentences[sentences.length - 1].endSec) {
    return sentences.length - 1;
  }
  return 0;
}

export function sentenceWindow(
  sentences: TimedSentence[],
  index: number,
): {
  previous: TimedSentence | null;
  current: TimedSentence | null;
  next: TimedSentence | null;
} {
  if (index < 0 || sentences.length === 0) {
    return { previous: null, current: null, next: null };
  }
  return {
    previous: index > 0 ? sentences[index - 1] : null,
    current: sentences[index] ?? null,
    next: index < sentences.length - 1 ? sentences[index + 1] : null,
  };
}

/** Absolute start time (seconds) keyed by section id. */
export function chapterStartBySectionId(
  sentences: TimedSentence[],
): Record<string, number> {
  const starts: Record<string, number> = {};
  for (const s of sentences) {
    if (!s.sectionId || s.sectionId in starts) continue;
    starts[s.sectionId] = s.startSec;
  }
  return starts;
}

/** Absolute start time (seconds) for each chapter, in document order. */
export function chapterStartTimes(sentences: TimedSentence[]): number[] {
  const starts: number[] = [];
  let lastSectionId = "";
  for (const s of sentences) {
    if (!s.sectionId || s.sectionId === lastSectionId) continue;
    starts.push(s.startSec);
    lastSectionId = s.sectionId;
  }
  return starts;
}

/**
 * Previous: restart current chapter if past the threshold, else previous chapter.
 * Next: start of the following chapter.
 */
export function chapterSeekTargets(
  chapterStarts: number[],
  currentTime: number,
  restartThresholdSec = 3,
): { previous: number | null; next: number | null } {
  if (chapterStarts.length === 0) {
    return { previous: null, next: null };
  }

  let currentIndex = 0;
  for (let i = 0; i < chapterStarts.length; i++) {
    if (chapterStarts[i] <= currentTime + 0.05) currentIndex = i;
    else break;
  }

  const chapterStart = chapterStarts[currentIndex] ?? 0;
  const previous =
    currentTime - chapterStart > restartThresholdSec
      ? chapterStart
      : currentIndex > 0
        ? chapterStarts[currentIndex - 1]
        : chapterStart;

  const next =
    currentIndex < chapterStarts.length - 1
      ? chapterStarts[currentIndex + 1]
      : null;

  return { previous, next };
}

export function toTimedChunkInputs(
  localChunks: TextChunk[],
  jobChunks?: {
    id: string;
    text?: string;
    duration_sec?: number | null;
  }[],
): TimedChunkInput[] {
  if (!jobChunks || jobChunks.length === 0) {
    return localChunks.map((c) => ({
      id: c.id,
      text: c.text,
      sectionId: c.sectionId,
    }));
  }

  // Prefer job text+duration (source of truth for spoken audio), map sectionId by index
  return jobChunks.map((jc, i) => ({
    id: jc.id || localChunks[i]?.id || `chunk-${i}`,
    text: (jc.text && jc.text.trim()) || localChunks[i]?.text || "",
    sectionId: localChunks[i]?.sectionId,
    durationSec: jc.duration_sec,
  }));
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return (normalized.match(SENTENCE_RE) ?? [normalized])
    .map((s) => s.trim())
    .filter(Boolean);
}
