"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, LogIn } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { content, loadContent } from "@/lib/storage";
import {
  buildStats,
  CONFIDENCE_LEVELS,
  percent,
  summary,
  type DocumentStat,
  type SubjectStat,
  type TopicStat,
} from "@/lib/progress-stats";

export default function ProfilePage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const me = useQuery(api.users.me);
  const events = useQuery(api.practice.myEvents);
  const confidence = useQuery(api.practice.myConfidence);
  const [loaded, setLoaded] = useState(false);
  // Read the clock in the browser only, so the page can be prerendered
  const [now, setNow] = useState(0);

  useEffect(() => {
    void loadContent().then(() => {
      setNow(Date.now());
      setLoaded(true);
    });
  }, []);

  const stats = useMemo(
    () =>
      loaded && events && confidence
        ? buildStats(content.subjects, content.documents, content.studySets, events, confidence, now)
        : null,
    [loaded, events, confidence, now],
  );
  const totals = useMemo(() => (events && now ? summary(events, now) : null), [events, now]);

  return (
    <div className="min-h-screen">
      <PageHeader title="Fremgang" />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        {isLoading ? null : !isAuthenticated ? (
          <section className="rounded-md border border-border/70 bg-card/80 p-6 text-center shadow-sm">
            <p className="font-[family-name:var(--font-reading)] text-2xl">Følg med på fremgangen din</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Logg inn med Google, så lagres svarene dine fra flashcards, quiz og de andre
              øvingene. Her ser du da hvordan du ligger an i hvert emne og tema, og du kan merke
              hvilke temaer du føler deg trygg på.
            </p>
            <Button type="button" className="mt-5" onClick={() => void signIn("google")}>
              <LogIn className="size-3.5" />
              Logg inn med Google
            </Button>
          </section>
        ) : (
          <>
            <section className="flex flex-wrap items-center gap-4">
              {me?.image ? (
                // Google profile pictures come from an outside host, so a plain img is simplest
                // eslint-disable-next-line @next/next/no-img-element
                <img src={me.image} alt="" className="size-14 rounded-full border border-border/70" />
              ) : null}
              <div>
                <p className="font-[family-name:var(--font-reading)] text-2xl">{me?.name ?? "Profil"}</p>
                <p className="text-sm text-muted-foreground">{me?.email}</p>
              </div>
            </section>

            {totals ? <SummaryTiles totals={totals} stats={stats} /> : null}

            {stats === null ? (
              <p className="text-sm text-muted-foreground">Laster…</p>
            ) : stats.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen emner med øvingsmateriale ennå.</p>
            ) : (
              stats.map((s) => <SubjectCard key={s.subject.id} stat={s} />)
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SummaryTiles({
  totals,
  stats,
}: {
  totals: ReturnType<typeof summary>;
  stats: SubjectStat[] | null;
}) {
  const confident = stats?.reduce((n, s) => n + s.confident, 0) ?? 0;
  const topics = stats?.reduce((n, s) => n + s.topicCount, 0) ?? 0;
  const tiles = [
    { label: "Svar totalt", value: totals.answers.toLocaleString("nb-NO"), note: `${totals.lastWeekAnswers} siste 7 dager` },
    {
      label: "Riktig siste 7 dager",
      value: percent(totals.thisWeek),
      note:
        totals.change === null
          ? "Ingen svar uka før å sammenligne med"
          : `${totals.change >= 0 ? "+" : "−"}${Math.abs(Math.round(totals.change * 100))} prosentpoeng fra uka før`,
    },
    { label: "Dager du har øvd", value: String(totals.activeDays), note: "siste 30 dager" },
    { label: "Temaer du er trygg på", value: `${confident} av ${topics}`, note: "merket av deg selv" },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-md border border-border/70 bg-card/80 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{t.label}</p>
          <p className="mt-1 font-[family-name:var(--font-reading)] text-3xl tabular-nums">{t.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.note}</p>
        </div>
      ))}
    </section>
  );
}

function SubjectCard({ stat }: { stat: SubjectStat }) {
  return (
    <section className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-reading)] text-2xl leading-tight">{stat.subject.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {stat.answers.toLocaleString("nb-NO")} svar · {percent(stat.current)} riktig nå ·{" "}
            {stat.confident} av {stat.topicCount} temaer merket trygg
          </p>
        </div>
        <WeeklyBars weeks={stat.weeks} />
      </div>
      <div className="mt-4 divide-y divide-border/60 border-t border-border/60">
        {stat.documents.map((d) => (
          <DocumentRow key={d.document.id} stat={d} />
        ))}
      </div>
    </section>
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
      <div className="flex h-14 items-end gap-0.5 border-b border-border" role="img" aria-label={weeks.map((w) => `${weekLabel(w.start)} ${w.answers ? percent(w.share) : "ingen svar"}`).join(", ")}>
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
        <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="min-w-0 flex-1 truncate font-medium">{stat.document.title}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {stat.topics.length} temaer · {rated} vurdert
        </span>
        <Meter share={stat.current} className="w-28" />
        <span className="w-12 text-right text-sm tabular-nums">{percent(stat.current)}</span>
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

function Meter({ share, className = "" }: { share: number | null; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-muted ${className}`} aria-hidden>
      {share !== null ? (
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(share * 100)}%` }} />
      ) : null}
    </div>
  );
}

function TopicRow({ documentKey, stat }: { documentKey: string; stat: TopicStat }) {
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
            {stat.change > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(Math.round(stat.change * 100))} pp
          </span>
        ) : null}
        <Meter share={stat.current} className="w-20" />
        <span className="w-10 text-right text-xs tabular-nums">{percent(stat.current)}</span>
        <div className="flex overflow-hidden rounded-md border border-border/70" role="group" aria-label={`Hvor trygg er du på ${stat.topic}?`}>
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
