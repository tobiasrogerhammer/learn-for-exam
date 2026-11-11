"use client";

import { useRef, useState } from "react";
import { FileUp, ClipboardPaste, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpeakingRateSlider } from "@/components/speaking-rate-slider";
import { extractFromFile, extractFromPaste } from "@/lib/extract";
import { formatSpeakingRate, type SpeakingRate } from "@/lib/speaking-rate";
import { countWords } from "@/lib/text-cleanup";
import type { ExtractedDocument } from "@/lib/types";

type Props = {
  onDocument: (doc: ExtractedDocument, speakingRate: SpeakingRate) => void;
  compact?: boolean;
};

export function UploadPanel({ onDocument, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<ExtractedDocument | null>(null);
  const [speakingRate, setSpeakingRate] = useState<SpeakingRate>(1);

  const handleFiles = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length > 1) return handleMany(list);
    const file = list[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await extractFromFile(file);
      setPendingDoc(doc);
      setSpeakingRate(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke lese filen");
    } finally {
      setBusy(false);
    }
  };

  /** Several files skip the tempo step and are saved at normal speed */
  const handleMany = async (list: File[]) => {
    setBusy(true);
    setError(null);
    const failed: string[] = [];
    for (const file of list) {
      try {
        onDocument(await extractFromFile(file), 1);
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(false);
    if (failed.length) setError(`Kunne ikke lese: ${failed.join(", ")}`);
  };

  const handlePaste = () => {
    if (!paste.trim()) {
      setError("Lim inn tekst først");
      return;
    }
    setError(null);
    setPendingDoc(extractFromPaste(paste));
    setSpeakingRate(1);
    setPaste("");
  };

  const confirmWithRate = () => {
    if (!pendingDoc) return;
    onDocument(pendingDoc, speakingRate);
    setPendingDoc(null);
    setSpeakingRate(1);
  };

  if (pendingDoc) {
    return (
      <div
        className={`rounded-md border border-border/70 bg-card/80 ${
          compact ? "p-4" : "p-5"
        }`}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mb-3"
          onClick={() => {
            setPendingDoc(null);
            setSpeakingRate(1);
            setError(null);
          }}
        >
          <ArrowLeft className="size-3.5" />
          Tilbake
        </Button>

        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Dokument lastet opp
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-reading)] text-2xl">
          {pendingDoc.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingDoc.sections.length} kapitler ·{" "}
          {countWords(pendingDoc.rawText).toLocaleString("nb-NO")} ord
        </p>

        <div className="mt-5 rounded-md border border-border/70 bg-muted/30 px-4 py-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Velg taletempo
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Dra slidern (0.75x–1.25x)
              </p>
            </div>
            <p className="font-[family-name:var(--font-reading)] text-2xl tabular-nums text-foreground">
              {formatSpeakingRate(speakingRate)}
            </p>
          </div>
          <SpeakingRateSlider
            value={speakingRate}
            onChange={(rate) => {
              setSpeakingRate(rate);
              setError(null);
            }}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={confirmWithRate}>
            Lagre i emnet
          </Button>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-border/70 bg-card/80 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div
        className={`rounded-md border border-dashed text-center transition ${
          compact ? "px-4 py-5" : "px-6 py-8"
        } ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border/80 bg-muted/20"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
      >
        <FileUp className="mx-auto mb-2 size-7 text-muted-foreground" />
        <p className="font-[family-name:var(--font-reading)] text-lg">
          Last opp pensum
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOCX eller TXT, trekkes ut lokalt. Velg gjerne flere filer på en gang.
        </p>
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Velg filer
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <ClipboardPaste className="size-4" />
          Eller lim inn tekst
        </div>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={compact ? 4 : 5}
          placeholder="Lim inn forelesningsnotater eller kapitteltekst her…"
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="secondary" onClick={handlePaste}>
            Bruk tekst
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
