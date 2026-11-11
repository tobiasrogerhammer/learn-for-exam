"use client";

import { useRef, useState } from "react";
import {
  Download,
  FileJson,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateStudySet } from "@/lib/study-api";
import {
  deleteStudySets,
  exportStudySetJson,
  parseStudySetJson,
  saveStudySet,
} from "@/lib/study";
import { chapterCount, wordCount } from "@/lib/library";
import type { LibraryItem, StudySet } from "@/lib/types";

type Props = {
  item: LibraryItem;
  subjectName: string;
  studySet: StudySet | undefined;
  claudeReady: boolean | null;
  /** Only the admin can change category or make practice material */
  canEdit: boolean;
  onDelete: () => void;
  onStudySetChange: () => void;
};

const fieldClass =
  "h-8 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** Øvingsmateriale for ett dokument: generer med Claude, importer eller eksporter JSON */
export function StudyPanel({
  item,
  subjectName,
  studySet,
  claudeReady,
  canEdit,
  onDelete,
  onStudySetChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState(25);
  const [quiz, setQuiz] = useState(15);
  const [recall, setRecall] = useState(6);
  const [focus, setFocus] = useState("");

  const replaceSet = (set: StudySet) => {
    // Card ids are positional, so old review history must go with the old set
    deleteStudySets([item.id]);
    saveStudySet(set);
    onStudySetChange();
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const set = await generateStudySet(item, subjectName, {
        flashcards,
        quiz,
        recall,
        focus,
      });
      replaceSet(set);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generering feilet");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const set = parseStudySetJson(await file.text(), {
        documentId: item.id,
        subjectId: item.subjectId ?? "",
        documentTitle: item.title,
      });
      replaceSet(set);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import feilet");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleExport = () => {
    if (!studySet) return;
    const blob = new Blob([exportStudySetJson(studySet)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title || "ovingsmateriale"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Valgt dokument
      </p>
      <h2 className="mt-1 font-[family-name:var(--font-reading)] text-2xl leading-tight">
        {item.title}
      </h2>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          {chapterCount(item)} kapitler · {wordCount(item).toLocaleString("nb-NO")} ord
        </span>
      </div>

      {studySet?.summary ? (
        <p className="mt-4 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 font-[family-name:var(--font-reading)] text-[15px] leading-relaxed">
          {studySet.summary}
        </p>
      ) : null}

      {canEdit ? (
      <div className="mt-5 border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {studySet ? "Lag nytt øvingsmateriale" : "Lag øvingsmateriale"}
          </p>
          {studySet ? (
            <p className="text-xs text-muted-foreground">
              {studySet.source === "claude" ? "Laget av Claude" : "Importert"}{" "}
              {new Date(studySet.generatedAt).toLocaleString("nb-NO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Claude leser dokumentet og lager flashcards, quiz og
          gjenkallingsspørsmål. Teksten sendes til Anthropic for dette steget.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:max-w-md">
          <label className="text-xs text-muted-foreground">
            Flashcards
            <input
              type="number"
              min={0}
              max={120}
              value={flashcards}
              onChange={(e) => setFlashcards(Number(e.target.value))}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Quiz
            <input
              type="number"
              min={0}
              max={80}
              value={quiz}
              onChange={(e) => setQuiz(Number(e.target.value))}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Gjenkalling
            <input
              type="number"
              min={0}
              max={40}
              value={recall}
              onChange={(e) => setRecall(Number(e.target.value))}
              className={`mt-1 ${fieldClass}`}
            />
          </label>
        </div>
        <label className="mt-2 block text-xs text-muted-foreground">
          Fokus (valgfritt)
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="F.eks. regneoppgaver, definisjoner, nullpunktanalyse"
            className={`mt-1 ${fieldClass}`}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy || claudeReady === false}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {busy ? "Claude jobber…" : "Lag med Claude"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => void handleImport(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <FileJson className="size-3.5" />
            Importer JSON
          </Button>
          {studySet ? (
            <Button type="button" variant="ghost" onClick={handleExport}>
              <Download className="size-3.5" />
              Eksporter JSON
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm(`Slette «${item.title}» for alle?`)) onDelete();
            }}
          >
            <Trash2 className="size-3.5" />
            Slett dokument
          </Button>
        </div>

        {claudeReady === false ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Claude er ikke satt opp. Legg <code>ANTHROPIC_API_KEY</code> i{" "}
            <code>backend/.env</code> og start backend på nytt, eller importer
            JSON.
          </p>
        ) : null}
        {busy ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Dette kan ta et par minutter for lange dokumenter.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      ) : null}
    </section>
  );
}
