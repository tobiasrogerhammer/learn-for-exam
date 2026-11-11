import { api } from "../../convex/_generated/api";
import { convex } from "./convex";
import { content, save } from "./storage";
import type { DocCategory, ExtractedDocument, LibraryItem } from "./types";

function readAll(): LibraryItem[] {
  return content.documents;
}

export function listLibrary(subjectId?: string): LibraryItem[] {
  return readAll()
    .filter((x) => !subjectId || x.subjectId === subjectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Drops the subject's documents from the cache; Convex deletes them with the subject */
export function deleteDocumentsInSubject(subjectId: string): string[] {
  const items = readAll();
  const removed = items.filter((x) => x.subjectId === subjectId).map((x) => x.id);
  content.documents = items.filter((x) => x.subjectId !== subjectId);
  return removed;
}

export const CATEGORIES: { id: DocCategory; label: string }[] = [
  { id: "leksjon", label: "Leksjoner" },
  { id: "forelesning", label: "Presentasjoner" },
  { id: "oppgave", label: "Oppgaver" },
  { id: "annet", label: "Annet" },
];

/** Best guess from the file name, e.g. "ls03-balansen" or "Oppgaver forelesning" */
export function guessCategory(title: string): DocCategory {
  const t = title.toLowerCase();
  if (/oppgave|øving|\bov\d|\bost\b|løsning|innlevering|eksamen/.test(t)) return "oppgave";
  if (/forelesning|lysark|slides/.test(t)) return "forelesning";
  if (/leksjon|\blek\b|\bls\d|kapittel|\bkap\b|lærebok|\bbok\b/.test(t)) return "leksjon";
  return "annet";
}

export function categoryOf(item: LibraryItem): DocCategory {
  return item.category ?? guessCategory(item.title);
}

export function setDocumentCategory(id: string, category: DocCategory): void {
  content.documents = readAll().map((x) => (x.id === id ? { ...x, category } : x));
  save(() => convex!.mutation(api.content.setCategory, { key: id, category }));
}

/** Document count per subject, for the sidebar */
export function countBySubject(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const x of readAll()) {
    if (x.subjectId) counts[x.subjectId] = (counts[x.subjectId] ?? 0) + 1;
  }
  return counts;
}

export function saveDocument(
  doc: ExtractedDocument,
  speakingRate: number,
  subjectId: string,
): LibraryItem {
  const item: LibraryItem = {
    id: doc.id,
    subjectId,
    category: guessCategory(doc.title),
    title: doc.title,
    sourceType: doc.sourceType,
    createdAt: doc.createdAt,
    sectionCount: doc.sections.length,
    charCount: doc.rawText.length,
    document: doc,
    speakingRate,
  };
  const rest = readAll().filter((x) => x.id !== item.id);
  content.documents = [item, ...rest];
  save(() =>
    convex!.mutation(api.content.saveDocument, {
      key: item.id,
      subjectKey: subjectId,
      category: item.category,
      title: item.title,
      sourceType: item.sourceType,
      createdAt: item.createdAt,
      sectionCount: item.sectionCount,
      charCount: item.charCount,
      speakingRate,
      document: doc,
    }),
  );
  return item;
}

export function getDocument(id: string): LibraryItem | undefined {
  return readAll().find((x) => x.id === id);
}

export function deleteDocument(id: string): void {
  content.documents = readAll().filter((x) => x.id !== id);
  save(() => convex!.mutation(api.content.deleteDocument, { key: id }));
}

// Piper jobs only exist on the machine that made them, so the link stays in this browser
const JOBS_KEY = "learn-for-exam:local-jobs:v1";

function readJobs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(JOBS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getLastJobId(documentId: string): string | undefined {
  return readJobs()[documentId];
}

export function setLastJobId(documentId: string, jobId: string): void {
  localStorage.setItem(JOBS_KEY, JSON.stringify({ ...readJobs(), [documentId]: jobId }));
}

/** Chapters as Les shows them: the cleaned-up reading text when there is one */
export function chapterCount(item: LibraryItem): number {
  const markdown = item.reading?.markdown;
  return markdown ? (markdown.match(/^## +/gm) ?? []).length : item.document.sections.length;
}

/** Words as Les counts them */
export function wordCount(item: LibraryItem): number {
  return (item.reading?.markdown ?? item.document.rawText).split(/\s+/).filter(Boolean).length;
}
