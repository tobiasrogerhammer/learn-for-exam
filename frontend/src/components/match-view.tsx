"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Timer } from "lucide-react";
import { EmptyState } from "@/components/flashcards-view";
import { Button } from "@/components/ui/button";
import { recordAnswer } from "@/lib/practice";
import { shuffle } from "@/lib/study";
import type { Flashcard, StudySet } from "@/lib/types";

type Props = {
  sets: StudySet[];
};

const PAIRS = 6;

type Board = {
  cards: Flashcard[];
  /** The explanations in a different order than the terms */
  right: Flashcard[];
  startedAt: number;
};

function formatSeconds(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Koble sammen: match each term with its explanation, against the clock */
export function MatchView({ sets }: Props) {
  const cards = useMemo(() => sets.flatMap((s) => s.flashcards), [sets]);
  const [board, setBoard] = useState<Board | null>(null);
  const [leftPick, setLeftPick] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);

  const done = !!board && matched.size === board.cards.length;

  useEffect(() => {
    if (!board || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [board, done]);

  if (cards.length < 2) {
    return <EmptyState text="Det trengs minst to flashcards for å koble sammen. Lag øvingsmateriale under Pensum." />;
  }

  const start = () => {
    const picked = shuffle(cards).slice(0, PAIRS);
    const startedAt = Date.now();
    setBoard({ cards: picked, right: shuffle(picked), startedAt });
    setLeftPick(null);
    setMatched(new Set());
    setMissed(new Set());
    setMistakes(0);
    setFinishedAt(null);
    setNow(startedAt);
  };

  if (!board) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-2xl">Koble sammen</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Velg et begrep til venstre og forklaringen som hører til, til høyre. {PAIRS} par per
          runde, på tid.
        </p>
        <Button type="button" className="mt-5" onClick={start}>
          Start
        </Button>
      </section>
    );
  }

  const pickRight = (card: Flashcard) => {
    if (!leftPick || matched.has(card.id)) return;
    const left = board.cards.find((c) => c.id === leftPick)!;
    if (card.id === leftPick) {
      const next = new Set(matched).add(card.id);
      setMatched(next);
      // A pair found at the first try counts as known; after a miss, as half known
      recordAnswer(left.id, left.section, "match", missed.has(left.id) ? 0.5 : 1);
      setLeftPick(null);
      if (next.size === board.cards.length) setFinishedAt(now);
    } else {
      setMistakes((m) => m + 1);
      setMissed((s) => new Set(s).add(left.id));
      setFlash(card.id);
      window.setTimeout(() => setFlash(null), 500);
    }
  };

  const elapsed = (finishedAt ?? now) - board.startedAt;

  const tile = (active: boolean, isMatched: boolean, isFlash: boolean) =>
    `w-full rounded-md border px-3 py-2.5 text-left text-sm leading-snug transition ${
      isMatched
        ? "border-teal-600/40 bg-teal-50 text-teal-900 opacity-60"
        : isFlash
          ? "border-destructive/60 bg-destructive/10"
          : active
            ? "border-primary bg-primary/10"
            : "border-border/70 bg-card hover:border-primary/50 hover:bg-muted/50"
    }`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Timer className="size-4" />
          {formatSeconds(elapsed)}
        </span>
        <span>
          {matched.size}/{board.cards.length} par · {mistakes} feil
        </span>
      </div>

      {done ? (
        <div className="rounded-md border border-teal-600/40 bg-teal-50 p-5 text-center text-teal-950">
          <p className="font-[family-name:var(--font-reading)] text-2xl">
            Ferdig på {formatSeconds(elapsed)}
          </p>
          <p className="mt-1 text-sm">
            {mistakes === 0 ? "Ingen feil." : `${mistakes} feil underveis.`}
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={start}>
            <RotateCcw className="size-3.5" />
            Ny runde
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[2fr_3fr]">
        <ul className="space-y-2" aria-label="Begreper">
          {board.cards.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={matched.has(c.id)}
                onClick={() => setLeftPick(c.id)}
                aria-pressed={leftPick === c.id}
                className={tile(leftPick === c.id, matched.has(c.id), false)}
              >
                <span className="font-medium">{c.front}</span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="space-y-2" aria-label="Forklaringer">
          {board.right.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={matched.has(c.id) || !leftPick}
                onClick={() => pickRight(c)}
                className={tile(false, matched.has(c.id), flash === c.id)}
              >
                <span className="line-clamp-4">{c.back}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {!leftPick && !done ? (
        <p className="text-center text-xs text-muted-foreground">Velg et begrep først.</p>
      ) : null}
    </section>
  );
}
