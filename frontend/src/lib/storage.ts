import { api } from "../../convex/_generated/api";
import { convex } from "./convex";
import type { LibraryItem, StudySet, Subject } from "./types";

/**
 * Content (subjects, documents, study sets, audiobooks) lives in Convex. Anyone
 * can read it; only the admin can change it, and Convex checks that on every write.
 * Reads are served from an in-memory copy loaded once per page load.
 *
 * Progress (card reviews, recall scores, listening positions) follows the
 * signed-in Google account. Signed out, it stays in this browser's localStorage
 * and is moved to the account the first time you sign in.
 */

const PREFIX = "learn-for-exam:";

export type ProgressMode = "account" | "browser";

type Content = {
  subjects: Subject[];
  documents: LibraryItem[];
  studySets: Record<string, StudySet>;
};

export const content: Content = { subjects: [], documents: [], studySets: {} };

let contentLoading: Promise<void> | null = null;

/** Loads content once per page load (React may call this twice in development) */
export function loadContent(): Promise<void> {
  contentLoading ??= fetchContent();
  return contentLoading;
}

/** Fetches content again, e.g. after publishing an audiobook */
export async function reloadContent(): Promise<void> {
  contentLoading = fetchContent();
  return contentLoading;
}

async function fetchContent(): Promise<void> {
  if (!convex) throw new Error("Convex er ikke satt opp");
  const loaded = await convex.query(api.content.load, {});
  content.subjects = loaded.subjects;
  content.documents = loaded.documents as LibraryItem[];
  content.studySets = Object.fromEntries(
    (loaded.studySets as StudySet[]).map((s) => [s.documentId, s]),
  );
}

// Writes are sent in the background; failures are reported to listeners
type ErrorListener = (message: string) => void;
const errorListeners = new Set<ErrorListener>();

export function onSaveError(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function reportError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.warn("Kunne ikke lagre", err);
  errorListeners.forEach((l) => l(message));
}

/** Runs a content mutation without blocking the UI */
export function save(run: () => Promise<unknown>): void {
  run().catch(reportError);
}

// ---------- Progress ----------

let progress: Record<string, unknown> = {};
let mode: ProgressMode = "browser";

function readLocal(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const raw = localStorage.getItem(key);
    if (raw === null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      // Older builds stored the active subject as a bare string
      out[key] = raw;
    }
  }
  return out;
}

/** Call again whenever the user signs in or out */
export async function loadProgress(signedIn: boolean): Promise<ProgressMode> {
  const local = readLocal();
  if (!signedIn || !convex) {
    mode = "browser";
    progress = local;
    return mode;
  }
  const remote = (await convex.query(api.progress.mine, {})) ?? {};
  mode = "account";
  progress = { ...remote };
  // First sign-in on this browser: keep what was done while signed out
  for (const [key, value] of Object.entries(local)) {
    if (key in remote) continue;
    progress[key] = value;
    persist(key, value);
  }
  return mode;
}

export function readKey<T>(key: string, fallback: T): T {
  return key in progress ? (progress[key] as T) : fallback;
}

export function writeKey(key: string, value: unknown): void {
  progress[key] = value;
  if (mode === "account") persist(key, value);
  else localStorage.setItem(key, JSON.stringify(value));
}

// Only the latest value per key is sent, one request at a time, so writes never arrive out of order
const pending = new Map<string, unknown>();
const inflight = new Set<string>();

function persist(key: string, value: unknown): void {
  pending.set(key, value);
  if (!inflight.has(key)) void flush(key);
}

async function flush(key: string): Promise<void> {
  inflight.add(key);
  while (pending.has(key)) {
    const value = pending.get(key);
    pending.delete(key);
    try {
      await convex!.mutation(api.progress.set, { key, value });
    } catch (err) {
      reportError(err);
    }
  }
  inflight.delete(key);
}

/** Whether progress is saved to a signed-in account */
export function signedIn(): boolean {
  return mode === "account";
}
