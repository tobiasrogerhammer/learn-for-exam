"use client";

import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkWritten, STAGE_GATE, type StageGateSlot } from "@/lib/stage-gate";
import { shuffle } from "@/lib/study";

type Mode = "place" | "write";

/** Stage-Gate practice for PMF, shown in the subject's Øvinger tab */
export default function StageGatePage() {
  const [mode, setMode] = useState<Mode>("place");
  return (
    <main className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-reading)] text-2xl">Stage-Gate-modellen</h1>
          <p className="text-sm text-muted-foreground">
            Idégenerering, fem faser og fem gates, slik den er beskrevet i leksjon 2 og 3 og hos Cooper.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-border/70 text-sm" role="group" aria-label="Vanskelighetsgrad">
          {(
            [
              ["place", "Plasser punktene"],
              ["write", "Skriv selv (vanskelig)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={`border-l border-border/70 px-3 py-1.5 first:border-l-0 ${
                mode === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "place" ? <PlaceMode /> : <WriteMode />}
    </main>
  );
}

type Card = { slotId: string; text: string };

function allCards(): Card[] {
  return shuffle(STAGE_GATE.flatMap((s) => s.points.map((p) => ({ slotId: s.id, text: p.text }))));
}

function slotStyle(slot: StageGateSlot) {
  return slot.kind === "gate"
    ? "border-amber-500/60 bg-amber-50/70"
    : slot.kind === "review"
      ? "border-violet-500/50 bg-violet-50/60"
      : "border-border/70 bg-card/90";
}

function SlotHeader({ slot }: { slot: StageGateSlot }) {
  return (
    <div className="mb-2">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${
          slot.kind === "gate" ? "text-amber-800" : slot.kind === "review" ? "text-violet-800" : "text-teal-800"
        }`}
      >
        {slot.kind === "gate" ? "◆ " : ""}
        {slot.label}
      </p>
      <p className="font-medium leading-snug">{slot.title}</p>
    </div>
  );
}

/** Easy: one point at a time, click where it belongs in the empty model */
function PlaceMode() {
  // Shuffled when you press start, so the server and browser render the same page
  const [deck, setDeck] = useState<Card[] | null>(null);
  const [placed, setPlaced] = useState<Record<string, string[]>>({});
  const [wrongSlot, setWrongSlot] = useState<string | null>(null);
  const [triesOnCard, setTriesOnCard] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const total = useMemo(() => STAGE_GATE.reduce((n, s) => n + s.points.length, 0), []);

  const card = deck?.[0];
  const done = !!deck && !card;

  const place = (slotId: string) => {
    if (!card) return;
    if (slotId === card.slotId) {
      setPlaced((p) => ({ ...p, [slotId]: [...(p[slotId] ?? []), card.text] }));
      if (triesOnCard === 0) setFirstTry((n) => n + 1);
      setDeck((d) => d?.slice(1) ?? null);
      setTriesOnCard(0);
      setWrongSlot(null);
    } else {
      setMistakes((m) => m + 1);
      setTriesOnCard((t) => t + 1);
      setWrongSlot(slotId);
      window.setTimeout(() => setWrongSlot((w) => (w === slotId ? null : w)), 600);
    }
  };

  const restart = () => {
    setDeck(allCards());
    setPlaced({});
    setMistakes(0);
    setFirstTry(0);
    setTriesOnCard(0);
  };

  return (
    <>
      <div className="sticky top-0 z-10 rounded-md border border-primary/40 bg-background/95 p-4 shadow-sm backdrop-blur">
        {!deck ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Du får {total} punkter, ett om gangen. Plasser hvert av dem i riktig fase eller gate i modellen.
            </p>
            <Button type="button" onClick={restart}>
              Start
            </Button>
          </div>
        ) : done ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-[family-name:var(--font-reading)] text-xl">
              Ferdig! {firstTry} av {total} riktig på første forsøk, {mistakes} feil.
            </p>
            <Button type="button" variant="outline" onClick={restart}>
              <RotateCcw className="size-3.5" />
              Prøv igjen
            </Button>
          </div>
        ) : card ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Hvor hører dette hjemme? Trykk på riktig fase eller gate.
              </p>
              <p className="mt-1 font-[family-name:var(--font-reading)] text-xl leading-snug">{card.text}</p>
              {triesOnCard >= 2 ? (
                <p className="mt-1 text-xs text-muted-foreground">Riktig sted er markert med en ring.</p>
              ) : null}
            </div>
            <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
              {total - deck.length}/{total} plassert · {mistakes} feil
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {STAGE_GATE.map((slot) => {
          const hint = !done && triesOnCard >= 2 && card?.slotId === slot.id;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => place(slot.id)}
              disabled={!card}
              className={`flex min-h-36 flex-col rounded-md border p-3 text-left text-sm shadow-sm transition hover:border-primary/60 ${slotStyle(slot)} ${
                wrongSlot === slot.id ? "!border-destructive !bg-destructive/10" : ""
              } ${hint ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              <SlotHeader slot={slot} />
              <ul className="space-y-1">
                {(placed[slot.id] ?? []).map((text) => (
                  <li key={text} className="flex gap-1.5 text-[13px] leading-snug text-teal-900">
                    <Check className="mt-0.5 size-3.5 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Hard: write a number of points yourself for each stage and gate */
function WriteMode() {
  const [perSlot, setPerSlot] = useState(2);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [checked, setChecked] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const required = (slot: StageGateSlot) => Math.min(perSlot, slot.points.length);

  const results = useMemo(
    () =>
      Object.fromEntries(
        STAGE_GATE.map((slot) => [slot.id, checkWritten(slot, answers[slot.id] ?? [])]),
      ),
    [answers],
  );
  const totalRequired = STAGE_GATE.reduce((n, s) => n + required(s), 0);
  const totalFound = STAGE_GATE.reduce(
    (n, s) => n + Math.min(required(s), results[s.id].found.size),
    0,
  );

  const setLine = (slotId: string, i: number, value: string) => {
    setAnswers((a) => {
      const lines = [...(a[slotId] ?? [])];
      lines[i] = value;
      return { ...a, [slotId]: lines };
    });
    setChecked(false);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-card/80 p-4 shadow-sm">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Punkter per fase og gate
          <select
            value={perSlot}
            onChange={(e) => {
              setPerSlot(Number(e.target.value));
              setChecked(false);
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {checked ? (
            <span className="text-sm font-medium tabular-nums">
              {totalFound} av {totalRequired} riktige
            </span>
          ) : null}
          <Button type="button" variant="outline" onClick={() => setShowKey((v) => !v)}>
            {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {showKey ? "Skjul fasit" : "Vis fasit"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAnswers({});
              setChecked(false);
              setShowKey(false);
            }}
          >
            <RotateCcw className="size-3.5" />
            Tøm
          </Button>
          <Button type="button" onClick={() => setChecked(true)}>
            <Check className="size-3.5" />
            Sjekk svarene
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Skriv ett punkt per felt med egne ord. Et svar godkjennes når det inneholder et sentralt ord
        fra pensum, for eksempel «markedsanalyse» eller «prototyp». Sjekk fasit hvis du mener du har
        rett selv om det ikke blir godkjent.
      </p>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {STAGE_GATE.map((slot) => {
          const n = required(slot);
          const { results: lines, found } = results[slot.id];
          return (
            <section key={slot.id} className={`rounded-md border p-3 shadow-sm ${slotStyle(slot)}`}>
              <div className="flex items-start justify-between gap-2">
                <SlotHeader slot={slot} />
                {checked ? (
                  <span
                    className={`rounded-sm px-1.5 py-0.5 text-xs tabular-nums ${
                      found.size >= n ? "bg-teal-100 text-teal-900" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {Math.min(found.size, n)}/{n}
                  </span>
                ) : null}
              </div>
              {slot.question ? <p className="-mt-1 mb-2 text-xs italic text-muted-foreground">{slot.question}</p> : null}
              <div className="space-y-1.5">
                {Array.from({ length: n }, (_, i) => {
                  const result = lines[i];
                  const value = answers[slot.id]?.[i] ?? "";
                  const ok = checked && value.trim() && result?.match !== null;
                  const bad = checked && value.trim() && result?.match === null;
                  return (
                    <div key={i} className="relative">
                      <input
                        value={value}
                        onChange={(e) => setLine(slot.id, i, e.target.value)}
                        placeholder={`Punkt ${i + 1}`}
                        className={`h-8 w-full rounded-md border bg-background px-2.5 pr-7 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                          ok ? "border-teal-600" : bad ? "border-destructive" : "border-border"
                        }`}
                      />
                      {ok ? <Check className="absolute right-2 top-2 size-4 text-teal-700" /> : null}
                      {bad ? <X className="absolute right-2 top-2 size-4 text-destructive" /> : null}
                    </div>
                  );
                })}
              </div>
              {showKey ? (
                <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-xs">
                  {slot.points.map((p, i) => (
                    <li key={p.text} className={found.has(i) ? "text-teal-800" : "text-muted-foreground"}>
                      {found.has(i) ? "✓ " : "• "}
                      {p.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
