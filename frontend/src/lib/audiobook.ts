import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { convex } from "./convex";
import { readKey, writeKey } from "./storage";
import { API_BASE } from "./tts-api";
import { detectSections } from "./structure";
import { cleanExtractedText } from "./text-cleanup";
import type { AudiobookScript, JobProgress, ListenPosition } from "./types";

/**
 * Publishes a finished local Piper job as the document's audiobook: the local
 * backend encodes it as MP3, the file goes to Convex storage, and the chunk
 * lengths go along so anyone can follow the text sentence by sentence.
 */
export async function publishAudiobook(
  documentId: string,
  job: JobProgress,
  speakingRate: number | undefined,
): Promise<void> {
  if (!convex) throw new Error("Convex er ikke satt opp");
  const res = await fetch(`${API_BASE}/tts/jobs/${job.job_id}/audio.mp3`);
  if (!res.ok) throw new Error("Fant ikke lyden i den lokale backenden");
  const mp3 = await res.blob();

  const uploadUrl = await convex.mutation(api.content.generateUploadUrl, {});
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "audio/mpeg" },
    body: mp3,
  });
  if (!upload.ok) throw new Error("Opplastingen til Convex feilet");
  const { storageId } = (await upload.json()) as { storageId: Id<"_storage"> };

  const chunks = job.chunks.map((c) => ({
    id: c.id,
    durationSec: c.duration_sec ?? null,
  }));
  await convex.mutation(api.content.publishAudio, {
    documentKey: documentId,
    storageId,
    format: "mp3",
    durationSec: chunks.reduce((sum, c) => sum + (c.durationSec ?? 0), 0),
    speakingRate,
    chunks,
  });
}

/**
 * Reads one or more TXT files written for listening (chapters marked with "# ")
 * and joins them in file name order, e.g. two course lessons that make up one
 * lesson in the app.
 */
export async function scriptFromFiles(files: File[], title: string): Promise<AudiobookScript> {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, "nb", { numeric: true }));
  const texts = await Promise.all(sorted.map((f) => f.text()));
  const rawText = cleanExtractedText(texts.join("\n\n"));
  const sections = detectSections(rawText, title);
  if (!rawText.trim() || sections.length === 0) throw new Error("Filen har ingen tekst");
  return {
    sections: sections.map(({ id, title, level, text }) => ({ id, title, level, text })),
    rawText,
    files: sorted.map((f) => f.name),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveScript(documentId: string, script: AudiobookScript | null): Promise<void> {
  if (!convex) throw new Error("Convex er ikke satt opp");
  await convex.mutation(api.content.setScript, { key: documentId, script });
}

export async function unpublishAudiobook(documentId: string): Promise<void> {
  if (!convex) throw new Error("Convex er ikke satt opp");
  await convex.mutation(api.content.removeAudio, { documentKey: documentId });
}

// ---------- Where you stopped listening ----------

const POSITIONS_KEY = "learn-for-exam:listen-positions:v1";

export function getListenPositions(): Record<string, ListenPosition> {
  return readKey<Record<string, ListenPosition>>(POSITIONS_KEY, {});
}

export function getListenPosition(documentId: string): ListenPosition | undefined {
  return getListenPositions()[documentId];
}

export function saveListenPosition(documentId: string, time: number, duration: number): void {
  writeKey(POSITIONS_KEY, {
    ...getListenPositions(),
    [documentId]: { time, duration, updatedAt: new Date().toISOString() },
  });
}

/** Share of the audiobook heard, 0–1; the end counts as finished */
export function listenedShare(position: ListenPosition | undefined): number {
  if (!position || position.duration <= 0) return 0;
  const share = position.time / position.duration;
  return share > 0.98 ? 1 : Math.max(0, share);
}

/** Short label for how much of an audiobook you have heard */
export function listenedLabel(position: ListenPosition | undefined): string {
  const share = listenedShare(position);
  if (share >= 1) return "Hørt";
  if (share > 0) return `${Math.round(share * 100)} % hørt`;
  return "Lydbok";
}
