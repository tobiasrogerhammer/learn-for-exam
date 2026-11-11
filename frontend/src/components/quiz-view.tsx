"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { EmptyState } from "@/components/flashcards-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { recordAnswer } from "@/lib/practice";
import { shuffle } from "@/lib/study";
import type { QuizQuestion, StudySet } from "@/lib/types";

type Props = {
  sets: StudySet[];
};

/** A question with its options shuffled; answerIndex points into the shuffled list */
type Round = QuizQuestion & { order: number[] };

function prepare(questions: QuizQuestion[]): Round[] {
  return shuffle(questions).map((q) => {
    const order = shuffle(q.options.map((_, i) => i));
    return {
      ...q,
      order,
      options: order.map((i) => q.options[i]),
      answerIndex: order.indexOf(q.answerIndex),
    };
  });
}

export function QuizView({ sets }: Props) {
  const questions = useMemo(() => sets.flatMap((s) => s.quiz), [sets]);
  const [rounds, setRounds] = useState<Round[] | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<Round[]>([]);
  const [size, setSize] = useState(10);

  const start = (pool: QuizQuestion[]) => {
    setRounds(prepare(pool));
    setIndex(0);
    setPicked(null);
    setWrong([]);
  };

  if (questions.length === 0) {
    return <EmptyState text="Ingen quizspørsmål ennå. Lag øvingsmateriale for et dokument under Pensum." />;
  }

  if (!rounds) {
    return (
      <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
        <p className="font-[family-name:var(--font-reading)] text-2xl">Quiz</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {questions.length} spørsmål tilgjengelig
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Antall
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            >
              {[5, 10, 20, 40].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>Alle</option>
            </select>
          </label>
          <Button
            type="button"
            onClick={() =>
              start(size ? shuffle(questions).slice(0, size) : questions)
            }
          >
            Start quiz
          </Button>
        </div>
      </section>
    );
  }

  const round = rounds[index];

  if (!round) {
    const correct = rounds.length - wrong.length;
    return (
      <section className="space-y-4">
        <div className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
          <p className="font-[family-name:var(--font-reading)] text-4xl tabular-nums">
            {correct}/{rounds.length}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {Math.round((correct / rounds.length) * 100)} % riktig
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {wrong.length ? (
              <Button type="button" onClick={() => start(wrong.map(unshuffle))}>
                {wrong.length === 1
                  ? "Ta feilen på nytt"
                  : `Ta de ${wrong.length} feilene på nytt`}
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setRounds(null)}>
              <RotateCcw className="size-3.5" />
              Ny quiz
            </Button>
          </div>
        </div>
        {wrong.length ? (
          <div className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Disse bommet du på
            </p>
            <ul className="mt-3 space-y-4">
              {wrong.map((q) => (
                <li key={q.id} className="border-t border-border/60 pt-3 first:border-0 first:pt-0">
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-1 text-sm text-teal-800">
                    Riktig: {q.options[q.answerIndex]}
                  </p>
                  {q.explanation ? (
                    <p className="mt-1 text-sm text-muted-foreground">{q.explanation}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    );
  }

  const answered = picked !== null;

  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    if (i !== round.answerIndex) setWrong((w) => [...w, round]);
    recordAnswer(round.id, round.section, "quiz", i === round.answerIndex ? 1 : 0);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Progress value={(index / rounds.length) * 100} className="flex-1" />
        <span className="text-sm tabular-nums text-muted-foreground">
          {index + 1}/{rounds.length}
        </span>
      </div>

      <div className="rounded-md border border-border/70 bg-card/90 p-6 shadow-sm">
        {round.section ? <Badge variant="secondary">{round.section}</Badge> : null}
        <p className="mt-3 whitespace-pre-line font-[family-name:var(--font-reading)] text-xl leading-snug">
          {round.question}
        </p>
        <ul className="mt-5 space-y-2">
          {round.options.map((option, i) => {
            const isAnswer = i === round.answerIndex;
            const isPicked = i === picked;
            const tone = !answered
              ? "border-border/70 hover:border-primary/50 hover:bg-muted/50"
              : isAnswer
                ? "border-teal-600 bg-teal-50 text-teal-950"
                : isPicked
                  ? "border-destructive/60 bg-destructive/5"
                  : "border-border/50 opacity-60";
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => choose(i)}
                  className={`flex w-full items-start gap-3 rounded-md border px-3.5 py-2.5 text-left text-[15px] transition ${tone}`}
                >
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{option}</span>
                  {answered && isAnswer ? <Check className="size-4 text-teal-700" /> : null}
                  {answered && isPicked && !isAnswer ? (
                    <X className="size-4 text-destructive" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        {answered ? (
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className={`font-medium ${picked === round.answerIndex ? "text-teal-800" : "text-destructive"}`}>
              {picked === round.answerIndex ? "Riktig!" : "Feil"}
            </p>
            {round.explanation ? (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {round.explanation}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                autoFocus
                onClick={() => {
                  setIndex((i) => i + 1);
                  setPicked(null);
                }}
              >
                {index + 1 < rounds.length ? "Neste" : "Se resultat"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Restores the original option order so a retry reshuffles cleanly */
function unshuffle(round: Round): QuizQuestion {
  const options: string[] = [];
  round.order.forEach((orig, i) => {
    options[orig] = round.options[i];
  });
  const { order, ...rest } = round;
  return { ...rest, options, answerIndex: order[round.answerIndex] };
}
