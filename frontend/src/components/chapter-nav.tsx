"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import type { Section } from "@/lib/types";

type Props = {
  sections: Section[];
  activeId?: string | null;
  /** Chapter that contains the currently spoken sentence */
  spokenId?: string | null;
  /** Absolute start time in seconds per section id */
  startTimesBySectionId?: Record<string, number>;
  onSelect: (sectionId: string) => void;
  /** Current spoken sentence — highlighted inside the open chapter */
  highlightText?: string | null;
  /** Scroll highlighted sentence into view while listening */
  autoScrollHighlight?: boolean;
};

function formatStartTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SENTENCE_RE = /[^.!?…]+(?:[.!?…]+(?:["»”']?)?|$)/g;

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  return (normalized.match(SENTENCE_RE) ?? [normalized])
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeMatch(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function ChapterNav({
  sections,
  activeId,
  spokenId,
  startTimesBySectionId,
  onSelect,
  highlightText,
  autoScrollHighlight = false,
}: Props) {
  const highlightRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!autoScrollHighlight) return;
    highlightRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [highlightText, activeId, autoScrollHighlight]);

  return (
    <div className="min-w-0">
      <nav>
        <ol className="space-y-2">
          {sections.map((section, i) => {
            const open = section.id === activeId;
            const spoken = !!spokenId && section.id === spokenId;
            const startSec = startTimesBySectionId?.[section.id];
            const sentences = open ? splitSentences(section.text) : [];
            const highlightNorm = highlightText
              ? normalizeMatch(highlightText)
              : "";

            return (
              <li
                key={section.id}
                className={`overflow-hidden rounded-md border transition ${
                  spoken
                    ? "border-teal-500/70 bg-teal-50/80 ring-1 ring-teal-500/30"
                    : open
                      ? "border-primary/40 bg-primary/[0.06]"
                      : "border-border/60 bg-background/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(section.id)}
                  aria-expanded={open}
                  aria-current={spoken ? "true" : undefined}
                  className={`flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50 ${
                    spoken ? "bg-teal-100/50" : ""
                  }`}
                  style={{
                    paddingLeft: `${0.75 + (section.level - 1) * 0.75}rem`,
                  }}
                >
                  <span
                    className={`mt-0.5 min-w-[1.25rem] text-[0.7rem] tabular-nums ${
                      spoken
                        ? "font-semibold text-teal-800"
                        : "text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm leading-snug ${
                        spoken
                          ? "font-semibold text-teal-950"
                          : "font-medium"
                      }`}
                    >
                      {section.title}
                    </span>
                  </span>
                  {typeof startSec === "number" ? (
                    <span
                      className={`mt-0.5 shrink-0 text-[0.7rem] tabular-nums ${
                        spoken ? "text-teal-800" : "text-muted-foreground"
                      }`}
                    >
                      {formatStartTime(startSec)}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={`mt-0.5 size-4 shrink-0 transition-transform ${
                      spoken ? "text-teal-700" : "text-muted-foreground"
                    } ${open ? "rotate-180" : ""}`}
                  />
                </button>

                {open ? (
                  <div className="border-t border-border/50 px-3 pb-3 pt-2 sm:px-4">
                    <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Lesestykke
                    </p>
                    {sentences.length === 0 ? (
                      <p className="font-[family-name:var(--font-reading)] text-[1.02rem] leading-8 text-muted-foreground">
                        Ingen tekst i dette kapittelet.
                      </p>
                    ) : (
                      <div className="break-words font-[family-name:var(--font-reading)] text-[1.02rem] leading-8 text-foreground/90">
                        {sentences.map((sentence, si) => {
                          const isCurrent =
                            !!highlightNorm &&
                            normalizeMatch(sentence) === highlightNorm;
                          return (
                            <span key={`${section.id}-${si}`}>
                              {isCurrent ? (
                                <mark
                                  ref={highlightRef}
                                  className="rounded-sm bg-teal-200/90 px-0.5 text-teal-950 shadow-[inset_0_-1px_0_rgba(13,148,136,0.35)]"
                                >
                                  {sentence}
                                </mark>
                              ) : (
                                <span>{sentence}</span>
                              )}{" "}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
