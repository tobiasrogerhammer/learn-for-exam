"use client";

import { CheckCircle2, Headphones, Layers, NotebookPen } from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import { listenedLabel, listenedShare } from "@/lib/audiobook";
import { getLessonProgress } from "@/lib/lesson-flow";
import { CATEGORIES, categoryOf, chapterCount } from "@/lib/library";
import type { LibraryItem, ListenPosition } from "@/lib/types";

type Props = {
  items: LibraryItem[];
  /** Document ids that have practice material */
  withStudySet: Set<string>;
  positions: Record<string, ListenPosition>;
  onSelect: (id: string) => void;
};

/** What a subject contains, shown in Pensum until you pick a document */
export function SubjectOverview({ items, withStudySet, positions, onSelect }: Props) {
  const groups = CATEGORIES.map((c) => ({
    ...c,
    items: items
      .filter((x) => categoryOf(x) === c.id)
      .sort((a, b) => a.title.localeCompare(b.title, "nb", { numeric: true })),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.id} aria-label={group.label}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium">
            {group.label}
            <span className="rounded-sm bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
              {group.items.length}
            </span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="flex h-full w-full items-start gap-2.5 rounded-md border border-border/60 bg-card/80 px-3.5 py-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-muted/50"
                >
                  <SourceIcon type={item.sourceType} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words font-medium">{item.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{chapterCount(item)} kapitler</span>
                      <FlowLabel item={item} />
                      {item.audiobook ? (
                        <span className="flex items-center gap-1 text-teal-700">
                          <Headphones className="size-3" aria-hidden />
                          Lydbok, {Math.round(item.audiobook.durationSec / 60)} min
                          {listenedShare(positions[item.id]) > 0
                            ? ` · ${listenedLabel(positions[item.id]).toLowerCase()}`
                            : ""}
                        </span>
                      ) : null}
                      {withStudySet.has(item.id) ? (
                        <span className="flex items-center gap-1">
                          <Layers className="size-3" aria-hidden />
                          Øvingssett
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** How far you are in the lesson's fixed order of reading, notes and summary */
function FlowLabel({ item }: { item: LibraryItem }) {
  const progress = getLessonProgress(item.id);
  const total = chapterCount(item);
  if (progress.summaryDone) {
    return (
      <span className="flex items-center gap-1 text-primary">
        <CheckCircle2 className="size-3" aria-hidden />
        Klar for øving
      </span>
    );
  }
  if (progress.done.length === 0 && progress.read.length === 0) return null;
  return (
    <span className="flex items-center gap-1 text-foreground/80">
      <NotebookPen className="size-3" aria-hidden />
      {progress.done.length >= total ? "Mangler oppsummering" : `${progress.done.length} av ${total} kapitler gjennomgått`}
    </span>
  );
}
