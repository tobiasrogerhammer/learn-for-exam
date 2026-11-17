"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Pencil, Plus, X } from "lucide-react";

type Props = {
  /** YYYY-MM-DD, or undefined when no date is set */
  date?: string;
  /** The admin can set and change the date */
  canEdit: boolean;
  onChange: (date: string | null) => void;
};

const DAY = 24 * 60 * 60 * 1000;

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "om 14 dager", "i morgen", "i dag" or "var for 3 dager siden" */
function countdown(date: string, today: Date) {
  const days = Math.round((parse(date).getTime() - today.getTime()) / DAY);
  if (days > 1) return `om ${days} dager`;
  if (days === 1) return "i morgen";
  if (days === 0) return "i dag";
  return days === -1 ? "var i går" : `var for ${-days} dager siden`;
}

/** The subject's exam day with a countdown, shown above the subject's lessons */
export function ExamDate({ date, canEdit, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(date ?? "");
  // Today is read in the browser, so the server render never disagrees with it
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = new Date();
      setToday(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
    });
    return () => window.clearTimeout(timer);
  }, []);

  if (editing) {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          onChange(draft || null);
          setEditing(false);
        }}
      >
        <input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="Eksamensdato"
          className="h-7 rounded-md border border-border bg-background px-2 text-sm"
          autoFocus
        />
        <button type="submit" className="rounded p-1 text-primary hover:bg-muted" aria-label="Lagre eksamensdato">
          <Check className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(date ?? "");
            setEditing(false);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Avbryt"
        >
          <X className="size-4" />
        </button>
      </form>
    );
  }

  if (!date) {
    return canEdit ? (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-3" />
        Eksamensdato
      </button>
    ) : null;
  }

  const days = today ? Math.round((parse(date).getTime() - today.getTime()) / DAY) : null;
  const soon = days !== null && days >= 0 && days <= 7;
  return (
    <span
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
        soon ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300" : "border-primary/30 bg-primary/5 text-foreground"
      }`}
    >
      <CalendarDays className="size-4 shrink-0" />
      <span>
        Eksamen {parse(date).toLocaleDateString("nb-NO", { day: "numeric", month: "long" })}
        {today ? <span className="text-muted-foreground"> · {countdown(date, today)}</span> : null}
      </span>
      {canEdit ? (
        <button
          type="button"
          onClick={() => {
            setDraft(date);
            setEditing(true);
          }}
          className="-mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Endre eksamensdato"
        >
          <Pencil className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
