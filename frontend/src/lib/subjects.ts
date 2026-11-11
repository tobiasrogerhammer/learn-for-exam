import { api } from "../../convex/_generated/api";
import { convex } from "./convex";
import { content, readKey, save, writeKey } from "./storage";
import type { Subject } from "./types";

const ACTIVE_KEY = "learn-for-exam:active-subject:v1";

function readAll(): Subject[] {
  return content.subjects;
}

function saveSubject(subject: Subject): void {
  save(() =>
    convex!.mutation(api.content.saveSubject, {
      key: subject.id,
      name: subject.name,
      createdAt: subject.createdAt,
      tools: subject.tools,
    }),
  );
}

export function listSubjects(): Subject[] {
  return [...readAll()].sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

export function createSubject(name: string): Subject {
  const subject: Subject = {
    id: crypto.randomUUID(),
    name: name.trim() || "Nytt emne",
    createdAt: new Date().toISOString(),
  };
  content.subjects = [...readAll(), subject];
  saveSubject(subject);
  return subject;
}

export function renameSubject(id: string, name: string): void {
  content.subjects = readAll().map((s) =>
    s.id === id ? { ...s, name: name.trim() || s.name } : s,
  );
  const renamed = content.subjects.find((s) => s.id === id);
  if (renamed) saveSubject(renamed);
}

/** Convex also deletes the subject's documents, audiobooks and study sets */
export function deleteSubject(id: string): void {
  content.subjects = readAll().filter((s) => s.id !== id);
  save(() => convex!.mutation(api.content.deleteSubject, { key: id }));
}

export function getActiveSubjectId(): string | null {
  return readKey<string | null>(ACTIVE_KEY, null);
}

export function setActiveSubjectId(id: string): void {
  writeKey(ACTIVE_KEY, id);
}
