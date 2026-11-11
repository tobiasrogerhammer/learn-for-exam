"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { chapterSeekTargets } from "@/lib/sentences";

const SKIP_SECONDS = 15;

export type AudioProgress = {
  currentTime: number;
  duration: number;
  playing: boolean;
};

type Props = {
  src: string | null;
  title?: string;
  disabled?: boolean;
  /** Nested inside another card — no outer border/background */
  embedded?: boolean;
  /** Kept for API compatibility; tempo is shown elsewhere on the document */
  speakingRate?: number | null;
  /** Absolute start times (seconds) for each chapter in order */
  chapterStarts?: number[];
  /** Where to start when the audio has loaded, e.g. where you stopped last time */
  startAt?: number;
  /** Stop here, e.g. at the end of a chapter */
  endAt?: number;
  /** Shown instead of the title when there is no audio */
  emptyText?: string;
  onProgress?: (progress: AudioProgress) => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  title,
  disabled,
  embedded,
  chapterStarts = [],
  startAt,
  endAt,
  emptyText = "Generer tale for å starte avspilling",
  onProgress,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onProgressRef = useRef(onProgress);
  const startAtRef = useRef(startAt);
  const endAtRef = useRef(endAt);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const chapterTargets = useMemo(
    () => chapterSeekTargets(chapterStarts, current),
    [chapterStarts, current],
  );

  const atFirstChapterStart =
    chapterStarts.length > 0 &&
    chapterTargets.previous != null &&
    Math.abs(current - (chapterStarts[0] ?? 0)) < 0.25 &&
    chapterTargets.previous === (chapterStarts[0] ?? 0);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    startAtRef.current = startAt;
    endAtRef.current = endAt;
  }, [startAt, endAt]);

  const emitProgress = (next: AudioProgress) => {
    onProgressRef.current?.(next);
  };

  // Runs before the listeners below, so a reset never wipes metadata that is already loaded
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
    onProgressRef.current?.({
      currentTime: 0,
      duration: 0,
      playing: false,
    });
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = 1;
    audio.defaultPlaybackRate = 1;

    const onTime = () => {
      const t = audio.currentTime;
      const end = endAtRef.current;
      if (end != null && !audio.paused && t >= end) audio.pause();
      const d = audio.duration || 0;
      setCurrent(t);
      emitProgress({
        currentTime: t,
        duration: d,
        playing: !audio.paused,
      });
    };
    const onMeta = () => {
      const d = audio.duration || 0;
      setDuration(d);
      audio.playbackRate = 1;
      const resume = startAtRef.current;
      if (resume && resume > 0 && resume < d - 1 && audio.currentTime < 0.5) {
        audio.currentTime = resume;
        setCurrent(resume);
      }
      emitProgress({
        currentTime: audio.currentTime,
        duration: d,
        playing: !audio.paused,
      });
    };
    const onEnded = () => {
      setPlaying(false);
      emitProgress({
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
        playing: false,
      });
    };
    const onPlay = () => {
      audio.playbackRate = 1;
      setPlaying(true);
      emitProgress({
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
        playing: true,
      });
    };
    const onPause = () => {
      setPlaying(false);
      emitProgress({
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
        playing: false,
      });
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    // A cached file can finish loading before the listeners are attached
    if (audio.readyState >= 1) onMeta();
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [src]);

  // timeupdate only fires a few times a second; follow every frame while playing
  // so the timeline glides instead of moving in steps
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setCurrent(audio.currentTime);
        const end = endAtRef.current;
        if (end != null && !audio.paused && audio.currentTime >= end) audio.pause();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const seekTo = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    const d = audio.duration || duration || 0;
    const next = Math.min(Math.max(time, 0), d || 0);
    audio.currentTime = next;
    setCurrent(next);
    emitProgress({
      currentTime: next,
      duration: d,
      playing: !audio.paused,
    });
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !src || disabled) return;
    audio.playbackRate = 1;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  const controlsDisabled = !src || disabled;
  // With a stop point the timeline covers only that part, e.g. one chapter
  const from = endAt != null ? (startAt ?? 0) : 0;
  const to = endAt != null ? Math.min(endAt, duration || endAt) : duration;

  return (
    <div
      className={
        embedded
          ? "pt-1"
          : "rounded-md border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur"
      }
    >
      <audio ref={audioRef} src={src ?? undefined} preload="metadata" />

      {!src ? (
        <p
          className={
            embedded
              ? "mb-3 text-sm text-muted-foreground"
              : "mb-3 font-[family-name:var(--font-reading)] text-lg text-foreground"
          }
        >
          {emptyText}
        </p>
      ) : !embedded ? (
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Avspilling
          </p>
          <p className="mt-1 font-[family-name:var(--font-reading)] text-lg text-foreground">
            {title || "Lyd"}
          </p>
        </div>
      ) : null}

      <div className="min-w-0">
        <Slider
          value={[Math.min(Math.max(current, from), to)]}
          min={from}
          max={to || 1}
          step={0.01}
          disabled={!src}
          onValueChange={(v) => {
            const next = Array.isArray(v) ? v[0] : v;
            seekTo(next);
          }}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatTime(current - from)}</span>
          <span>{formatTime(to - from)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {chapterStarts.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={controlsDisabled || atFirstChapterStart}
            onClick={() => {
              if (chapterTargets.previous == null) return;
              seekTo(chapterTargets.previous);
            }}
            aria-label="Hopp til starten av kapittelet eller forrige kapittel"
            title="Start av kapittel / forrige"
          >
            <SkipBack className="size-4" />
            <span className="hidden sm:inline">Kapittel</span>
          </Button>
        ) : null}

        <Button
          type="button"
          variant="outline"
          disabled={controlsDisabled}
          onClick={() => seekTo(current - SKIP_SECONDS)}
          aria-label={`Hopp ${SKIP_SECONDS} sekunder bakover`}
        >
          <RotateCcw className="size-4" />
          15s
        </Button>

        <Button
          type="button"
          onClick={toggle}
          disabled={controlsDisabled}
          aria-label={playing ? "Pause" : "Spill av"}
          className="min-w-16 px-5"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>

        <Button
          type="button"
          variant="outline"
          disabled={controlsDisabled}
          onClick={() => seekTo(current + SKIP_SECONDS)}
          aria-label={`Hopp ${SKIP_SECONDS} sekunder fremover`}
        >
          15s
          <RotateCw className="size-4" />
        </Button>

        {chapterStarts.length > 1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={controlsDisabled || chapterTargets.next == null}
            onClick={() => {
              if (chapterTargets.next == null) return;
              seekTo(chapterTargets.next);
            }}
            aria-label="Hopp til neste kapittel"
            title="Neste kapittel"
          >
            <span className="hidden sm:inline">Kapittel</span>
            <SkipForward className="size-4" />
          </Button>
        ) : null}
      </div>

    </div>
  );
}
