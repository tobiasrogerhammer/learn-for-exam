"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  BookText,
  Calculator,
  Check,
  EyeOff,
  Gamepad2,
  Highlighter,
  Keyboard,
  Layers,
  Link2,
  ListChecks,
  Lock,
  MessageSquareText,
  NotebookPen,
  RotateCcw,
  X,
} from "lucide-react";
import { AudioPlayer } from "@/components/audio-player";
import { FlashcardsView } from "@/components/flashcards-view";
import { KahootView } from "@/components/kahoot-view";
import { MatchView } from "@/components/match-view";
import { QuizView } from "@/components/quiz-view";
import { footnoteLabels, markdownComponents } from "@/components/read-view";
import { RecallView } from "@/components/recall-view";
import { ToolsView } from "@/components/tools-view";
import { TypingView } from "@/components/typing-view";
import { Button } from "@/components/ui/button";
import {
  addHighlight,
  alignAudio,
  getLessonProgress,
  lessonChapters,
  resetLessonProgress,
  saveLessonProgress,
  type Chapter,
  type Highlight as Marking,
  type LessonProgress,
} from "@/lib/lesson-flow";
import {
  buildTimedSentencesFromChunks,
  chapterStartBySectionId,
  toTimedChunkInputs,
} from "@/lib/sentences";
import { chunkSections } from "@/lib/structure";
import type { LibraryItem, StudySet, SubjectTool } from "@/lib/types";

type Props = {
  item: LibraryItem;
  studySet?: StudySet;
  /** The subject's own exercises, such as Debet og kredit */
  tools: SubjectTool[];
};

type Step = { kind: "chapter"; index: number } | { kind: "summary" } | { kind: "practice" };

const PRACTICE = [
  { id: "quiz", label: "Quiz", icon: ListChecks },
  { id: "recall", label: "Gjenkalling", icon: MessageSquareText },
  { id: "match", label: "Koble sammen", icon: Link2 },
  { id: "kahoot", label: "Kahoot", icon: Gamepad2 },
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "typing", label: "Skriv svaret", icon: Keyboard },
] as const;

type PracticeId = (typeof PRACTICE)[number]["id"] | "tools";

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 font-[family-name:var(--font-reading)] text-[17px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * One lesson, worked through in a fixed order: read or listen to a chapter and
 * mark what matters, write notes from the markings with the text hidden, and
 * after the last chapter sum up the lesson before practising.
 * Mount with key={item.id}.
 */
export function LessonFlow({ item, studySet, tools }: Props) {
  const chapters = useMemo(() => lessonChapters(item), [item]);
  const [progress, setProgress] = useState<LessonProgress>(() => getLessonProgress(item.id));
  const saveTimer = useRef<number | null>(null);
  const latest = useRef(progress);

  // Notes are saved a moment after you stop typing, and right away when you move on
  const update = (fn: (p: LessonProgress) => LessonProgress, now = false) => {
    const next = fn(latest.current);
    latest.current = next;
    setProgress(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (now) saveLessonProgress(item.id, next);
    else saveTimer.current = window.setTimeout(() => saveLessonProgress(item.id, latest.current), 700);
  };

  useEffect(
    () => () => {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current);
        saveLessonProgress(item.id, latest.current);
      }
    },
    [item.id],
  );

  const firstOpen = chapters.findIndex((_, i) => !progress.done.includes(i));
  const allDone = chapters.length > 0 && firstOpen < 0;
  const current: Step = !allDone
    ? { kind: "chapter", index: Math.max(firstOpen, 0) }
    : progress.summaryDone
      ? { kind: "practice" }
      : { kind: "summary" };
  const [viewing, setViewing] = useState<Step | null>(null);
  const step = viewing ?? current;

  const chapterAudio = useChapterAudio(item, chapters);

  const go = (next: Step | null) => {
    setViewing(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (chapters.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/80 px-6 py-10 text-center text-sm text-muted-foreground">
        Dette dokumentet har ingen tekst å gå gjennom.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Stepper
        chapters={chapters}
        progress={progress}
        step={step}
        firstOpen={firstOpen}
        allDone={allDone}
        onGo={(s) => go(sameStep(s, current) ? null : s)}
        onReset={() => {
          if (!window.confirm("Starte leksjonen på nytt? Markeringene, notatene og oppsummeringen din slettes.")) return;
          if (saveTimer.current) window.clearTimeout(saveTimer.current);
          const empty = resetLessonProgress(item.id);
          latest.current = empty;
          setProgress(empty);
          go(null);
        }}
      />

      {step.kind === "chapter" ? (
        progress.read.includes(step.index) ? (
          <ChapterNotes
            key={`notes-${step.index}`}
            chapter={chapters[step.index]}
            number={step.index + 1}
            markings={progress.highlights[step.index] ?? []}
            notes={progress.notes[step.index] ?? ""}
            isLast={step.index === chapters.length - 1}
            revisiting={progress.done.includes(step.index)}
            onNotes={(text) => update((p) => ({ ...p, notes: { ...p.notes, [step.index]: text } }))}
            onDone={() => {
              update((p) => ({ ...p, done: [...new Set([...p.done, step.index])] }), true);
              go(null);
            }}
            onBack={() => go(null)}
          />
        ) : (
          <ChapterReader
            key={`read-${step.index}`}
            chapter={chapters[step.index]}
            number={step.index + 1}
            total={chapters.length}
            audioSrc={item.audiobook?.url ?? null}
            audioRange={chapterAudio?.[step.index] ?? null}
            hasAudiobook={!!item.audiobook?.url}
            markings={progress.highlights[step.index] ?? []}
            onMarkings={(list) =>
              update((p) => ({ ...p, highlights: { ...p.highlights, [step.index]: list } }), true)
            }
            onDone={() => {
              update((p) => ({ ...p, read: [...new Set([...p.read, step.index])] }), true);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )
      ) : null}

      {step.kind === "summary" ? (
        <SummaryStep
          title={item.title}
          chapters={chapters}
          progress={progress}
          onSummary={(text) => update((p) => ({ ...p, summary: text }))}
          onDone={() => {
            update((p) => ({ ...p, summaryDone: true }), true);
            go(null);
          }}
          revisiting={progress.summaryDone}
          onBack={() => go(null)}
        />
      ) : null}

      {step.kind === "practice" ? (
        <PracticeStep item={item} studySet={studySet} tools={tools} />
      ) : null}
    </div>
  );
}

function sameStep(a: Step, b: Step) {
  return a.kind === b.kind && (a.kind !== "chapter" || (b.kind === "chapter" && a.index === b.index));
}

/** Where each chapter's part of the audiobook starts and ends, or null when it has none */
function useChapterAudio(item: LibraryItem, chapters: Chapter[]) {
  return useMemo(() => {
    const audio = item.audiobook?.url ? item.audiobook : null;
    if (!audio) return null;
    const sections = item.script?.sections ?? item.document.sections;
    const timed = buildTimedSentencesFromChunks(
      toTimedChunkInputs(
        chunkSections(sections),
        audio.chunks.map((c) => ({ id: c.id, duration_sec: c.durationSec })),
      ),
      audio.durationSec,
    );
    const starts = chapterStartBySectionId(timed);
    const groups = alignAudio(chapters, sections);
    return groups.map((ids, i) => {
      const start = ids.length ? starts[ids[0]] : undefined;
      if (start === undefined) return null;
      const next = groups.slice(i + 1).find((g) => g.length && starts[g[0]] !== undefined);
      return { start, end: next ? starts[next[0]] : audio.durationSec };
    });
  }, [item, chapters]);
}

function Stepper({
  chapters,
  progress,
  step,
  firstOpen,
  allDone,
  onGo,
  onReset,
}: {
  chapters: Chapter[];
  progress: LessonProgress;
  step: Step;
  firstOpen: number;
  allDone: boolean;
  onGo: (step: Step) => void;
  onReset: () => void;
}) {
  const doneCount = progress.done.length;
  const pill = (active: boolean, done: boolean, locked: boolean) =>
    `flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition ${
      active
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : done
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          : locked
            ? "border-border/60 bg-muted/40 text-muted-foreground/60"
            : "border-border bg-card text-foreground hover:border-primary/50"
    }`;

  return (
    <nav
      aria-label="Gangen i leksjonen"
      className="rounded-md border border-border/70 bg-card/80 px-4 py-3 shadow-sm"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {allDone
            ? progress.summaryDone
              ? "Leksjonen er gjennomgått. Nå kan du øve."
              : "Alle kapitlene er ferdige. Skriv oppsummeringen."
            : `Kapittel ${firstOpen + 1} av ${chapters.length} · ${doneCount} ferdig${doneCount === 1 ? "" : "e"}`}
        </span>
        {doneCount > 0 || progress.read.length > 0 ? (
          <button type="button" onClick={onReset} className="flex items-center gap-1 hover:text-foreground">
            <RotateCcw className="size-3" />
            Start på nytt
          </button>
        ) : null}
      </div>
      <ol className="flex flex-wrap items-center gap-1.5">
        {chapters.map((c, i) => {
          const done = progress.done.includes(i);
          const locked = !done && i !== firstOpen;
          const active = step.kind === "chapter" && step.index === i;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onGo({ kind: "chapter", index: i })}
                title={`${i + 1}. ${c.title}${done ? " (ferdig)" : locked ? " (låst)" : ""}`}
                aria-current={active ? "step" : undefined}
                className={pill(active, done, locked)}
              >
                {done && !active ? <Check className="size-3.5" /> : i + 1}
              </button>
            </li>
          );
        })}
        <li aria-hidden className="mx-1 h-px w-4 bg-border" />
        <li>
          <button
            type="button"
            disabled={!allDone}
            onClick={() => onGo({ kind: "summary" })}
            aria-current={step.kind === "summary" ? "step" : undefined}
            className={`${pill(step.kind === "summary", progress.summaryDone, !allDone)} w-auto gap-1.5 px-3`}
          >
            {!allDone ? <Lock className="size-3" /> : <NotebookPen className="size-3.5" />}
            Oppsummering
          </button>
        </li>
        <li>
          <button
            type="button"
            disabled={!progress.summaryDone}
            onClick={() => onGo({ kind: "practice" })}
            aria-current={step.kind === "practice" ? "step" : undefined}
            className={`${pill(step.kind === "practice", false, !progress.summaryDone)} w-auto gap-1.5 px-3`}
          >
            {!progress.summaryDone ? <Lock className="size-3" /> : <Layers className="size-3.5" />}
            Øving
          </button>
        </li>
      </ol>
    </nav>
  );
}

/** Text offset of a point inside the container, counted the way Range.toString counts */
function offsetIn(container: Node, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** A DOM range for a text offset span inside the container */
function rangeFor(container: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const len = node.textContent?.length ?? 0;
    if (!started && start <= pos + len) {
      range.setStart(node, Math.max(0, start - pos));
      started = true;
    }
    if (started && end <= pos + len) {
      range.setEnd(node, Math.max(0, end - pos));
      return range;
    }
    pos += len;
  }
  return null;
}

const HIGHLIGHT_NAME = "leksjon-markering";

type Toolbar =
  | { kind: "add"; start: number; end: number; x: number; y: number }
  | { kind: "remove"; index: number; x: number; y: number };

function ChapterReader({
  chapter,
  number,
  total,
  audioSrc,
  audioRange,
  hasAudiobook,
  markings,
  onMarkings,
  onDone,
}: {
  chapter: Chapter;
  number: number;
  total: number;
  audioSrc: string | null;
  audioRange: { start: number; end: number } | null;
  hasAudiobook: boolean;
  markings: Marking[];
  onMarkings: (list: Marking[]) => void;
  onDone: () => void;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<Toolbar | null>(null);
  const [supported] = useState(() => typeof CSS !== "undefined" && "highlights" in CSS);

  // Paint the markings over the rendered text without touching the Markdown
  useEffect(() => {
    const container = textRef.current;
    if (!container || !supported) return;
    const ranges = markings
      .map((m) => rangeFor(container, m.start, m.end))
      .filter((r): r is Range => r !== null);
    CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    return () => {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    };
  }, [markings, supported, chapter.body]);

  // Selecting text offers to mark it; tapping a marking offers to remove it
  useEffect(() => {
    const check = () => {
      const container = textRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.rangeCount === 0) {
        setToolbar(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setToolbar(null);
        return;
      }
      const start = offsetIn(container, range.startContainer, range.startOffset);
      const rect = range.getBoundingClientRect();
      if (!selection.isCollapsed) {
        const end = offsetIn(container, range.endContainer, range.endOffset);
        if (range.toString().trim().length < 2) return setToolbar(null);
        setToolbar({ kind: "add", start, end, x: rect.left + rect.width / 2, y: rect.top });
        return;
      }
      const index = markings.findIndex((m) => start >= m.start && start <= m.end);
      setToolbar(index >= 0 ? { kind: "remove", index, x: rect.left, y: rect.top } : null);
    };
    document.addEventListener("selectionchange", check);
    window.addEventListener("scroll", check, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", check);
      window.removeEventListener("scroll", check);
    };
  }, [markings]);

  const fullText = () => textRef.current?.textContent ?? "";

  const mark = () => {
    if (toolbar?.kind !== "add") return;
    onMarkings(addHighlight(markings, { start: toolbar.start, end: toolbar.end, text: "" }, fullText()));
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  };

  const unmark = (index: number) => {
    onMarkings(markings.filter((_, i) => i !== index));
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {audioSrc && audioRange ? (
        <AudioPlayer
          src={audioSrc}
          title={`Lydbok: ${chapter.title}`}
          startAt={audioRange.start}
          endAt={audioRange.end}
          chapterStarts={[audioRange.start]}
        />
      ) : hasAudiobook ? (
        <p className="rounded-md border border-border/70 bg-card/70 px-4 py-2.5 text-sm text-muted-foreground">
          Lydboken har ingen egen del for dette kapitlet. Les teksten i stedet.
        </p>
      ) : null}

      <article className="rounded-md border border-border/70 bg-card/90 px-5 py-6 shadow-sm sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Kapittel {number} av {total}
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-reading)] text-3xl leading-tight">{chapter.title}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Highlighter className="size-3.5" />
          Merk teksten som er viktig. Når du er ferdig, skjules kapitlet, og du ser bare det du har markert.
        </p>
        <div
          ref={textRef}
          className="mt-5 max-w-3xl font-[family-name:var(--font-reading)] text-[17px] leading-relaxed text-foreground/90"
        >
          <Markdown remarkPlugins={[remarkGfm]} remarkRehypeOptions={footnoteLabels} components={markdownComponents}>
            {chapter.body}
          </Markdown>
        </div>
      </article>

      {toolbar ? (
        <div
          className="fixed z-30 -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: Math.min(Math.max(toolbar.x, 80), window.innerWidth - 80), top: toolbar.y }}
        >
          <Button
            type="button"
            size="sm"
            variant={toolbar.kind === "add" ? "default" : "outline"}
            className="shadow-md"
            // Keep the selection when the button is pressed
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (toolbar.kind === "add" ? mark() : unmark(toolbar.index))}
          >
            {toolbar.kind === "add" ? <Highlighter className="size-3.5" /> : <X className="size-3.5" />}
            {toolbar.kind === "add" ? "Marker" : "Fjern markering"}
          </Button>
        </div>
      ) : null}

      <section className="rounded-md border border-border/70 bg-card/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {markings.length
              ? `${markings.length} ${markings.length === 1 ? "markering" : "markeringer"} i dette kapitlet`
              : "Du har ikke markert noe ennå"}
          </p>
          <Button
            type="button"
            onClick={() => {
              if (
                markings.length === 0 &&
                !window.confirm("Du har ikke markert noe. Gå videre uten markeringer?")
              ) {
                return;
              }
              onDone();
            }}
          >
            <EyeOff className="size-3.5" />
            Ferdig med kapitlet
          </Button>
        </div>
        {markings.length ? (
          <ul className="mt-3 space-y-1.5">
            {markings.map((m, i) => (
              <li key={`${m.start}-${m.end}`} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
                <span className="line-clamp-2 min-w-0 flex-1 text-foreground/85">{m.text}</span>
                <button
                  type="button"
                  onClick={() => unmark(i)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Fjern markeringen"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {!supported ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Nettleseren din viser ikke markeringene i teksten, men de lagres i listen her.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function MarkingList({ markings }: { markings: Marking[] }) {
  if (markings.length === 0) {
    return <p className="text-sm text-muted-foreground">Du markerte ingenting i dette kapitlet.</p>;
  }
  return (
    <ul className="space-y-2">
      {markings.map((m) => (
        <li
          key={`${m.start}-${m.end}`}
          className="rounded-md border-l-4 border-amber-400 bg-amber-50/70 px-3 py-2 font-[family-name:var(--font-reading)] text-[16px] leading-relaxed"
        >
          {m.text}
        </li>
      ))}
    </ul>
  );
}

function ChapterNotes({
  chapter,
  number,
  markings,
  notes,
  isLast,
  revisiting,
  onNotes,
  onDone,
  onBack,
}: {
  chapter: Chapter;
  number: number;
  markings: Marking[];
  notes: string;
  isLast: boolean;
  revisiting: boolean;
  onNotes: (text: string) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-md border border-border/70 bg-card/90 px-5 py-5 shadow-sm sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Kapittel {number} · notater
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-reading)] text-2xl leading-tight">{chapter.title}</h2>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <EyeOff className="size-3.5" />
          Teksten er skjult. Dette er det du markerte:
        </p>
        <div className="mt-4">
          <MarkingList markings={markings} />
        </div>
      </section>

      <section className="rounded-md border border-border/70 bg-card/90 px-5 py-5 shadow-sm sm:px-8">
        <label htmlFor="kapittel-notater" className="text-sm font-medium">
          Notatene dine
        </label>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Skriv så utfyllende du klarer, med egne ord. Forklar begrepene, hvorfor de henger sammen og
          eksemplene du husker.
        </p>
        <textarea
          id="kapittel-notater"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          rows={12}
          placeholder="Hva handlet kapitlet om?"
          className={`${fieldClass} mt-3`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {notes.split(/\s+/).filter(Boolean).length} ord
          </span>
          {revisiting ? (
            <Button type="button" variant="outline" onClick={onBack}>
              Tilbake til der du var
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button type="button" disabled={notes.trim().length === 0} onClick={onDone}>
              {isLast ? "Gå til oppsummeringen" : "Neste kapittel"}
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryStep({
  title,
  chapters,
  progress,
  revisiting,
  onSummary,
  onDone,
  onBack,
}: {
  title: string;
  chapters: Chapter[];
  progress: LessonProgress;
  revisiting: boolean;
  onSummary: (text: string) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-md border border-border/70 bg-card/90 px-5 py-5 shadow-sm sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Oppsummering
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-reading)] text-2xl leading-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Skriv din egen oppsummering av hele leksjonen. Prøv først uten å se på notatene: hva er de
          viktigste poengene, og hvordan henger kapitlene sammen?
        </p>
        <textarea
          value={progress.summary}
          onChange={(e) => onSummary(e.target.value)}
          rows={14}
          placeholder="Leksjonen handler om …"
          aria-label="Oppsummeringen din"
          className={`${fieldClass} mt-4`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <BookText className="size-3.5" />
            {showNotes ? "Skjul notatene mine" : "Vis notatene mine"}
          </button>
          {revisiting ? (
            <Button type="button" variant="outline" onClick={onBack}>
              Tilbake til øvingen
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button type="button" disabled={progress.summary.trim().length === 0} onClick={onDone}>
              Ferdig, gå til øving
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      </section>

      {showNotes ? (
        <section className="flex flex-col gap-3">
          {chapters.map((c, i) => (
            <div key={c.id} className="rounded-md border border-border/70 bg-card/80 px-5 py-4 shadow-sm">
              <p className="font-medium">
                {i + 1}. {c.title}
              </p>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground/85">
                {progress.notes[i]?.trim() || "Ingen notater."}
              </p>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function PracticeStep({
  item,
  studySet,
  tools,
}: {
  item: LibraryItem;
  studySet?: StudySet;
  tools: SubjectTool[];
}) {
  const options = [
    ...(studySet ? PRACTICE : []),
    ...(tools.length
      ? [{ id: "tools" as const, label: tools.length === 1 ? tools[0].title : "Øvinger", icon: Calculator }]
      : []),
  ];
  const [active, setActive] = useState<PracticeId | null>(options[0]?.id ?? null);

  if (options.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border/80 px-6 py-10 text-center text-sm text-muted-foreground">
        Det finnes ingen øvingssett for denne leksjonen ennå.
      </p>
    );
  }

  const sets = studySet ? [studySet] : [];
  const key = `${item.id}:${active}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Øvingsmetode">
        {options.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
              active === id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border/70 bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {active === "quiz" ? <QuizView key={key} sets={sets} /> : null}
      {active === "recall" ? <RecallView key={key} sets={sets} /> : null}
      {active === "match" ? <MatchView key={key} sets={sets} /> : null}
      {active === "kahoot" ? <KahootView key={key} sets={sets} /> : null}
      {active === "flashcards" ? <FlashcardsView key={key} sets={sets} /> : null}
      {active === "typing" ? <TypingView key={key} sets={sets} /> : null}
      {active === "tools" ? <ToolsView tools={tools} /> : null}
    </div>
  );
}
