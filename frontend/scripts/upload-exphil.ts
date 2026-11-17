#!/usr/bin/env node
/**
 * Uploads Examen philosophicum from pensum/exphil to Convex as the admin user:
 * the subject, one lesson per module (reading text, audiobook script and study
 * set), the past exam questions, and the lectures and seminars as presentations.
 * Keys are kept in pensum/exphil/opplasting-<target>.json, so running it again
 * updates the same documents instead of making new ones.
 *
 *   node --experimental-strip-types scripts/upload-exphil.ts prod <adminUserId> [--dry]
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectSections } from "../src/lib/structure.ts";
import { cleanExtractedText } from "../src/lib/text-cleanup.ts";

const [target, adminId, flag] = process.argv.slice(2);
if ((target !== "prod" && target !== "dev") || !adminId) {
  console.error("Bruk: node --experimental-strip-types scripts/upload-exphil.ts <prod|dev> <admin-bruker-id> [--dry]");
  process.exit(1);
}
const dry = flag === "--dry";
const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const E = path.resolve(FRONTEND, "../pensum/exphil");
const MANIFEST = `${E}/opplasting-${target}.json`;

type Section = { id: string; title: string; level: number; text: string };
type Manifest = { subject?: string; docs: Record<string, string> };
const manifest: Manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : { docs: {} };
const keyFor = (name: string) => (manifest.docs[name] ??= randomUUID());
const saveManifest = () => {
  if (!dry) writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
};

function run(fn: string, args: unknown) {
  const json = JSON.stringify(args);
  if (dry) {
    console.log(`  [tørrkjøring] ${fn} (${Math.round(json.length / 1024)} KB)`);
    return;
  }
  const identity = JSON.stringify({ subject: `${adminId}|admin`, issuer: "admin" });
  const flags = target === "prod" ? ["--prod"] : [];
  // A dropped connection ("fetch failed") is worth a couple of retries before giving up
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync("npx", ["convex", "run", ...flags, "--identity", identity, `content:${fn}`, json], {
        cwd: FRONTEND,
        stdio: ["ignore", "ignore", "inherit"],
      });
      return;
    } catch {
      if (attempt === 3) {
        console.error(`\n${fn} feilet tre ganger. Kjør skriptet på nytt for å fortsette der det stoppet.`);
        process.exit(1);
      }
      console.log(`  prøver igjen (${attempt + 1}/3) …`);
      execFileSync("sleep", [String(attempt * 3)]);
    }
  }
}

const now = () => new Date().toISOString();

const MODULES: [number, string, string][] = [
  [1, "introduksjon", "Introduksjon til ex.phil."],
  [2, "argumentasjonsteori", "Argumentasjonsteori"],
  [3, "vitenskapelig-tenkemate", "Vitenskapelig tenkemåte"],
  [4, "akademisk-skriving", "Akademisk skriving og argumentativ framstilling"],
  [5, "vitenskap-teknologi-og-samfunn", "Vitenskap, teknologi og samfunn"],
  [6, "menneskesyn", "Menneskesyn"],
  [7, "eksamensteknikk", "Eksamensteknikk"],
  [8, "etikk", "Etikk"],
  [9, "baerekraft", "Bærekraft"],
  [10, "politisk-filosofi", "Politisk filosofi"],
];

const LECTURERS: Record<string, string> = {
  asmund: "Åsmund",
  claus: "Claus",
  kjetil: "Kjetil",
  mirela: "Mirela",
  monica: "Monica",
};

/** Plain text of a Markdown lesson, one section per "## " chapter */
function sectionsFromMarkdown(md: string, title: string): Section[] {
  const plain = (s: string) =>
    s
      .replace(/^\|?\s*:?-{3,}.*$/gm, "")
      .replace(/\|/g, " ")
      .replace(/^#{3,}\s*/gm, "")
      .replace(/\*\*|__|\*/g, "")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/[ \t]+/g, " ")
      .trim();
  const sections = md
    .split(/^## +/m)
    .slice(1)
    .map((part, i) => {
      const nl = part.indexOf("\n");
      return { id: `section-${i}`, title: part.slice(0, nl).trim(), level: 1, text: plain(part.slice(nl + 1)) };
    });
  return sections.length ? sections : [{ id: "section-0", title, level: 1, text: plain(md) }];
}

/** Slide text from the extracted lecture files, one section per page or slide */
function slideSections(file: string, label: string): Section[] {
  const parts = readFileSync(file, "utf8").split(/^--- (?:side|lysbilde) (\d+) ---$/m);
  const out: Section[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const text = cleanExtractedText(parts[i + 1] ?? "").trim();
    if (text) out.push({ id: `section-${out.length}`, title: `${label} ${parts[i]}`, level: 1, text });
  }
  return out;
}

function documentArgs(subjectKey: string, key: string, title: string, category: string, sections: Section[]) {
  const rawText = sections.map((s) => `${s.title}\n\n${s.text}`).join("\n\n");
  const createdAt = now();
  return {
    key,
    subjectKey,
    category,
    title,
    sourceType: "txt",
    createdAt,
    sectionCount: sections.length,
    charCount: rawText.length,
    speakingRate: 1,
    document: { id: key, title, sourceType: "txt", createdAt, sections, rawText },
  };
}

/** The study set JSON from pensum, in the shape the app stores (see toStudySet in src/lib/study.ts) */
function studySet(raw: Record<string, any>, documentId: string, subjectId: string, documentTitle: string) {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    documentId,
    subjectId,
    documentTitle,
    generatedAt: now(),
    source: "import",
    model: null,
    summary: s(raw.summary),
    flashcards: (raw.flashcards ?? []).map((c: any, i: number) => ({
      id: `${documentId}:fc:${i}`,
      front: s(c.front),
      back: s(c.back),
      section: s(c.section),
    })),
    quiz: (raw.quiz ?? []).map((q: any, i: number) => ({
      id: `${documentId}:quiz:${i}`,
      question: s(q.question),
      options: q.options.map(s),
      answerIndex: Number(q.answer_index ?? q.answerIndex),
      explanation: s(q.explanation),
      section: s(q.section),
    })),
    recall: (raw.recall ?? []).map((r: any, i: number) => ({
      id: `${documentId}:recall:${i}`,
      prompt: s(r.prompt),
      keyPoints: (r.key_points ?? r.keyPoints ?? []).map(s),
      section: s(r.section),
    })),
  };
}

function uploadStudySet(file: string, key: string, subjectKey: string, title: string) {
  if (!existsSync(file)) return;
  const data = studySet(JSON.parse(readFileSync(file, "utf8")), key, subjectKey, title);
  run("saveStudySet", { documentKey: key, subjectKey, data });
}

// --- Subject ---
manifest.subject ??= randomUUID();
const subjectKey = manifest.subject;
console.log(`Emne: Examen philosophicum (${target})`);
run("saveSubject", { key: subjectKey, name: "Examen philosophicum", createdAt: "2026-11-11T12:00:00.000Z" });
saveManifest();

// --- Lessons with reading text, audiobook script and study set ---
for (const [n, slug, theme] of MODULES) {
  const nn = String(n).padStart(2, "0");
  const mdFile = `${E}/leksjon/lesetekst/leksjon-${nn}-${slug}.md`;
  if (!existsSync(mdFile)) {
    console.log(`Hopper over modul ${n}: mangler lesetekst`);
    continue;
  }
  const title = `${n} - ${theme}`;
  const key = keyFor(`leksjon-${nn}`);
  const md = readFileSync(mdFile, "utf8");
  console.log(title);
  run("saveDocument", documentArgs(subjectKey, key, title, "leksjon", sectionsFromMarkdown(md, title)));
  run("setReading", { key, reading: { markdown: md, files: [path.basename(mdFile)], updatedAt: now() } });

  const scriptFile = `${E}/lydbok/leksjon-${nn}-${slug}-lydbok.txt`;
  if (existsSync(scriptFile)) {
    const rawText = cleanExtractedText(readFileSync(scriptFile, "utf8"));
    const sections = detectSections(rawText, title).map(({ id, title, level, text }) => ({ id, title, level, text }));
    run("setScript", { key, script: { sections, rawText, files: [path.basename(scriptFile)], updatedAt: now() } });
  }
  uploadStudySet(`${E}/oving/ovingssett/leksjon-${nn}-${slug}.json`, key, subjectKey, title);
  saveManifest();
}

// --- Past exam questions, as a task document with its own study set ---
{
  const title = "Tidligere eksamensoppgaver 2024–2025";
  const key = keyFor("tidligere-eksamensoppgaver");
  console.log(title);
  const sections = slideSections(`${E}/kilde/generelt/hjemmeeksamen-2024-2025.txt`, "Side");
  run("saveDocument", documentArgs(subjectKey, key, title, "oppgave", sections));
  uploadStudySet(`${E}/oving/ovingssett/tidligere-eksamensoppgaver.json`, key, subjectKey, title);
  saveManifest();
}

// --- Lectures and seminars as presentations ---
for (const [n, , theme] of MODULES) {
  const dir = `${E}/kilde/modul-${String(n).padStart(2, "0")}`;
  const files = readdirSync(dir)
    .filter((f) => /^(forelesning|seminar)-[a-z]+-\d+\.txt$/.test(f))
    .sort((a, b) => a.localeCompare(b, "nb", { numeric: true }));
  for (const f of files) {
    const [, kind, who, num] = f.match(/^(forelesning|seminar)-([a-z]+)-(\d+)\.txt$/)!;
    const name = LECTURERS[who] ?? who;
    const title =
      kind === "seminar"
        ? `${n} - Seminar: ${theme} (${name})`
        : `${n} - Forelesning ${Number(num)}: ${theme} (${name})`;
    const key = keyFor(f.replace(/\.txt$/, ""));
    console.log(title);
    run("saveDocument", documentArgs(subjectKey, key, title, "forelesning", slideSections(`${dir}/${f}`, "Lysbilde")));
    saveManifest();
  }
}
console.log("Ferdig");
