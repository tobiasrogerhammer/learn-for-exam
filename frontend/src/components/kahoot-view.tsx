"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Diamond, Flame, RotateCcw, Square, Triangle, Trophy } from "lucide-react";
import { EmptyState } from "@/components/flashcards-view";
import { Button } from "@/components/ui/button";
import { recordAnswer } from "@/lib/practice";
import { readKey, writeKey } from "@/lib/storage";
import { shuffle } from "@/lib/study";
import type { QuizQuestion, StudySet } from "@/lib/types";

type Props = {
  sets: StudySet[];
};

const SECONDS = 20;
const BEST_KEY = "learn-for-exam:kahoot-best:v1";

// The four answer tiles, each with its own color and shape
const TILES = [
  { color: "bg-rose-600 hover:bg-rose-700", icon: Triangle },
  { color: "bg-blue-600 hover:bg-blue-700", icon: Diamond },
  { color: "bg-amber-500 hover:bg-amber-600", icon: Circle },
  { color: "bg-emerald-600 hover:bg-emerald-700", icon: Square },
];

type Round = QuizQuestion & { order: number[] };

function prepare(questions: QuizQuestion[]): Round[] {
  return questions.map((q) => {
    const order = shuffle(q.options.map((_, i) => i)).slice(0, 4);
    if (!order.includes(q.answerIndex)) order[order.length - 1] = q.answerIndex;
    const mixed = shuffle(order);
    return {
      ...q,
      order: mixed,
      options: mixed.map((i) => q.options[i]),
      answerIndex: mixed.indexOf(q.answerIndex),
    };
  });
}

/** Points like in Kahoot: faster right answers give more, and a streak adds a bonus */
function pointsFor(correct: boolean, secondsLeft: number, streak: number) {
  if (!correct) return 0;
  const speed = Math.round(500 + 500 * (secondsLeft / SECONDS));
  return speed + Math.min(500, 100 * Math.max(0, streak - 1));
}

/** Kahoot: quick multiple choice with a clock, points for speed and streaks */
export function KahootView({ sets }: Props) {
  const questions = useMemo(() => sets.flatMap((s) => s.quiz), [sets]);
  const scope = useMemo(
    () => sets.map((s) => s.documentId).sort().join(",") || "alle",
    [sets],
  );
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(SECONDS);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastPoints, setLastPoints] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [size, setSize] = useState(10);
  const [best, setBest] = useState(() => readKey<Record<string, number>>(BEST_KEY, {})[scope] ?? 0);
  const [newBest, setNewBest] = useState(false);
  const startedAt = useRef(0);

  const round = rounds?.[index];
  const answered = picked !== null;

  const answer = (i: number | -1) => {
    if (!round || answered) return;
    const secondsLeft = Math.max(0, SECONDS - (Date.now() - startedAt.current) / 1000);
    const correct = i === round.answerIndex;
    const nextStreak = correct ? streak + 1 : 0;
    const points = pointsFor(correct, secondsLeft, nextStreak);
    setPicked(i);
    setStreak(nextStreak);
    setLastPoints(points);
    setScore((s) => s + points);
    if (correct) setCorrectCount((c) => c + 1);
    recordAnswer(round.id, round.section, "kahoot", correct ? 1 : 0);
  };

  // The clock runs until you answer; time out counts as wrong
  useEffect(() => {
    if (!round || answered) return;
    const id = window.setInterval(() => {
      const remaining = SECONDS - (Date.now() - startedAt.current) / 1000;
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) answer(-1);
    }, 100);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, answered]);

  if (questions.length === 0) {
    return <EmptyState text="Ingen quizspørsmål ennå. Lag øvingsmateriale for et dokument under Pensum." />;
  }

  const begin = () => {
    const pool = shuffle(questions);
    setRounds(prepare(size ? pool.slice(0, size) : pool));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setNewBest(false);
    setLeft(SECONDS);
    startedAt.current = Date.now();
  };

  const next = () => {
    if (rounds && index + 1 >= rounds.length && score > best) {
      writeKey(BEST_KEY, { ...readKey<Record<string, number>>(BEST_KEY, {}), [scope]: score });
      setBest(score);
      setNewBest(true);
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setLeft(SECONDS);
    startedAt.current = Date.now();
  };

  if (!rounds) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-2xl">Kahoot</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Svar så raskt du kan. Du har {SECONDS} sekunder per spørsmål, og raske riktige svar og
          lange rekker gir flere poeng.
        </p>
        {best > 0 ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <Trophy className="size-4 text-amber-500" />
            Din beste her: {best.toLocaleString("nb-NO")} poeng
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Spørsmål
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
              <option value={0}>Alle ({questions.length})</option>
            </select>
          </label>
          <Button type="button" onClick={begin}>
            Start
          </Button>
        </div>
      </section>
    );
  }

  if (!round) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <Trophy className="mx-auto size-8 text-amber-500" />
        <p className="mt-2 font-[family-name:var(--font-reading)] text-4xl tabular-nums">
          {score.toLocaleString("nb-NO")} poeng
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {correctCount} av {rounds.length} riktige
          {newBest ? " · ny rekord!" : best ? ` · rekord ${best.toLocaleString("nb-NO")}` : ""}
        </p>
        <Button type="button" variant="outline" className="mt-5" onClick={() => setRounds(null)}>
          <RotateCcw className="size-3.5" />
          Spill igjen
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="tabular-nums text-muted-foreground">
          {index + 1}/{rounds.length}
        </span>
        <span className="flex items-center gap-3">
          {streak > 1 ? (
            <span className="flex items-center gap-1 text-orange-600">
              <Flame className="size-4" />
              {streak} på rad
            </span>
          ) : null}
          <span className="font-semibold tabular-nums">{score.toLocaleString("nb-NO")} poeng</span>
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${left < 5 ? "bg-rose-500" : "bg-primary"}`}
          style={{ width: `${(left / SECONDS) * 100}%` }}
        />
      </div>

      <div className="rounded-md border border-border/70 bg-card/90 p-6 text-center shadow-sm">
        <p className="whitespace-pre-line font-[family-name:var(--font-reading)] text-2xl leading-snug">
          {round.question}
        </p>
        <p className="mt-2 text-sm tabular-nums text-muted-foreground">
          {answered ? (picked === -1 ? "Tiden er ute" : "") : `${Math.ceil(left)} s`}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {round.options.map((option, i) => {
          const { color, icon: Icon } = TILES[i % TILES.length];
          const isAnswer = i === round.answerIndex;
          const faded = answered && !isAnswer;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={answered}
                onClick={() => answer(i)}
                className={`flex h-full min-h-20 w-full items-center gap-3 rounded-md px-4 py-3 text-left font-medium text-white shadow-sm transition ${color} ${
                  faded ? "opacity-30" : ""
                } ${answered && isAnswer ? "ring-4 ring-teal-400 ring-offset-2" : ""}`}
              >
                <Icon className="size-6 shrink-0 fill-white/90" aria-hidden />
                <span>{option}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {answered ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card/80 px-4 py-3">
          <p className={picked === round.answerIndex ? "text-teal-800" : "text-destructive"}>
            {picked === round.answerIndex
              ? `Riktig! +${lastPoints.toLocaleString("nb-NO")} poeng`
              : `Feil. Riktig svar: ${round.options[round.answerIndex]}`}
          </p>
          <Button type="button" onClick={next}>
            {index + 1 < rounds.length ? "Neste" : "Se resultat"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
