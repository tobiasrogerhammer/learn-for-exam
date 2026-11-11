"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/flashcards-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { recordAnswer } from "@/lib/practice";
import { getRecallScores, saveRecallScore } from "@/lib/study";
import type { RecallPrompt, StudySet } from "@/lib/types";

type Props = {
  sets: StudySet[];
};

/** Never-tried prompts first, then the ones you covered least of last time */
function orderByWeakest(prompts: RecallPrompt[]): RecallPrompt[] {
  const scores = getRecallScores();
  const rank = (p: RecallPrompt) => {
    const s = scores[p.id];
    return s ? s.covered / Math.max(s.total, 1) : -1;
  };
  return [...prompts].sort((a, b) => rank(a) - rank(b));
}

export function RecallView({ sets }: Props) {
  const prompts = useMemo(() => sets.flatMap((s) => s.recall), [sets]);
  const [order, setOrder] = useState<RecallPrompt[]>(() =>
    orderByWeakest(sets.flatMap((s) => s.recall)),
  );
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const reset = () => {
    setAnswer("");
    setRevealed(false);
    setChecked(new Set());
  };

  if (prompts.length === 0) {
    return <EmptyState text="Ingen gjenkallingsspørsmål ennå. Lag øvingsmateriale for et dokument under Pensum." />;
  }

  const prompt = order[index];
  if (!prompt) return null;
  const lastScore = getRecallScores()[prompt.id];

  const next = () => {
    if (revealed) {
      saveRecallScore(prompt.id, {
        covered: checked.size,
        total: prompt.keyPoints.length,
        at: new Date().toISOString(),
      });
      recordAnswer(
        prompt.id,
        prompt.section,
        "recall",
        prompt.keyPoints.length ? checked.size / prompt.keyPoints.length : 0,
      );
    }
    reset();
    if (index + 1 < order.length) {
      setIndex(index + 1);
    } else {
      setOrder(orderByWeakest(prompts));
      setIndex(0);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-border/70 bg-card/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {index + 1}/{order.length}
          </Badge>
          {prompt.section ? <Badge variant="secondary">{prompt.section}</Badge> : null}
          {lastScore ? (
            <span className="ml-auto text-xs text-muted-foreground">
              Sist: {lastScore.covered}/{lastScore.total} punkter
            </span>
          ) : null}
        </div>
        <p className="mt-4 font-[family-name:var(--font-reading)] text-2xl leading-snug">
          {prompt.prompt}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Forklar med egne ord før du ser fasiten. Skriv, eller si det høyt.
        </p>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={7}
          placeholder="Det jeg husker om dette…"
          className="mt-4 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-[family-name:var(--font-reading)] text-[15px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />

        {!revealed ? (
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={next}>
              Hopp over
            </Button>
            <Button type="button" onClick={() => setRevealed(true)}>
              Vis nøkkelpunkter
            </Button>
          </div>
        ) : (
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="text-sm font-medium">
              Kryss av punktene du fikk med
            </p>
            <ul className="mt-3 space-y-2">
              {prompt.keyPoints.map((point, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 px-3 py-2 text-[15px] hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className="mt-1 size-3.5 accent-primary"
                      checked={checked.has(i)}
                      onChange={(e) => {
                        const nextSet = new Set(checked);
                        if (e.target.checked) nextSet.add(i);
                        else nextSet.delete(i);
                        setChecked(nextSet);
                      }}
                    />
                    <span>{point}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-sm tabular-nums text-muted-foreground">
                {checked.size}/{prompt.keyPoints.length} punkter
              </span>
              <Button type="button" onClick={next}>
                Lagre og neste
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
