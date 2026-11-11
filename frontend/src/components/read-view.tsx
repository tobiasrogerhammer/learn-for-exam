"use client";

import { useMemo, useRef } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, ChevronDown, ListTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toChapters } from "@/lib/lesson-flow";
import { wordCount } from "@/lib/library";
import type { LibraryItem } from "@/lib/types";

type Props = {
  item: LibraryItem;
};

/**
 * Extracted text keeps the line breaks from the source. PDFs break mid-sentence,
 * so a line is joined with the next one when it doesn't end a sentence and the
 * next one starts in lowercase.
 */
function toParagraphs(text: string): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev && !/[.!?:;»"”)]$/.test(prev) && /^[a-zæøå(]/.test(line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

export const markdownComponents: Components = {
  h3: ({ children }) => <h4 className="mt-5 mb-2 text-lg font-semibold leading-snug">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-4 mb-1.5 font-semibold">{children}</h5>,
  p: ({ children }) => <p className="my-3">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-md border-l-4 border-primary/40 bg-muted/40 px-4 py-2">
      {children}
    </blockquote>
  ),
  section: ({ children, ...props }) => (
    <section {...props} className="mt-6 border-t border-border/60 pt-3 text-sm text-muted-foreground [&_h2]:sr-only">
      {children}
    </section>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-md border border-border/70">
      <table className="w-full border-collapse font-sans text-[15px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
  th: ({ children, style }) => (
    <th style={style} className="border-b border-border/70 px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border-b border-border/40 px-3 py-1.5 align-top tabular-nums">
      {children}
    </td>
  ),
};

export const footnoteLabels = { footnoteLabel: "Fotnoter", footnoteBackLabel: "Tilbake til teksten" };

export function ReadView({ item }: Props) {
  const reading = item.reading?.markdown ?? null;
  const markdown = useMemo(() => (reading ? toChapters(reading) : null), [reading]);
  const sections = useMemo(
    () =>
      markdown
        ? markdown.chapters.map((c) => ({
            id: c.id,
            title: c.title,
            level: 1,
            anchor: `les-${c.id}`,
            paragraphs: [] as string[],
            body: c.body,
          }))
        : item.document.sections.map((s) => ({
            ...s,
            anchor: `les-${s.id}`,
            paragraphs: toParagraphs(s.text),
            body: null as string | null,
          })),
    [item, markdown],
  );
  const words = useMemo(() => wordCount(item), [item]);

  const tocRef = useRef<HTMLDetailsElement>(null);

  const jump = (anchor: string) => {
    if (tocRef.current) tocRef.current.open = false;
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-3">
      <details
        ref={tocRef}
        className="group sticky top-2 z-10 rounded-md border border-border/70 bg-card/95 shadow-sm backdrop-blur"
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <ListTree className="size-4 text-muted-foreground" />
          Innhold
          <span className="text-xs font-normal text-muted-foreground">
            {sections.length} kapitler
          </span>
          <ChevronDown className="ml-auto size-4 text-muted-foreground transition group-open:rotate-180" />
        </summary>
        <nav aria-label="Innhold" className="border-t border-border/60 px-2 py-2">
          <ol className="max-h-72 overflow-y-auto text-sm sm:columns-2 sm:gap-4">
            {sections.map((s) => (
              <li key={s.id} className="break-inside-avoid">
                <button
                  type="button"
                  onClick={() => jump(s.anchor)}
                  className={`w-full rounded px-2 py-1 text-left text-muted-foreground hover:bg-muted/70 hover:text-foreground ${
                    s.level > 1 ? "pl-5" : "font-medium"
                  }`}
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </details>

      <article className="rounded-md border border-border/70 bg-card/90 px-5 py-6 shadow-sm sm:px-8">
        <h2 className="font-[family-name:var(--font-reading)] text-3xl leading-tight">
          {item.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sections.length} kapitler · {words.toLocaleString("nb-NO")} ord · ca.{" "}
          {Math.max(1, Math.round(words / 200))} min lesing
        </p>

        <div className="mt-6 max-w-3xl space-y-8 font-[family-name:var(--font-reading)] text-[17px] leading-relaxed">
          {markdown?.intro ? (
            <div className="text-foreground/90">
              <Markdown
                remarkPlugins={[remarkGfm]}
                remarkRehypeOptions={footnoteLabels}
                components={markdownComponents}
              >
                {markdown.intro}
              </Markdown>
            </div>
          ) : null}
          {sections.map((s, i) => (
            <section key={s.id} id={s.anchor} className="scroll-mt-16">
              {/* The first section usually repeats the document title */}
              {i > 0 || s.title !== item.title ? (
                <h3
                  className={`mb-3 font-semibold leading-snug ${
                    s.level > 1 ? "text-lg" : "text-xl"
                  }`}
                >
                  {s.title}
                </h3>
              ) : null}
              {s.body !== null ? (
                <div className="text-foreground/90">
                  <Markdown
                remarkPlugins={[remarkGfm]}
                remarkRehypeOptions={footnoteLabels}
                components={markdownComponents}
              >
                    {s.body}
                  </Markdown>
                </div>
              ) : (
                <div className="space-y-3 text-foreground/90">
                  {s.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ArrowUp className="size-3.5" />
            Til toppen
          </Button>
        </div>
      </article>
    </div>
  );
}
