import { API_BASE } from "./tts-api";
import { toStudySet } from "./study";
import type { LibraryItem, StudySet } from "./types";

export type StudyOptions = {
  flashcards: number;
  quiz: number;
  recall: number;
  focus?: string;
};

export async function checkStudyHealth(): Promise<{ ready: boolean; model: string }> {
  const res = await fetch(`${API_BASE}/study/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("Backend svarer ikke");
  return res.json();
}

export async function generateStudySet(
  item: LibraryItem,
  subjectName: string,
  options: StudyOptions,
): Promise<StudySet> {
  const sections = item.document.sections
    .filter((s) => s.text.trim())
    .map((s) => ({ title: s.title, text: s.text }));
  if (sections.length === 0) throw new Error("Dokumentet har ingen tekst");

  const res = await fetch(`${API_BASE}/study/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: item.title,
      subject: subjectName,
      sections,
      focus: options.focus?.trim() || null,
      flashcards: options.flashcards,
      quiz: options.quiz,
      recall: options.recall,
    }),
  });
  if (!res.ok) {
    let detail = "Kunne ikke lage øvingsmateriale";
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // keep default message
    }
    throw new Error(detail);
  }
  return toStudySet(await res.json(), {
    documentId: item.id,
    subjectId: item.subjectId ?? "",
    documentTitle: item.title,
    source: "claude",
  });
}
