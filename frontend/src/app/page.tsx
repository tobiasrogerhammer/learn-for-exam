"use client";

import { useCallback, useEffect, useState } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import {
  ChevronDown,
  ChevronLeft,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { EmptyState } from "@/components/flashcards-view";
import { LessonFlow } from "@/components/lesson-flow";
import { ListenView } from "@/components/listen-view";
import { AccountButton } from "@/components/account-button";
import { StudyPanel } from "@/components/study-panel";
import { SubjectOverview } from "@/components/subject-overview";
import { SubjectSidebar } from "@/components/subject-sidebar";
import { UploadPanel } from "@/components/upload-panel";
import { Button } from "@/components/ui/button";
import { getListenPositions } from "@/lib/audiobook";
import {
  countBySubject,
  deleteDocument,
  deleteDocumentsInSubject,
  listLibrary,
  saveDocument,
} from "@/lib/library";
import {
  loadContent,
  loadProgress,
  onSaveError,
  reloadContent,
  type ProgressMode,
} from "@/lib/storage";
import { deleteStudySets, listStudySets } from "@/lib/study";
import { checkStudyHealth } from "@/lib/study-api";
import {
  createSubject,
  deleteSubject,
  getActiveSubjectId,
  listSubjects,
  renameSubject,
  setActiveSubjectId,
} from "@/lib/subjects";
import { checkHealth } from "@/lib/tts-api";
import type {
  ExtractedDocument,
  LibraryItem,
  ListenPosition,
  StudySet,
  Subject,
} from "@/lib/types";

export default function HomePage() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);
  const isAdmin = me?.isAdmin === true;
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // On wide screens the sidebar can be put away to give the text more room
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [backendReady, setBackendReady] = useState<boolean | null>(null);
  const [claudeReady, setClaudeReady] = useState<boolean | null>(null);
  const [contentReady, setContentReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [progressMode, setProgressMode] = useState<ProgressMode | null>(null);
  const [positions, setPositions] = useState<Record<string, ListenPosition>>({});

  const refreshSubject = useCallback((id: string | null) => {
    setLibrary(id ? listLibrary(id) : []);
    setDocCounts(countBySubject());
    setStudySets(id ? listStudySets(id) : []);
    setPositions(getListenPositions());
  }, []);

  useEffect(() => onSaveError(setSaveError), []);

  // Content first, then your progress once we know whether you are signed in
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void Promise.all([loadContent(), loadProgress(isAuthenticated)])
      .then(([, loadedMode]) => {
        if (cancelled) return;
        const all = listSubjects();
        const stored = getActiveSubjectId();
        const counts = countBySubject();
        const active =
          all.find((s) => s.id === stored) ??
          all.find((s) => counts[s.id]) ??
          all[0] ??
          null;
        setProgressMode(loadedMode);
        setSubjects(all);
        setSubjectId(active?.id ?? null);
        refreshSubject(active?.id ?? null);
        setContentReady(true);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, refreshSubject]);

  // Piper and Claude only run on the admin's own machine
  useEffect(() => {
    if (!isAdmin) return;
    void checkHealth()
      .then((h) => setBackendReady(h.ready))
      .catch(() => setBackendReady(false));
    void checkStudyHealth()
      .then((h) => setClaudeReady(h.ready))
      .catch(() => setClaudeReady(false));
  }, [isAdmin]);


  const subject = subjects.find((s) => s.id === subjectId) ?? null;
  const selected = library.find((x) => x.id === selectedId) ?? null;

  const switchSubject = (id: string) => {
    setActiveSubjectId(id);
    setSubjectId(id);
    setSelectedId(null);
    setShowUpload(false);
    refreshSubject(id);
  };

  const handleCreateSubject = (name: string) => {
    const created = createSubject(name);
    setSubjects(listSubjects());
    switchSubject(created.id);
  };

  const handleDeleteSubject = (id: string) => {
    deleteStudySets(deleteDocumentsInSubject(id));
    deleteSubject(id);
    let rest = listSubjects();
    if (rest.length === 0) rest = [createSubject("Generelt")];
    setSubjects(rest);
    switchSubject(rest[0].id);
  };

  const handleAudiobookPublished = () => {
    void reloadContent().then(() => refreshSubject(subjectId));
  };

  const handleNewDocument = (doc: ExtractedDocument, rate: number) => {
    if (!subjectId) return;
    const item = saveDocument(doc, rate, subjectId);
    refreshSubject(subjectId);
    setSelectedId(item.id);
    setShowUpload(false);
  };

  const handleDelete = (id: string) => {
    deleteDocument(id);
    deleteStudySets([id]);
    if (selectedId === id) setSelectedId(null);
    refreshSubject(subjectId);
  };

  const tools = subject?.tools ?? [];

  return (
    <div className="relative isolate flex min-h-screen flex-col md:flex-row">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(30,64,175,0.08),_transparent_45%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(to_right,rgb(15_23_42/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(15_23_42/0.04)_1px,transparent_1px)] [background-size:28px_28px]" />

      <aside className={`border-b border-border/50 bg-background/70 px-4 py-4 backdrop-blur md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0 md:px-3 md:py-5 ${sidebarHidden ? "md:hidden" : ""}`}>
        <div className="px-2">
          <p className="font-[family-name:var(--font-brand)] text-2xl tracking-tight text-foreground">
            Lær for eksamen
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lytt, repeter og test deg selv
          </p>
        </div>
        {/* On phones the menu folds away so the content comes first */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="emne-meny"
          className="mt-3 flex w-full items-center gap-2 rounded-md border border-border/70 bg-card/80 px-3 py-2.5 text-left text-sm md:hidden"
        >
          <Menu className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {selected?.title ?? subject?.name ?? "Emner og dokumenter"}
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div id="emne-meny" className={`mt-4 md:mt-8 md:block ${menuOpen ? "block" : "hidden"}`}>
          <SubjectSidebar
            subjects={subjects}
            activeId={subjectId}
            docCounts={docCounts}
            documents={library}
            selectedDocId={selectedId}
            positions={positions}
            canEdit={isAdmin}
            onSelect={switchSubject}
            onSelectDocument={(id) => {
              setSelectedId(id);
              setMenuOpen(false);
              window.scrollTo({ top: 0 });
              setPositions(getListenPositions());
            }}
            onCreate={handleCreateSubject}
            onRename={(id, name) => {
              renameSubject(id, name);
              setSubjects(listSubjects());
            }}
            onDelete={handleDeleteSubject}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-border/50 bg-background/70 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="hidden md:inline-flex"
                onClick={() => setSidebarHidden((v) => !v)}
                aria-label={sidebarHidden ? "Vis menyen" : "Skjul menyen"}
                title={sidebarHidden ? "Vis menyen" : "Skjul menyen"}
              >
                {sidebarHidden ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
              <h1 className="truncate font-[family-name:var(--font-reading)] text-xl leading-tight">
                {subject?.name ?? ""}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AccountButton />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-5xl px-4 pt-3 sm:px-6">
          <main className="flex flex-col gap-6 py-6">
            {loadError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
                Kunne ikke hente innholdet: {loadError}
              </p>
            ) : null}
            {saveError ? (
              <p className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
                <span>Noe ble ikke lagret: {saveError}</span>
                <button type="button" className="underline" onClick={() => setSaveError(null)}>
                  Lukk
                </button>
              </p>
            ) : null}
            {contentReady && !isAuthenticated ? (
              <p className="rounded-md border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                Logg inn med Google for å lagre fremgangen din på tvers av enheter. Uten
                innlogging huskes den bare i denne nettleseren.
              </p>
            ) : null}
            {contentReady && subjects.length === 0 && !isAdmin ? (
              <EmptyState text="Det er ikke lagt ut noe pensum ennå." />
            ) : null}
            {selected && subject ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    setPositions(getListenPositions());
                  }}
                  className="-mb-2 flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  Alt i {subject.name}
                </button>
                <LessonFlow
                  key={selected.id}
                  item={selected}
                  studySet={studySets.find((s) => s.documentId === selected.id)}
                  tools={tools}
                />
                {isAdmin ? (
                  <details className="group rounded-md border border-border/70 bg-card/70 shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                      <Settings2 className="size-4" />
                      Administrer dokumentet
                      <ChevronDown className="ml-auto size-4 transition group-open:rotate-180" />
                    </summary>
                    <div className="flex flex-col gap-6 border-t border-border/60 p-4">
                      <StudyPanel
                        item={selected}
                        subjectName={subject.name}
                        studySet={studySets.find((s) => s.documentId === selected.id)}
                        claudeReady={claudeReady}
                        canEdit={isAdmin}
                        onDelete={() => handleDelete(selected.id)}
                        onStudySetChange={() => refreshSubject(subjectId)}
                      />
                      <ListenView
                        item={selected}
                        isAdmin={isAdmin}
                        backendReady={backendReady}
                        onLibraryChange={handleAudiobookPublished}
                      />
                    </div>
                  </details>
                ) : null}
              </>
            ) : (
              <>
                {isAdmin && subjectId && (showUpload || (contentReady && library.length === 0)) ? (
                  <UploadPanel onDocument={handleNewDocument} />
                ) : null}
                {isAdmin && library.length > 0 && !showUpload ? (
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowUpload(true)}>
                      <Plus className="size-3.5" />
                      Last opp pensum
                    </Button>
                  </div>
                ) : null}
                {library.length > 0 ? (
                  <SubjectOverview
                    items={library}
                    withStudySet={new Set(studySets.map((x) => x.documentId))}
                    positions={positions}
                    onSelect={(id) => {
                      setSelectedId(id);
                      window.scrollTo({ top: 0 });
                    }}
                  />
                ) : null}
              </>
            )}

            <p className="pb-4 text-center text-xs text-muted-foreground">
              {progressMode === "account"
                ? "Fremgangen din lagres på kontoen din."
                : "Fremgangen din lagres i denne nettleseren."}{" "}
              Lydbøkene er laget med norsk tale (Piper).
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

