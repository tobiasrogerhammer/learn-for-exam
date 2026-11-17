"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Highlighter,
  Layers,
  Lightbulb,
  LogIn,
  NotebookPen,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { lessonFlowTotals } from "@/lib/lesson-flow";
import { categoryOf } from "@/lib/library";
import { content } from "@/lib/storage";
import { getChosenSubjects } from "@/lib/subjects";
import {
  buildStats,
  CONFIDENCE_LEVELS,
  percent,
  summary,
  type DocumentStat,
  type SubjectStat,
  type TopicStat,
} from "@/lib/progress-stats";

/** How the site works, step by step, shown on the home page */
const STEPS = [
  {
    icon: BookOpen,
    title: "Velg emne og leksjon",
    text: "Velg emnene dine under «Mine emner» i menyen, og åpne en leksjon fra lista.",
  },
  {
    icon: Highlighter,
    title: "Les og marker",
    text: "Gå gjennom ett kapittel om gangen, og marker teksten som er viktig.",
  },
  {
    icon: NotebookPen,
    title: "Skriv notater og oppsummer",
    text: "Når kapitlet er ferdig, skjules teksten, og du skriver notater ut fra markeringene. Til slutt oppsummerer du hele leksjonen.",
  },
  {
    icon: Layers,
    title: "Øv",
    text: "Test deg selv med quiz, flashcards, gjenkalling, Koble sammen og Kahoot. Øvingen kan åpnes når som helst.",
  },
];

/** How the site works, as a numbered list of all the steps */
function StepList() {
  return (
    <ol className="border-t border-border/60 px-5 py-4">
      {STEPS.map(({ icon: Icon, title, text }, i) => (
        <li key={title} className="relative flex gap-4 pb-5 last:pb-0">
          {/* A line from each step down to the next */}
          {i < STEPS.length - 1 ? (
            <span
              className="absolute top-10 bottom-0 left-[1.125rem] w-px bg-border"
              aria-hidden
            />
          ) : null}
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-sm font-medium">
              <span className="text-muted-foreground tabular-nums">
                {i + 1}.
              </span>{" "}
              {title}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The home page: how the site works, a nudge to suggest ideas, and your
 * progress per subject and topic. Content and progress are loaded by the page.
 */
export function ProgressHome({ firstVisit }: { firstVisit: boolean }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const events = useQuery(api.practice.myEvents);
  const confidence = useQuery(api.practice.myConfidence);
  // Read the clock in the browser only, so the page can be prerendered
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()));
    return () => window.clearTimeout(timer);
  }, []);

  const stats = useMemo(
    () =>
      events && confidence && now
        ? buildStats(
            content.subjects,
            content.documents,
            events,
            confidence,
            now,
          )
        : null,
    [events, confidence, now],
  );
  const totals = useMemo(
    () => (events && now ? summary(events, now) : null),
    [events, now],
  );
  const flow = useMemo(() => {
    const chosen = getChosenSubjects();
    const lessons = content.documents.filter(
      (d) =>
        categoryOf(d) === "leksjon" &&
        (!chosen || (d.subjectId && chosen.includes(d.subjectId))),
    );
    return lessonFlowTotals(lessons);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Your numbers first; a new account starts with the welcome instead */}
      {firstVisit || !isAuthenticated ? (
        <>
          <details
            open
            className="group rounded-md border border-border/70 bg-card/80 shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--font-reading)] text-2xl leading-tight">
                  {firstVisit ? "Velkommen!" : "Slik fungerer siden"}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Les den anbefalte måten å jobbe gjennom pensum på, for å få
                  mest mulig ut av siden.
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
            </summary>
            <StepList />
            <p className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
              Markeringer, notater og svar lagres på kontoen din, så du kan
              fortsette på en annen enhet.
            </p>
          </details>
          <Link
            href="/ideer"
            className="flex items-center gap-3 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm transition hover:border-primary/70 hover:bg-primary/10"
          >
            <Lightbulb className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">Savner du noe?</span>{" "}
              <span className="text-muted-foreground">
                Foreslå en funksjon eller stem på ideene til andre.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
          {isLoading ? null : !isAuthenticated ? (
            <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
              <p className="font-[family-name:var(--font-reading)] text-2xl">
                Følg med på fremgangen din
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Logg inn med Google, så lagres svarene dine fra flashcards, quiz
                og de andre øvingene. Her ser du da hvordan du ligger an i hvert
                emne og tema, og du kan merke hvilke temaer du føler deg trygg
                på.
              </p>
              <Button
                type="button"
                className="mt-5"
                onClick={() => void signIn("google")}
              >
                <LogIn className="size-3.5" />
                Logg inn med Google
              </Button>
            </section>
          ) : (
            <>
              {totals ? (
                <SummaryTiles totals={totals} stats={stats} flow={flow} />
              ) : null}
              {stats === null ? (
                <p className="text-sm text-muted-foreground">Laster…</p>
              ) : stats.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ingen emner med øvingsmateriale ennå.
                </p>
              ) : (
                stats.map((s) => <SubjectCard key={s.subject.id} stat={s} />)
              )}
            </>
          )}
        </>
      ) : (
        <>
          {isLoading ? null : !isAuthenticated ? (
            <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
              <p className="font-[family-name:var(--font-reading)] text-2xl">
                Følg med på fremgangen din
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Logg inn med Google, så lagres svarene dine fra flashcards, quiz
                og de andre øvingene. Her ser du da hvordan du ligger an i hvert
                emne og tema, og du kan merke hvilke temaer du føler deg trygg
                på.
              </p>
              <Button
                type="button"
                className="mt-5"
                onClick={() => void signIn("google")}
              >
                <LogIn className="size-3.5" />
                Logg inn med Google
              </Button>
            </section>
          ) : (
            <>
              {totals ? (
                <SummaryTiles totals={totals} stats={stats} flow={flow} />
              ) : null}
              {stats === null ? (
                <p className="text-sm text-muted-foreground">Laster…</p>
              ) : stats.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ingen emner med øvingsmateriale ennå.
                </p>
              ) : (
                stats.map((s) => <SubjectCard key={s.subject.id} stat={s} />)
              )}
            </>
          )}
          <details
            open
            className="group rounded-md border border-border/70 bg-card/80 shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--font-reading)] text-2xl leading-tight">
                  {firstVisit ? "Velkommen!" : "Slik fungerer siden"}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Les den anbefalte måten å jobbe gjennom pensum på, for å få
                  mest mulig ut av siden.
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
            </summary>
            <StepList />
            <p className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
              Markeringer, notater og svar lagres på kontoen din, så du kan
              fortsette på en annen enhet.
            </p>
          </details>
          <Link
            href="/ideer"
            className="flex items-center gap-3 rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-sm transition hover:border-primary/70 hover:bg-primary/10"
          >
            <Lightbulb className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="font-medium">Savner du noe?</span>{" "}
              <span className="text-muted-foreground">
                Foreslå en funksjon eller stem på ideene til andre.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </>
      )}
    </div>
  );
}

function SummaryTiles({
  totals,
  stats,
  flow,
}: {
  totals: ReturnType<typeof summary>;
  stats: SubjectStat[] | null;
  flow: ReturnType<typeof lessonFlowTotals>;
}) {
  const confident = stats?.reduce((n, s) => n + s.confident, 0) ?? 0;
  const topics = stats?.reduce((n, s) => n + s.topicCount, 0) ?? 0;
  const tiles = [
    {
      label: "Temaer du er gjennom",
      value: `${flow.chaptersDone} av ${flow.chaptersTotal}`,
      note: "kapitler du har lest og skrevet notater til",
    },
    {
      label: "Leksjoner fullført",
      value: `${flow.lessonsDone} av ${flow.lessonsTotal}`,
      note: flow.lessonsStarted
        ? `oppsummert · ${flow.lessonsStarted} påbegynt`
        : "lest gjennom og oppsummert",
    },
    {
      label: "Dager du har øvd",
      value: String(totals.activeDays),
      note: "siste 30 dager",
    },
    {
      label: "Temaer du er trygg på",
      value: `${confident} av ${topics}`,
      note: "merket av deg selv",
    },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-md border border-border/70 bg-card/80 p-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t.label}
          </p>
          <p className="mt-1 font-[family-name:var(--font-reading)] text-3xl tabular-nums">
            {t.value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
        </div>
      ))}
    </section>
  );
}

/** One subject, closed by default with a preview of correct answers per day */
function SubjectCard({ stat }: { stat: SubjectStat }) {
  const today = stat.days[stat.days.length - 1];
  return (
    <details className="group rounded-md border border-border/70 bg-card/80 shadow-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
          <span className="min-w-0">
            <span className="block font-[family-name:var(--font-reading)] text-2xl leading-tight">
              {stat.subject.name}
            </span>
            <span className="mt-0.5 block text-sm text-muted-foreground">
              {today.correct} riktige i dag
            </span>
          </span>
        </span>
        <DailyBars days={stat.days} />
      </summary>
      <div className="border-t border-border/60 px-5 pt-4 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {stat.answers.toLocaleString("nb-NO")} svar ·{" "}
            {percent(stat.current)} riktig nå · {stat.confident} av{" "}
            {stat.topicCount} temaer merket trygg
          </p>
          <WeeklyBars weeks={stat.weeks} />
        </div>
        <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
          {stat.documents.map((d) => (
            <DocumentRow key={d.document.id} stat={d} />
          ))}
        </div>
      </div>
    </details>
  );
}

/** Correct answers per day for the last two weeks; hover a bar for the numbers */
function DailyBars({ days }: { days: SubjectStat["days"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.correct));
  const shown = hover !== null ? days[hover] : null;
  const label = (d: SubjectStat["days"][number]) =>
    `${new Date(d.start).toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" })}: ${
      d.answers ? `${d.correct} riktige av ${d.answers}` : "ingen svar"
    }`;
  return (
    <figure className="w-56 max-w-full">
      <figcaption className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground">
        <span>{shown ? "" : "Riktige svar per dag"}</span>
        <span className="tabular-nums text-foreground">
          {shown ? label(shown) : "siste 14 dager"}
        </span>
      </figcaption>
      <div
        className="flex h-10 items-end gap-0.5 border-b border-border"
        role="img"
        aria-label={days.map(label).join(", ")}
      >
        {days.map((d, i) => (
          <div
            key={d.start}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {d.correct === 0 ? (
              <div className="h-0.5 w-full rounded-t-sm bg-muted-foreground/20" />
            ) : (
              <div
                className={`w-full rounded-t-[3px] bg-primary transition-opacity ${hover !== null && hover !== i ? "opacity-50" : ""}`}
                style={{ height: `${Math.max(8, (d.correct / max) * 100)}%` }}
              />
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Share right per week; one bar per week, empty weeks shown as a short gray tick */
function WeeklyBars({ weeks }: { weeks: SubjectStat["weeks"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const height = 56;
  const shown = hover !== null ? weeks[hover] : null;
  return (
    <figure className="min-w-56">
      <figcaption className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>Riktig per uke, siste 8 uker</span>
        <span className="tabular-nums text-foreground">
          {shown
            ? `${weekLabel(shown.start)}: ${shown.answers ? `${percent(shown.share)} av ${shown.answers}` : "ingen svar"}`
            : ""}
        </span>
      </figcaption>
      <div
        className="flex h-14 items-end gap-0.5 border-b border-border"
        role="img"
        aria-label={weeks
          .map(
            (w) =>
              `${weekLabel(w.start)} ${w.answers ? percent(w.share) : "ingen svar"}`,
          )
          .join(", ")}
      >
        {weeks.map((w, i) => (
          <div
            key={w.start}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            {w.share === null ? (
              <div className="h-0.5 w-full rounded-t-sm bg-muted-foreground/20" />
            ) : (
              <div
                className={`w-full rounded-t-[4px] bg-primary transition-opacity ${hover !== null && hover !== i ? "opacity-50" : ""}`}
                style={{ height: Math.max(2, w.share * height) }}
              />
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

function weekLabel(start: number) {
  return `uke fra ${new Date(start).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}`;
}

function DocumentRow({ stat }: { stat: DocumentStat }) {
  const [open, setOpen] = useState(false);
  const rated = stat.topics.filter((t) => t.confidence !== null).length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/30"
      >
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {stat.document.title}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {stat.topics.length} temaer · {rated} vurdert
        </span>
        <Meter share={stat.current} className="w-28" />
        <span className="w-12 text-right text-sm tabular-nums">
          {percent(stat.current)}
        </span>
      </button>
      {open ? (
        <ul className="mb-3 space-y-1 pl-7">
          {stat.topics
            .slice()
            .sort((a, b) => (a.current ?? 2) - (b.current ?? 2))
            .map((t) => (
              <TopicRow key={t.topic} documentKey={stat.document.id} stat={t} />
            ))}
        </ul>
      ) : null}
    </div>
  );
}

function Meter({
  share,
  className = "",
}: {
  share: number | null;
  className?: string;
}) {
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-muted ${className}`}
      aria-hidden
    >
      {share !== null ? (
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      ) : null}
    </div>
  );
}

function TopicRow({
  documentKey,
  stat,
}: {
  documentKey: string;
  stat: TopicStat;
}) {
  const setConfidence = useMutation(api.practice.setConfidence);
  const hint =
    stat.current === null || stat.answers < 4
      ? null
      : stat.confidence === 3 && stat.current < 0.6
        ? "Du føler deg trygg, men svarer riktig på under 60 %."
        : stat.confidence === 1 && stat.current >= 0.85
          ? "Du svarer riktig på det meste, så du kan trolig mer enn du tror."
          : null;
  return (
    <li className="rounded-md px-2 py-2 hover:bg-muted/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="min-w-0 flex-1 text-sm">{stat.topic}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {stat.answers ? `${stat.answers} svar` : "ikke øvd"}
        </span>
        {stat.change !== null && Math.abs(stat.change) >= 0.05 ? (
          <span
            className={`flex items-center text-xs tabular-nums ${stat.change > 0 ? "text-teal-700" : "text-rose-700"}`}
            title="Endring fra de tidligere til de siste svarene dine"
          >
            {stat.change > 0 ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(Math.round(stat.change * 100))} pp
          </span>
        ) : null}
        <Meter share={stat.current} className="w-20" />
        <span className="w-10 text-right text-xs tabular-nums">
          {percent(stat.current)}
        </span>
        <div
          className="flex overflow-hidden rounded-md border border-border/70"
          role="group"
          aria-label={`Hvor trygg er du på ${stat.topic}?`}
        >
          {CONFIDENCE_LEVELS.map((c) => (
            <button
              key={c.level}
              type="button"
              aria-pressed={stat.confidence === c.level}
              onClick={() =>
                void setConfidence({
                  documentKey,
                  topic: stat.topic,
                  level: stat.confidence === c.level ? null : c.level,
                })
              }
              className={`border-l border-border/70 px-2 py-1 text-xs first:border-l-0 ${
                stat.confidence === c.level
                  ? "bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {hint ? <p className="mt-1 text-xs text-amber-700">{hint}</p> : null}
    </li>
  );
}
