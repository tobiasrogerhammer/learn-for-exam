"use client";

import { useState } from "react";
import {
  Check,
  ChevronRight,
  GraduationCap,
  Headphones,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { SourceIcon } from "@/components/source-icon";
import { Button } from "@/components/ui/button";
import { listenedLabel } from "@/lib/audiobook";
import { CATEGORIES, categoryOf } from "@/lib/library";
import type { DocCategory, DocumentMeta, ListenPosition, Subject } from "@/lib/types";

// Written out in full so Tailwind keeps the classes
const SUBJECT_COLORS = [
  "bg-teal-600",
  "bg-blue-600",
  "bg-violet-600",
  "bg-amber-500",
  "bg-rose-600",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-orange-600",
];

/** Each subject keeps the same color, picked from its id */
function subjectColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}

const LECTURER = /\s*\(([^()]+)\)\s*$/;

/**
 * Lectures named like "2 - Forelesning 2: Argumentasjonsteori (Kjetil)" are
 * grouped by the name in brackets, when a group has more than one such name.
 * Returns null when there is nothing to group by.
 */
function byLecturer(items: DocumentMeta[]): { name: string; items: DocumentMeta[] }[] | null {
  const groups = new Map<string, DocumentMeta[]>();
  for (const item of items) {
    const name = item.title.match(LECTURER)?.[1].trim() ?? "Andre";
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  const named = [...groups.keys()].filter((n) => n !== "Andre");
  if (named.length < 2) return null;
  return [...groups]
    .map(([name, list]) => ({ name, items: list }))
    .sort((a, b) => (a.name === "Andre" ? 1 : b.name === "Andre" ? -1 : a.name.localeCompare(b.name, "nb")));
}

type Props = {
  subjects: Subject[];
  activeId: string | null;
  docCounts: Record<string, number>;
  /** Documents in the active subject, shown under it grouped by category */
  documents: DocumentMeta[];
  selectedDocId: string | null;
  /** Your listening positions, to show how much of each audiobook you have heard */
  positions: Record<string, ListenPosition>;
  /** Only the admin can create, rename and delete subjects */
  canEdit: boolean;
  onSelect: (id: string) => void;
  onSelectDocument: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** Opens the list where you add or remove subjects from your menu */
  onEditSubjects?: () => void;
};

export function SubjectSidebar({
  subjects,
  activeId,
  docCounts,
  documents,
  selectedDocId,
  positions,
  canEdit,
  onSelect,
  onSelectDocument,
  onCreate,
  onRename,
  onDelete,
  onEditSubjects,
}: Props) {
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  // The active subject is open unless you close it; categories open when you pick them
  const [closedSubject, setClosedSubject] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<DocCategory>>(() => new Set());
  const [openLecturers, setOpenLecturers] = useState<Set<string>>(() => new Set());

  const toggleLecturer = (key: string) =>
    setOpenLecturers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups = CATEGORIES.map((c) => ({
    ...c,
    items: documents
      .filter((d) => categoryOf(d) === c.id)
      .sort((a, b) => a.title.localeCompare(b.title, "nb", { numeric: true })),
  })).filter((g) => g.items.length > 0);
  const selectedCategory = documents.find((d) => d.id === selectedDocId);

  const toggleGroup = (id: DocCategory) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Documents in a group; inside a lecturer's group the name in brackets is left out */
  const docList = (items: DocumentMeta[], stripLecturer: boolean) => (
    <ul className="space-y-0.5 py-0.5 pl-3">
      {items.map((d) => {
        const selected = d.id === selectedDocId;
        return (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => onSelectDocument(d.id)}
              aria-current={selected ? "true" : undefined}
              title={d.title}
              className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition ${
                selected
                  ? "bg-primary/10 font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              }`}
            >
              <SourceIcon type={d.sourceType} />
              <span className="line-clamp-2 min-w-0 flex-1 break-words">
                {stripLecturer ? d.title.replace(LECTURER, "") : d.title}
              </span>
              {d.audiobook ? (
                <span
                  className="mt-0.5 shrink-0 text-teal-700"
                  title={listenedLabel(positions[d.id])}
                >
                  <Headphones className="size-3.5" aria-hidden />
                  <span className="sr-only">
                    {listenedLabel(positions[d.id])}
                  </span>
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const submit = () => {
    const name = editing?.name.trim();
    if (!editing || !name) return;
    if (editing.id) onRename(editing.id, name);
    else onCreate(name);
    setEditing(null);
  };

  const nameForm = (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        value={editing?.name ?? ""}
        onChange={(e) => setEditing((s) => (s ? { ...s, name: e.target.value } : s))}
        onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
        placeholder={editing?.id ? "Nytt navn" : "Navn på emnet"}
        className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <Button type="submit" size="icon-sm" aria-label="Lagre">
        <Check className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Avbryt"
        onClick={() => setEditing(null)}
      >
        <X className="size-3.5" />
      </Button>
    </form>
  );

  return (
    <nav aria-label="Mine emner" className="space-y-2">
      {onEditSubjects ? (
        // The whole heading opens the subject list; the "Endre" chip shows that it can
        <button
          type="button"
          onClick={onEditSubjects}
          title="Legg til eller fjern emner"
          className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition hover:bg-muted/60"
        >
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground group-hover:text-foreground">
            Mine emner
          </span>
          <span className="flex items-center gap-1 rounded-md border border-border/70 bg-card/80 px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm transition group-hover:border-primary/50 group-hover:text-foreground">
            <Pencil className="size-3" aria-hidden />
            Endre
          </span>
        </button>
      ) : (
        <p className="px-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Mine emner</p>
      )}
      <ul className="flex flex-col gap-1">
        {subjects.map((s) => {
          const active = s.id === activeId;
          const open = active && closedSubject !== s.id;
          const color = subjectColor(s.id);
          if (editing?.id === s.id) {
            return <li key={s.id}>{nameForm}</li>;
          }
          return (
            <li key={s.id}>
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    if (active) setClosedSubject(open ? s.id : null);
                    else {
                      setClosedSubject(null);
                      setOpenGroups(new Set());
                      onSelect(s.id);
                    }
                  }}
                  aria-expanded={open}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${canEdit ? "pr-16" : "pr-10"} ${
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-md text-white/95 opacity-80 ${color}`}
                  >
                    <GraduationCap className="size-3.5" />
                  </span>
                  <span className="truncate">{s.name}</span>
                </button>
                <span
                  className={`pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 rounded-sm px-1.5 text-xs tabular-nums ${active ? "bg-background text-muted-foreground" : "bg-muted text-muted-foreground"} ${canEdit ? "md:group-hover:hidden" : ""}`}
                >
                  {docCounts[s.id] ?? 0}
                </span>
                <ChevronRight
                  className={`pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 transition-transform text-muted-foreground ${open ? "rotate-90" : ""}`}
                  aria-hidden
                />
                {canEdit ? (
                  <div
                    className="absolute right-6 top-1/2 hidden -translate-y-1/2 md:group-hover:flex"
                  >
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Gi ${s.name} nytt navn`}
                      title="Gi nytt navn"
                      onClick={() => setEditing({ id: s.id, name: s.name })}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Slett ${s.name}`}
                      title="Slett emnet"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Slette «${s.name}» med alle dokumenter og øvingsmateriale?`,
                          )
                        ) {
                          onDelete(s.id);
                        }
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ) : null}
              </div>

              {open ? (
                groups.length === 0 ? (
                  <p className="py-1.5 pl-8 text-xs text-muted-foreground">Ingen dokumenter ennå</p>
                ) : (
                  <ul className="mt-0.5 space-y-0.5 pl-4" aria-label={`Innhold i ${s.name}`}>
                    {groups.map((g) => {
                      const groupOpen = openGroups.has(g.id);
                      const holdsSelected = selectedCategory && categoryOf(selectedCategory) === g.id;
                      return (
                        <li key={g.id}>
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.id)}
                            aria-expanded={groupOpen}
                            className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/70 ${
                              holdsSelected && !groupOpen ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <ChevronRight
                              className={`size-3.5 shrink-0 transition-transform ${groupOpen ? "rotate-90" : ""}`}
                              aria-hidden
                            />
                            <span className="font-medium">{g.label}</span>
                            <span className="ml-auto rounded-sm bg-muted px-1.5 text-xs tabular-nums">
                              {g.items.length}
                            </span>
                          </button>
                          {groupOpen ? (
                            (() => {
                              const lecturers = byLecturer(g.items);
                              if (!lecturers) return docList(g.items, false);
                              return (
                                <ul className="space-y-0.5 py-0.5 pl-3">
                                  {lecturers.map((l) => {
                                    const key = `${g.id}:${l.name}`;
                                    const open = openLecturers.has(key);
                                    const holds = l.items.some((d) => d.id === selectedDocId);
                                    return (
                                      <li key={key}>
                                        <button
                                          type="button"
                                          onClick={() => toggleLecturer(key)}
                                          aria-expanded={open}
                                          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-muted/70 ${
                                            holds && !open ? "text-foreground" : "text-muted-foreground"
                                          }`}
                                        >
                                          <ChevronRight
                                            className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                                            aria-hidden
                                          />
                                          <span className="font-medium">{l.name}</span>
                                          <span className="ml-auto rounded-sm bg-muted px-1.5 text-xs tabular-nums">
                                            {l.items.length}
                                          </span>
                                        </button>
                                        {open ? docList(l.items, true) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              );
                            })()
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : null}
            </li>
          );
        })}
        {canEdit ? (
          <li className="pt-1">
            {editing && !editing.id ? (
              nameForm
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => setEditing({ id: null, name: "" })}
              >
                <Plus className="size-3.5" />
                Nytt emne
              </Button>
            )}
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
