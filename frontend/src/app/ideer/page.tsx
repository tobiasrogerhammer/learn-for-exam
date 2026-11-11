"use client";

import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ChevronDown, ChevronUp, LogIn, Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  ny: "Ny",
  planlagt: "Planlagt",
  laget: "Laget",
};

const fieldClass =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export default function IdeasPage() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const me = useQuery(api.users.me);
  const ideas = useQuery(api.ideas.list);
  const create = useMutation(api.ideas.create);
  const vote = useMutation(api.ideas.vote);
  const remove = useMutation(api.ideas.remove);
  const setStatus = useMutation(api.ideas.setStatus);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<"score" | "new">("score");

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^[\s\S]*Uncaught Error: /, "").split("\n")[0] : String(err));
    }
  };

  const submit = async () => {
    setBusy(true);
    await run(async () => {
      await create({ title, description });
      setTitle("");
      setDescription("");
    });
    setBusy(false);
  };

  const sorted = ideas
    ? sort === "score"
      ? ideas
      : [...ideas].sort((a, b) => b.createdAt - a.createdAt)
    : null;

  return (
    <div className="min-h-screen">
      <PageHeader title="Ideer" />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
          <h2 className="font-[family-name:var(--font-reading)] text-2xl">Foreslå en funksjon</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Har du en idé til appen? Skriv den her, og stem opp ideene du vil ha mest.
          </p>
          {isAuthenticated ? (
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Kort tittel, for eksempel «Mørk modus»"
                className={fieldClass}
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Beskriv ideen og hvorfor den hadde hjulpet deg (valgfritt)"
                className={fieldClass}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={busy || title.trim().length < 3}>
                  <Plus className="size-3.5" />
                  Legg til idé
                </Button>
              </div>
            </form>
          ) : (
            <Button type="button" className="mt-4" onClick={() => void signIn("google")}>
              <LogIn className="size-3.5" />
              Logg inn for å foreslå og stemme
            </Button>
          )}
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">
              {sorted ? `${sorted.length} ${sorted.length === 1 ? "idé" : "ideer"}` : "Ideer"}
            </h2>
            <div className="flex overflow-hidden rounded-md border border-border/70 text-sm" role="group" aria-label="Sorter">
              {(["score", "new"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sort === s}
                  onClick={() => setSort(s)}
                  className={`border-l border-border/70 px-3 py-1 first:border-l-0 ${
                    sort === s ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {s === "score" ? "Mest likt" : "Nyeste"}
                </button>
              ))}
            </div>
          </div>

          {sorted === null ? (
            <p className="text-sm text-muted-foreground">Laster…</p>
          ) : sorted.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/80 px-6 py-10 text-center text-sm text-muted-foreground">
              Ingen ideer ennå. Bli den første!
            </p>
          ) : (
            <ul className="space-y-2">
              {sorted.map((idea) => (
                <li
                  key={idea.id}
                  className="flex gap-3 rounded-md border border-border/70 bg-card/80 p-4 shadow-sm"
                >
                  <VoteControl
                    score={idea.score}
                    myVote={idea.myVote}
                    disabled={!isAuthenticated}
                    onVote={(value) => void run(() => vote({ ideaId: idea.id as Id<"ideas">, value }))}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{idea.title}</p>
                      <span
                        className={`rounded-sm px-1.5 py-0.5 text-xs ${
                          idea.status === "laget"
                            ? "bg-teal-100 text-teal-900"
                            : idea.status === "planlagt"
                              ? "bg-blue-100 text-blue-900"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[idea.status] ?? idea.status}
                      </span>
                    </div>
                    {idea.description ? (
                      <p className="mt-1 whitespace-pre-line text-sm text-foreground/85">{idea.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {idea.authorName} ·{" "}
                        {new Date(idea.createdAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {me?.isAdmin ? (
                        <select
                          value={idea.status}
                          onChange={(e) =>
                            void run(() => setStatus({ ideaId: idea.id as Id<"ideas">, status: e.target.value }))
                          }
                          className="h-6 rounded border border-border bg-background px-1 text-xs"
                          aria-label="Status"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {idea.mine || me?.isAdmin ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-destructive hover:underline"
                          onClick={() => {
                            if (window.confirm(`Slette «${idea.title}»?`)) {
                              void run(() => remove({ ideaId: idea.id as Id<"ideas"> }));
                            }
                          }}
                        >
                          <Trash2 className="size-3" />
                          Slett
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function VoteControl({
  score,
  myVote,
  disabled,
  onVote,
}: {
  score: number;
  myVote: number;
  disabled: boolean;
  onVote: (value: 1 | -1 | 0) => void;
}) {
  return (
    <div className="flex w-10 shrink-0 flex-col items-center" title={disabled ? "Logg inn for å stemme" : undefined}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={myVote === 1}
        aria-label="Stem opp"
        onClick={() => onVote(myVote === 1 ? 0 : 1)}
        className={`rounded p-0.5 disabled:opacity-40 ${myVote === 1 ? "text-teal-700" : "text-muted-foreground hover:text-foreground"}`}
      >
        <ChevronUp className="size-5" />
      </button>
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={myVote === -1}
        aria-label="Stem ned"
        onClick={() => onVote(myVote === -1 ? 0 : -1)}
        className={`rounded p-0.5 disabled:opacity-40 ${myVote === -1 ? "text-rose-700" : "text-muted-foreground hover:text-foreground"}`}
      >
        <ChevronDown className="size-5" />
      </button>
    </div>
  );
}
