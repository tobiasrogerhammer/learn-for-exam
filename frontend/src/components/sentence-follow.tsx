"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { TimedSentence } from "@/lib/sentences";

/** How many lines of text are shown at a time */
const LINES = 3;

type Props = {
  /** Sentences in the chapter being read, in order */
  sentences: TimedSentence[];
  current: TimedSentence | null;
  /** Playback position, to know how far into the current sentence the voice is */
  currentTime: number;
  active: boolean;
  chapterIndex: number;
  chapterTotal: number;
  chapterTitle: string | null;
  sentenceIndex: number;
  sentenceTotal: number;
};

export function SentenceFollow({
  sentences,
  current,
  currentTime,
  active,
  chapterIndex,
  chapterTotal,
  chapterTitle,
  sentenceIndex,
  sentenceTotal,
}: Props) {
  const [open, setOpen] = useState(true);

  const currentText = active
    ? current?.text?.trim() || null
    : "Trykk spill for å følge setningene som leses opp";

  const textRef = useRef<HTMLDivElement>(null);
  const sentenceRefs = useRef(new Map<number, HTMLElement>());
  const latest = useRef({ current, currentTime });

  // Shows the three lines that hold the word being read, and turns the page
  // once the voice moves past the last of them
  const turnPage = useCallback(() => {
    const text = textRef.current;
    const { current: sentence, currentTime: time } = latest.current;
    if (!text) return;
    const lineHeight = parseFloat(getComputedStyle(text).lineHeight) || 28;
    let line = 0;
    const el = sentence ? sentenceRefs.current.get(sentence.index) : undefined;
    const node = el ? firstTextNode(el) : null;
    if (sentence && node?.textContent) {
      const span = sentence.endSec - sentence.startSec;
      const share = span > 0 ? Math.min(1, Math.max(0, (time - sentence.startSec) / span)) : 0;
      const offset = Math.min(node.textContent.length - 1, Math.floor(share * node.textContent.length));
      const range = document.createRange();
      range.setStart(node, Math.max(0, offset));
      range.setEnd(node, Math.max(0, offset) + 1);
      const top = range.getBoundingClientRect().top - text.getBoundingClientRect().top;
      line = Math.max(0, Math.floor((top + 1) / lineHeight));
    }
    const page = Math.floor(line / LINES);
    text.style.transform = `translateY(-${page * LINES * lineHeight}px)`;
  }, []);

  useLayoutEffect(() => {
    latest.current = { current, currentTime };
    turnPage();
  }, [turnPage, current, currentTime, sentences, open]);

  // Line breaks change with the width
  useEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const observer = new ResizeObserver(() => turnPage());
    observer.observe(text);
    return () => observer.disconnect();
  }, [turnPage, open]);

  // Share of the chapter's playing time, so the bar moves with the voice
  const chapterStart = sentences[0]?.startSec ?? 0;
  const chapterEnd = sentences[sentences.length - 1]?.endSec ?? 0;
  const progress =
    active && chapterEnd > chapterStart
      ? Math.min(1, Math.max(0, (currentTime - chapterStart) / (chapterEnd - chapterStart)))
      : 0;

  return (
    <div className="bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Følg med i teksten
          </span>
          <span className="mt-0.5 block truncate font-[family-name:var(--font-reading)] text-sm text-foreground">
            {chapterTitle || `Kapittel ${chapterIndex} / ${chapterTotal}`}
          </span>
        </span>
        {!open && active && currentText ? (
          <span className="hidden max-w-[50%] truncate rounded-sm bg-teal-100 px-2 py-0.5 text-sm font-medium text-teal-950 sm:block">
            {currentText}
          </span>
        ) : null}
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 sm:px-5">
          <div className="mb-3">
            <div className="flex h-4 flex-wrap items-center gap-x-2 text-xs leading-4 tabular-nums text-muted-foreground">
              <span>
                Kapittel {chapterIndex} / {chapterTotal}
              </span>
              {active && sentenceTotal > 0 ? (
                <>
                  <span className="text-border" aria-hidden>
                    ·
                  </span>
                  <span>
                    Setning {sentenceIndex} / {sentenceTotal}
                  </span>
                </>
              ) : null}
            </div>

            <div
              className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-muted-foreground/10"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresjon i kapittelet"
            >
              <div
                className="h-full rounded-full bg-muted-foreground/35 transition-[width] duration-300 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-md border border-primary/30 bg-background/70 px-4 py-3">
            <div className="h-[5.25rem] overflow-hidden" aria-live="off">
              {active && sentences.length > 0 ? (
                <div
                  ref={textRef}
                  className="break-words font-[family-name:var(--font-reading)] text-lg leading-7 text-foreground/90"
                >
                  {sentences.map((sentence) => (
                    <span key={sentence.index}>
                      {sentence.index === current?.index ? (
                        <mark
                          ref={(el) => setRef(sentenceRefs.current, sentence.index, el)}
                          className="rounded-sm bg-teal-200/90 text-teal-950 shadow-[inset_0_-1px_0_rgba(13,148,136,0.35)] [box-decoration-break:clone]"
                        >
                          {sentence.text.trim()}
                        </mark>
                      ) : (
                        <span ref={(el) => setRef(sentenceRefs.current, sentence.index, el)}>
                          {sentence.text.trim()}
                        </span>
                      )}{" "}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-[family-name:var(--font-reading)] text-lg leading-7 text-muted-foreground">
                  {currentText || "\u00a0"}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function setRef(map: Map<number, HTMLElement>, index: number, el: HTMLElement | null) {
  if (el) map.set(index, el);
  else map.delete(index);
}

function firstTextNode(el: HTMLElement): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  return walker.nextNode() as Text | null;
}
