#!/usr/bin/env node
/**
 * Moves the library from the old local store (backend/data/store) into Convex:
 * subjects, documents and study sets. Your own progress is not moved here; it
 * moves to your account the first time you sign in in the browser you used.
 *
 * Replaces those three tables, so run it once, before publishing audiobooks.
 *
 *   node scripts/migrate-local.mjs          # the dev deployment in .env.local
 *   node scripts/migrate-local.mjs --prod   # the production deployment
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const storeDir = path.resolve(here, "../../backend/data/store");
const extraArgs = process.argv.slice(2);

function readStore(name, fallback) {
  const file = path.join(storeDir, `learn-for-exam__${name}__v1.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

const subjects = readStore("subjects", []);
const library = readStore("library", []);
const studySets = Object.values(readStore("study-sets", {}));

if (subjects.length === 0 && library.length === 0) {
  console.error(`Fant ikke noe å flytte i ${storeDir}`);
  process.exit(1);
}

const rows = {
  subjects: subjects.map((s) => ({
    key: s.id,
    name: s.name,
    createdAt: s.createdAt,
    ...(s.tools ? { tools: s.tools } : {}),
  })),
  documents: library
    .filter((d) => d.subjectId)
    .map((d) => ({
      key: d.id,
      subjectKey: d.subjectId,
      ...(d.category ? { category: d.category } : {}),
      title: d.title,
      sourceType: d.sourceType,
      createdAt: d.createdAt,
      sectionCount: d.sectionCount,
      charCount: d.charCount,
      ...(d.speakingRate != null ? { speakingRate: d.speakingRate } : {}),
      document: d.document,
    })),
  studySets: studySets.map((s) => ({
    documentKey: s.documentId,
    subjectKey: s.subjectId,
    data: s,
  })),
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "learn-for-exam-"));
for (const [table, items] of Object.entries(rows)) {
  const file = path.join(tmp, `${table}.jsonl`);
  fs.writeFileSync(file, items.map((x) => JSON.stringify(x)).join("\n") + "\n");
  console.log(`${table}: ${items.length} rader`);
  execFileSync(
    "npx",
    ["convex", "import", "--table", table, "--replace", "-y", file, ...extraArgs],
    { stdio: "inherit", cwd: path.resolve(here, "..") },
  );
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log("Ferdig. Last siden på nytt.");
