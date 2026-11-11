"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  getReviews,
  isDue,
  saveReview,
  scheduleReview,
  shuffle,
} from "@/lib/study";
import { recordAnswer } from "@/lib/practice";
import type { Flashcard, ReviewGrade, StudySet } from "@/lib/types";

type Props = {
  sets: StudySet[];
};

/** How well you knew the card, for the progress overview */
const GRADE_SCORE: Record<ReviewGrade, number> = { again: 0, hard: 0.5, good: 0.85, easy: 1 };

const GRADES: { grade: ReviewGrade; label: string; key: string }[] = [
  { grade: "again", label: "Igjen", key: "1" },
  { grade: "hard", label: "Vanskelig", key: "2" },
  { grade: "good", label: "Bra", key: "3" },
  { grade: "easy", label: "Lett", key: "4" },
];

export function FlashcardsView({ sets }: Props) {
  const cards = useMemo(() => sets.flatMap((s) => s.flashcards), [sets]);
  const titleBySet = useMemo(() => {
    const map = new Map<string, string>();
    sets.forEach((s) => s.flashcards.forEach((c) => map.set(c.id, s.documentTitle)));
    return map;
  }, [sets]);

  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [reviewsVersion, setReviewsVersion] = useState(0);

  const dueCount = useMemo(() => {
    void reviewsVersion;
    const reviews = getReviews();
    return cards.filter((c) => isDue(reviews[c.id])).length;
  }, [cards, reviewsVersion]);

  const start = (all: boolean) => {
    const reviews = getReviews();
    const picked = all ? cards : cards.filter((c) => isDue(reviews[c.id]));
    setQueue(shuffle(picked));
    setDone(0);
    setFlipped(false);
  };

  const card = queue?.[0];

  const grade = useCallback(
    (g: ReviewGrade) => {
      if (!card || !queue) return;
      saveReview(scheduleReview(card.id, g, getReviews()[card.id]));
      recordAnswer(card.id, card.section, "flashcards", GRADE_SCORE[g]);
      setReviewsVersion((v) => v + 1);
      setFlipped(false);
      if (g === "again") {
        setQueue([...queue.slice(1), card]);
      } else {
        setQueue(queue.slice(1));
        setDone((d) => d + 1);
      }
    },
    [card, queue],
  );

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      const match = GRADES.find((g) => g.key === e.key);
      if (match && flipped) grade(match.grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, grade]);

  if (cards.length === 0) {
    return <EmptyState text="Ingen flashcards ennå. Lag øvingsmateriale for et dokument under Pensum." />;
  }

  if (!queue) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-2xl">Flashcards</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {cards.length} kort · {dueCount} til repetisjon nå
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => start(false)} disabled={dueCount === 0}>
            Repeter {dueCount} kort
          </Button>
          <Button type="button" variant="outline" onClick={() => start(true)}>
            Øv på alle
          </Button>
        </div>
        {dueCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Ingen kort forfaller nå. Kom tilbake senere, eller øv på alle.
          </p>
        ) : null}
      </section>
    );
  }

  if (!card) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-2xl">Ferdig for nå</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Du gikk gjennom {done} kort. Neste repetisjon planlegges automatisk.
        </p>
        <Button type="button" className="mt-5" variant="outline" onClick={() => setQueue(null)}>
          <RotateCcw className="size-3.5" />
          Tilbake
        </Button>
      </section>
    );
  }

  const total = done + queue.length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={total ? (done / total) * 100 : 0} className="flex-1" />
        <span className="text-sm tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="block min-h-64 w-full rounded-md border border-border/70 bg-card/90 p-6 text-left shadow-sm transition hover:border-primary/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{flipped ? "Svar" : "Spørsmål"}</Badge>
          {card.section ? <Badge variant="secondary">{card.section}</Badge> : null}
          <span className="ml-auto truncate text-xs text-muted-foreground">
            {titleBySet.get(card.id)}
          </span>
        </div>
        <p className="mt-5 font-[family-name:var(--font-reading)] text-2xl leading-snug">
          {card.front}
        </p>
        {flipped ? (
          <p className="mt-5 whitespace-pre-line border-t border-border/60 pt-5 font-[family-name:var(--font-reading)] text-lg leading-relaxed text-foreground/90">
            {card.back}
          </p>
        ) : (
          <p className="mt-8 text-sm text-muted-foreground">
            Tenk på svaret, så klikk eller trykk mellomrom for å snu.
          </p>
        )}
      </button>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <Button
              key={g.grade}
              type="button"
              variant={g.grade === "again" ? "destructive" : g.grade === "good" ? "default" : "outline"}
              onClick={() => grade(g.grade)}
            >
              {g.label}
              <span className="text-xs opacity-60">{g.key}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <section className="rounded-md border border-dashed border-border/80 bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
      {text}
    </section>
  );
}
