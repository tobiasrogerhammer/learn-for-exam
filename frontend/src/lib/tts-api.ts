import type { JobProgress, TextChunk } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_TTS_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8000";

export async function checkHealth(): Promise<{
  ready: boolean;
  voice: string;
  sample_rate: number;
}> {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("TTS-tjeneren svarer ikke");
  return res.json();
}

export async function createTtsJob(
  title: string,
  chunks: TextChunk[],
  speakingRate = 1,
): Promise<{ job_id: string; total_chunks: number }> {
  const res = await fetch(`${API_BASE}/tts/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      speaking_rate: speakingRate,
      chunks: chunks.map((c) => ({
        id: c.id,
        text: c.text,
        title: c.title,
      })),
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || "Kunne ikke starte talejobb");
  }
  return res.json();
}

export async function getJobProgress(jobId: string): Promise<JobProgress> {
  const res = await fetch(`${API_BASE}/tts/jobs/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Fant ikke talejobb");
  return res.json();
}

export async function retryFailedChunks(jobId: string): Promise<JobProgress> {
  const res = await fetch(`${API_BASE}/tts/jobs/${jobId}/retry`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Kunne ikke prøve på nytt");
  return res.json();
}

export function audioUrl(jobId: string): string {
  return `${API_BASE}/tts/jobs/${jobId}/audio?t=${Date.now()}`;
}
