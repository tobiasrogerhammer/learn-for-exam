"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/flashcards-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { recordAnswer } from "@/lib/practice";
import { shuffle } from "@/lib/study";
import type { Flashcard, StudySet } from "@/lib/types";

type Props = {
  sets: StudySet[];
};

const STOP_WORDS = new Set(
  "og i på av for med til som er det den de en et at å har kan om fra ved eller når ikke må skal vi man seg sin sitt sine hva".split(" "),
);

function keyWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)];
}

/** Which of the answer's key words you used, as a hint before you grade yourself */
function compare(typed: string, answer: string) {
  const wanted = keyWords(answer);
  const have = new Set(keyWords(typed));
  // Accept word forms that share the first five letters, e.g. «kostnader» and «kostnaden»
  const found = wanted.filter(
    (w) => have.has(w) || [...have].some((h) => h.slice(0, 5) === w.slice(0, 5) && w.length > 5),
  );
  return { found: found.length, total: wanted.length };
}

const SELF_GRADES = [
  { label: "Feil", score: 0, variant: "outline" as const },
  { label: "Delvis", score: 0.5, variant: "outline" as const },
  { label: "Riktig", score: 1, variant: "default" as const },
];

/** Skriv svaret: answer a flashcard in your own words, then compare with the answer */
export function TypingView({ sets }: Props) {
  const cards = useMemo(() => sets.flatMap((s) => s.flashcards), [sets]);
  const [round, setRound] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [checked, setChecked] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [size, setSize] = useState(10);

  if (cards.length === 0) {
    return <EmptyState text="Ingen flashcards ennå. Lag øvingsmateriale for et dokument under Pensum." />;
  }

  const start = () => {
    const pool = shuffle(cards);
    setRound(size ? pool.slice(0, size) : pool);
    setIndex(0);
    setTyped("");
    setChecked(false);
    setScores([]);
  };

  if (!round) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-2xl">Skriv svaret</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Du får spørsmålet fra et flashcard og skriver svaret med egne ord. Så ser du fasit og
          vurderer selv hvor godt du svarte.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Antall
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>Alle ({cards.length})</option>
            </select>
          </label>
          <Button type="button" onClick={start}>
            Start
          </Button>
        </div>
      </section>
    );
  }

  const card = round[index];

  if (!card) {
    const total = scores.reduce((a, b) => a + b, 0);
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-4xl tabular-nums">
          {Math.round((total / round.length) * 100)} %
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {scores.filter((s) => s === 1).length} riktige, {scores.filter((s) => s === 0.5).length}{" "}
          delvis og {scores.filter((s) => s === 0).length} feil av {round.length}
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => setRound(null)}>
          <RotateCcw className="size-3.5" />
          Ny runde
        </Button>
      </section>
    );
  }

  const hint = checked ? compare(typed, card.back) : null;

  const grade = (score: number) => {
    recordAnswer(card.id, card.section, "typing", score);
    setScores((s) => [...s, score]);
    setIndex((i) => i + 1);
    setTyped("");
    setChecked(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={(index / round.length) * 100} className="flex-1" />
        <span className="text-sm tabular-nums text-muted-foreground">
          {index + 1}/{round.length}
        </span>
      </div>

      <div className="rounded-md border border-border/70 bg-card/90 p-6 shadow-sm">
        {card.section ? <Badge variant="secondary">{card.section}</Badge> : null}
        <p className="mt-3 whitespace-pre-line font-[family-name:var(--font-reading)] text-xl leading-snug">
          {card.front}
        </p>
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={checked}
          rows={4}
          placeholder="Skriv svaret ditt her"
          className="mt-4 w-full rounded-md border border-border bg-background px-3 py-2 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-80"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !checked) setChecked(true);
          }}
        />

        {!checked ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Cmd/Ctrl + Enter for å sjekke</span>
            <Button type="button" onClick={() => setChecked(true)}>
              <Check className="size-3.5" />
              Sjekk svaret
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-md border border-teal-600/40 bg-teal-50 px-4 py-3 text-teal-950">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-teal-800">Fasit</p>
              <p className="mt-1 whitespace-pre-line font-[family-name:var(--font-reading)] leading-relaxed">
                {card.back}
              </p>
            </div>
            {hint && hint.total > 0 ? (
              <p className="text-sm text-muted-foreground">
                Du brukte {hint.found} av {hint.total} nøkkelord fra fasiten. Vurder selv om du
                fikk med poenget.
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {SELF_GRADES.map((g) => (
                <Button key={g.label} type="button" variant={g.variant} onClick={() => grade(g.score)}>
                  {g.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
