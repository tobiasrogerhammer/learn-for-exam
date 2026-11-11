"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudUpload, Download, FileText, Loader2, X } from "lucide-react";
import { AudioPlayer, type AudioProgress } from "@/components/audio-player";
import { ChapterNav } from "@/components/chapter-nav";
import { GenerationProgress } from "@/components/generation-progress";
import { SentenceFollow } from "@/components/sentence-follow";
import { Button } from "@/components/ui/button";
import {
  getListenPosition,
  publishAudiobook,
  saveListenPosition,
  saveScript,
  scriptFromFiles,
} from "@/lib/audiobook";
import { getLastJobId, setLastJobId } from "@/lib/library";
import {
  buildTimedSentences,
  buildTimedSentencesFromChunks,
  chapterStartBySectionId,
  chapterStartTimes,
  sentenceIndexAtTime,
  sentenceWindow,
  toTimedChunkInputs,
} from "@/lib/sentences";
import { formatSpeakingRate } from "@/lib/speaking-rate";
import { chunkSections } from "@/lib/structure";
import { countWords } from "@/lib/text-cleanup";
import {
  audioUrl,
  createTtsJob,
  getJobProgress,
  retryFailedChunks,
} from "@/lib/tts-api";
import type { JobProgress, LibraryItem, Section } from "@/lib/types";

type Props = {
  item: LibraryItem;
  /** Only the admin talks to the local Piper backend */
  isAdmin: boolean;
  backendReady: boolean | null;
  /** Called after publishing, so the new audiobook is loaded */
  onLibraryChange: () => void;
};

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Lydbok for ett dokument. Everyone plays the published audiobook; the admin can
 * also make a new one with the local Piper backend and publish it.
 * Mount with key={item.id}.
 */
export function ListenView({ item, isAdmin, backendReady, onLibraryChange }: Props) {
  const audiobook = item.audiobook?.url ? item.audiobook : null;
  // Lytt reads the audiobook script when there is one, otherwise the document itself
  const script = item.script ?? null;
  const sections: Section[] = script?.sections ?? item.document.sections;
  const rawText = script?.rawText ?? item.document.rawText;
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    sections[0]?.id ?? null,
  );
  const scriptInput = useRef<HTMLInputElement>(null);
  const [savingScript, setSavingScript] = useState(false);
  const [job, setJob] = useState<JobProgress | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<AudioProgress>({
    currentTime: 0,
    duration: 0,
    playing: false,
  });
  const [autoScrollHighlight, setAutoScrollHighlight] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Where you stopped last time; read once so it doesn't jump while you listen
  const [resume] = useState(() => getListenPosition(item.id));
  const lastSaved = useRef(resume?.time ?? 0);

  // Pick up audio generated earlier on this machine, if the backend still has the job
  useEffect(() => {
    const jobId = isAdmin ? getLastJobId(item.id) : undefined;
    if (!jobId) return;
    let cancelled = false;
    void getJobProgress(jobId)
      .then((progress) => {
        if (cancelled) return;
        setJob(progress);
        if (progress.audio_ready) setAudioSrc(audioUrl(progress.job_id));
        if (progress.status === "queued" || progress.status === "processing") {
          setGenerating(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin, item.id]);

  // A local recording you just made wins over the published one until you publish it
  const playingLocal = !!audioSrc;
  const src = audioSrc ?? audiobook?.url ?? null;
  const timingChunks = useMemo(
    () =>
      playingLocal
        ? job?.chunks
        : audiobook?.chunks.map((c) => ({ id: c.id, duration_sec: c.durationSec })),
    [playingLocal, job, audiobook],
  );

  useEffect(() => {
    if (!job) return;
    if (
      job.status === "completed" ||
      job.status === "failed" ||
      (job.status === "partial" && !generating)
    ) {
      return;
    }

    const id = window.setInterval(() => {
      void getJobProgress(job.job_id)
        .then((next) => {
          setJob(next);
          if (next.audio_ready) setAudioSrc(audioUrl(next.job_id));
          if (
            next.status === "completed" ||
            next.status === "failed" ||
            next.status === "partial"
          ) {
            setGenerating(false);
          }
        })
        .catch(() => setGenerating(false));
    }, 800);

    return () => window.clearInterval(id);
  }, [job, generating]);

  const activeSection =
    sections.find((s) => s.id === activeSectionId) ?? null;

  const localChunks = useMemo(() => chunkSections(sections), [sections]);

  const timedSentences = useMemo(() => {
    if (timingChunks?.length) {
      return buildTimedSentencesFromChunks(
        toTimedChunkInputs(localChunks, timingChunks),
        audioProgress.duration || undefined,
      );
    }
    if (localChunks.length > 0) {
      return buildTimedSentencesFromChunks(
        toTimedChunkInputs(localChunks),
        audioProgress.duration || undefined,
      );
    }
    return buildTimedSentences(sections);
  }, [timingChunks, localChunks, sections, audioProgress.duration]);

  const followActive =
    audioProgress.playing || (audioProgress.currentTime > 0 && !!src);

  // Remember the position every few seconds and whenever you pause
  const handleProgress = useCallback(
    (next: AudioProgress) => {
      setAudioProgress(next);
      if (playingLocal || next.duration <= 0 || next.currentTime <= 0) return;
      const moved = Math.abs(next.currentTime - lastSaved.current);
      if (moved >= 5 || (!next.playing && moved >= 0.5)) {
        lastSaved.current = next.currentTime;
        saveListenPosition(item.id, next.currentTime, next.duration);
      }
    },
    [playingLocal, item.id],
  );

  const currentSentenceIndex = useMemo(() => {
    if (!followActive) return -1;
    return sentenceIndexAtTime(
      timedSentences,
      audioProgress.currentTime,
      audioProgress.duration,
    );
  }, [followActive, timedSentences, audioProgress]);

  const { current } = useMemo(
    () => sentenceWindow(timedSentences, currentSentenceIndex),
    [timedSentences, currentSentenceIndex],
  );

  const chapterStarts = useMemo(
    () => chapterStartTimes(timedSentences),
    [timedSentences],
  );

  const startTimesBySectionId = useMemo(
    () => chapterStartBySectionId(timedSentences),
    [timedSentences],
  );

  const spokenSectionId =
    followActive && current?.sectionId
      ? current.sectionId
      : activeSectionId;
  const chapterIndex = Math.max(
    1,
    sections.findIndex((s) => s.id === spokenSectionId) + 1,
  );
  const chapterTotal = Math.max(sections.length, 1);
  const chapterTitle =
    sections.find((s) => s.id === spokenSectionId)?.title ?? null;

  const currentSectionId = current?.sectionId;
  const chapterSentences = useMemo(
    () =>
      currentSectionId
        ? timedSentences.filter((s) => s.sectionId === currentSectionId)
        : [],
    [timedSentences, currentSectionId],
  );

  const { sentenceIndex, sentenceTotal } = useMemo(() => {
    if (!current?.sectionId) {
      return { sentenceIndex: 0, sentenceTotal: 0 };
    }
    const inChapter = timedSentences.filter(
      (s) => s.sectionId === current.sectionId,
    );
    const idx = inChapter.findIndex((s) => s.index === current.index);
    return {
      sentenceIndex: idx >= 0 ? idx + 1 : 0,
      sentenceTotal: inChapter.length,
    };
  }, [timedSentences, current]);

  // Keep the spoken chapter open while "Følg markert setning" is on
  useEffect(() => {
    if (!autoScrollHighlight || !followActive || !current?.sectionId) return;
    setActiveSectionId(current.sectionId);
  }, [autoScrollHighlight, followActive, current?.sectionId]);

  const words = useMemo(() => countWords(rawText), [rawText]);

  const startGeneration = useCallback(async () => {
    const rate = item.speakingRate;
    if (rate == null) {
      setError("Dokumentet mangler taletempo — last opp på nytt og velg tempo");
      return;
    }
    setError(null);
    setGenerating(true);
    setAudioSrc(null);
    try {
      const chunks = chunkSections(sections);
      if (chunks.length === 0) throw new Error("Dokumentet har ingen tekst");
      const created = await createTtsJob(item.title, chunks, rate);
      setLastJobId(item.id, created.job_id);
      const progress = await getJobProgress(created.job_id);
      setJob(progress);
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : "Generering feilet");
    }
  }, [item, sections]);

  const handleScriptFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setSavingScript(true);
    setError(null);
    try {
      await saveScript(item.id, await scriptFromFiles([...files], item.title));
      onLibraryChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lagre manuset");
    } finally {
      setSavingScript(false);
      if (scriptInput.current) scriptInput.current.value = "";
    }
  };

  const handleRemoveScript = async () => {
    if (!window.confirm("Fjerne lydbokmanuset? Lytt viser da dokumentet i stedet.")) return;
    setSavingScript(true);
    try {
      await saveScript(item.id, null);
      onLibraryChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke fjerne manuset");
    } finally {
      setSavingScript(false);
    }
  };

  // The audio was made from an older script, so the text no longer lines up
  const audioOutdated =
    !!audiobook && !!script && script.updatedAt > audiobook.publishedAt;

  const handlePublish = async () => {
    if (!job) return;
    setPublishing(true);
    setError(null);
    try {
      await publishAudiobook(item.id, job, job.speaking_rate ?? item.speakingRate);
      setAudioSrc(null);
      onLibraryChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publisering feilet");
    } finally {
      setPublishing(false);
    }
  };

  const handleRetry = async () => {
    if (!job) return;
    setGenerating(true);
    setError(null);
    try {
      const next = await retryFailedChunks(job.job_id);
      setJob(next);
    } catch (err) {
      setGenerating(false);
      setError(err instanceof Error ? err.message : "Retry feilet");
    }
  };

  return (
    <>
      <section className="rounded-md border border-border/70 bg-card/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Lytt
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-reading)] text-3xl leading-tight">
              {item.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {sections.length} kapitler · {words.toLocaleString("nb-NO")} ord
              {item.speakingRate != null
                ? ` · tempo ${formatSpeakingRate(item.speakingRate)}`
                : ""}
            </p>
          </div>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              {audioSrc ? (
                <>
                  <Button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={publishing || generating}
                  >
                    {publishing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CloudUpload className="size-3.5" />
                    )}
                    {audiobook ? "Publiser ny versjon" : "Publiser lydbok"}
                  </Button>
                  <a
                    href={audioSrc}
                    download={`${item.title || "tale"}.wav`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3.5 text-sm font-medium hover:bg-muted"
                  >
                    <Download className="size-3.5" />
                    WAV
                  </a>
                </>
              ) : (
                <Button
                  type="button"
                  variant={audiobook ? "outline" : "default"}
                  onClick={() => void startGeneration()}
                  disabled={
                    generating ||
                    backendReady !== true ||
                    item.speakingRate == null
                  }
                  title={
                    backendReady !== true
                      ? "Start den lokale backenden med Piper for å lage tale"
                      : undefined
                  }
                >
                  {generating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {audiobook ? "Lag på nytt" : "Generer tale"}
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {isAdmin ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-3.5" />
            {script ? (
              <span className="min-w-0 truncate" title={script.files.join(", ")}>
                Lydbokmanus: {script.files.join(" + ")}
              </span>
            ) : (
              <span>Ingen lydbokmanus, Lytt bruker teksten i dokumentet</span>
            )}
            <input
              ref={scriptInput}
              type="file"
              accept=".txt,.md,text/plain"
              multiple
              className="hidden"
              onChange={(e) => void handleScriptFiles(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={savingScript || generating}
              onClick={() => scriptInput.current?.click()}
              title="Velg én eller flere TXT-filer; flere filer settes sammen i navnerekkefølge"
            >
              {savingScript ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {script ? "Bytt manus" : "Last opp manus"}
            </Button>
            {script ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={savingScript || generating}
                onClick={() => void handleRemoveScript()}
                aria-label="Fjern lydbokmanus"
                title="Fjern lydbokmanus"
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </div>
        ) : null}
        {isAdmin && audioOutdated ? (
          <p className="mt-3 text-sm text-amber-700">
            Manuset er endret etter at lydboken ble publisert. Generer tale og publiser på nytt, så
            teksten følger lyden.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {playingLocal && isAdmin ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Du hører den lokale versjonen. Publiser den for at andre skal kunne høre den.
          </p>
        ) : null}
        {!playingLocal && resume && resume.time > 1 && !audioProgress.playing &&
        Math.abs(audioProgress.currentTime - resume.time) < 1 && src ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Fortsetter der du slapp, på {formatClock(resume.time)} av{" "}
            {formatClock(resume.duration)}.
          </p>
        ) : null}

        <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
          <GenerationProgress
            progress={job}
            active={generating}
            onRetry={() => void handleRetry()}
            busy={generating}
          />
          <div className="overflow-hidden rounded-md border border-border/60">
            <SentenceFollow
              sentences={chapterSentences}
              current={followActive ? current : null}
              currentTime={audioProgress.currentTime}
              active={followActive}
              chapterIndex={chapterIndex}
              chapterTotal={chapterTotal}
              chapterTitle={chapterTitle}
              sentenceIndex={sentenceIndex}
              sentenceTotal={sentenceTotal}
            />
          </div>
          <AudioPlayer
            src={src}
            title={item.title}
            disabled={!src || generating}
            embedded
            chapterStarts={chapterStarts}
            startAt={playingLocal ? undefined : resume?.time}
            emptyText={
              isAdmin
                ? "Generer tale for å lage en lydbok"
                : "Det finnes ingen lydbok for dette dokumentet ennå"
            }
            speakingRate={
              (playingLocal ? job?.speaking_rate : audiobook?.speakingRate) ??
              item.speakingRate ??
              null
            }
            onProgress={handleProgress}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-border/70 bg-card/80 shadow-sm">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Kapitler
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 rounded-sm border border-border accent-primary"
                checked={autoScrollHighlight}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAutoScrollHighlight(on);
                  if (on) {
                    const sectionId = current?.sectionId ?? spokenSectionId;
                    if (sectionId) setActiveSectionId(sectionId);
                  }
                }}
              />
              Følg markert setning
            </label>
          </div>
          <ChapterNav
            sections={sections}
            activeId={activeSection?.id}
            spokenId={followActive ? (current?.sectionId ?? null) : null}
            startTimesBySectionId={startTimesBySectionId}
            highlightText={followActive ? current?.text : null}
            autoScrollHighlight={autoScrollHighlight}
            onSelect={(id) =>
              setActiveSectionId((prev) => (prev === id ? null : id))
            }
          />
        </div>
      </section>
    </>
  );
}
