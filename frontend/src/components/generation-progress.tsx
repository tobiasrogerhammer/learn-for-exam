"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { JobProgress } from "@/lib/types";

type Props = {
  progress: JobProgress | null;
  active: boolean;
  onRetry?: () => void;
  busy?: boolean;
};

/** Only renders while generation is running, or when failed chunks need retry. */
export function GenerationProgress({
  progress,
  active,
  onRetry,
  busy,
}: Props) {
  const hasFailures = (progress?.failed_chunks ?? 0) > 0;
  if (!progress || (!active && !hasFailures)) return null;

  const percent = Math.round(progress.progress * 100);
  const showBar = active;

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/40 px-3 py-3">
      {showBar ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Genererer tale…</span>
            <span className="tabular-nums text-muted-foreground">
              {percent}%
            </span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
      ) : null}

      {hasFailures ? (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p>{progress.failed_chunks} del(er) feilet.</p>
            {progress.error ? (
              <p className="mt-1 text-xs opacity-80">{progress.error}</p>
            ) : null}
          </div>
          {onRetry ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onRetry}
            >
              <RefreshCw className="size-3.5" />
              Prøv igjen
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
