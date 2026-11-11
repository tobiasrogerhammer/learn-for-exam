"use client";

import { useEffect, useRef, useState } from "react";
import { Check, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Subject } from "@/lib/types";

type Props = {
  open: boolean;
  subjects: Subject[];
  docCounts: Record<string, number>;
  /** Already chosen subjects, or null the first time */
  chosen: string[] | null;
  onSave: (ids: string[]) => void;
  /** Missing the first time, so you have to pick before you start */
  onClose?: () => void;
};

/** Pick which subjects show in the menu; saved on your account */
export function SubjectPicker({ open, subjects, docCounts, chosen, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(chosen ?? []));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const firstTime = chosen === null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="emnevalg-tittel"
      // Escape only closes it when there is something to go back to
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-border/70 bg-background p-0 text-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-sm"
    >
      <form
        method="dialog"
        className="flex max-h-[85vh] flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(subjects.filter((s) => picked.has(s.id)).map((s) => s.id));
        }}
      >
        <div className="border-b border-border/60 px-5 py-4">
          <h2 id="emnevalg-tittel" className="font-[family-name:var(--font-reading)] text-2xl leading-tight">
            {firstTime ? "Hvilke emner tar du?" : "Velg emner"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {firstTime
              ? "Velg emnene du vil ha i menyen. Du kan legge til eller fjerne emner senere nederst i menyen."
              : "Huk av emnene du vil ha i menyen. Fremgangen din i et emne blir lagret selv om du fjerner det."}
          </p>
        </div>

        <ul className="flex-1 space-y-1.5 overflow-y-auto px-5 py-4">
          {subjects.map((s) => {
            const on = picked.has(s.id);
            const count = docCounts[s.id] ?? 0;
            return (
              <li key={s.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition ${
                    on ? "border-primary/60 bg-primary/5" : "border-border/70 hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(s.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                    }`}
                  >
                    {on ? <Check className="size-3.5" /> : null}
                  </span>
                  <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {count} {count === 1 ? "dokument" : "dokumenter"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {picked.size === 0 ? "Velg minst ett emne" : `${picked.size} valgt`}
          </span>
          <div className="flex gap-2">
            {onClose ? (
              <Button type="button" variant="ghost" onClick={onClose}>
                Avbryt
              </Button>
            ) : null}
            <Button type="submit" disabled={picked.size === 0}>
              {firstTime ? "Kom i gang" : "Lagre"}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
