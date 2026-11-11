"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import {
  SPEEDS,
  formatSpeakingRate,
  type SpeakingRate,
} from "@/lib/speaking-rate";

type Props = {
  value: SpeakingRate;
  onChange: (rate: SpeakingRate) => void;
};

function tickKind(rate: number): "center" | "major" | "minor" {
  if (Math.abs(rate - 1) < 0.001) return "center";
  const hundredths = Math.round(rate * 100);
  if (hundredths % 10 === 0) return "major";
  return "minor";
}

export function SpeakingRateSlider({ value, onChange }: Props) {
  const index = Math.max(
    0,
    SPEEDS.findIndex((s) => Math.abs(s - value) < 0.001),
  );

  return (
    <div className="w-full">
      <SliderPrimitive.Root
        className="w-full"
        min={0}
        max={SPEEDS.length - 1}
        step={1}
        value={[index]}
        thumbAlignment="edge"
        onValueChange={(v) => {
          const idx = Array.isArray(v) ? v[0] : v;
          const next = SPEEDS[idx];
          if (next != null) onChange(next);
        }}
      >
        <SliderPrimitive.Control className="relative flex h-9 w-full touch-none items-center select-none">
          <SliderPrimitive.Track className="relative h-1 w-full grow overflow-visible rounded-full bg-muted">
            <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />

            {/* Ticks through the track, behind the thumb */}
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 flex -translate-y-1/2 items-center justify-between"
              aria-hidden
            >
              {SPEEDS.map((rate) => {
                const kind = tickKind(rate);
                const isActive = Math.abs(rate - value) < 0.001;
                // Hide the tick under the thumb
                if (isActive) {
                  return <span key={rate} className="h-6 w-[3px] opacity-0" />;
                }
                return (
                  <span
                    key={rate}
                    title={formatSpeakingRate(rate)}
                    className={`rounded-full ${
                      kind === "center"
                        ? "h-6 w-[3px] bg-primary"
                        : kind === "major"
                          ? "h-5 w-0.5 bg-foreground/60"
                          : "h-3.5 w-px bg-foreground/45"
                    }`}
                  />
                );
              })}
            </div>
          </SliderPrimitive.Track>

          <SliderPrimitive.Thumb className="relative z-20 block size-3.5 shrink-0 rounded-full border border-ring bg-white shadow-sm ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3" />
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>

      <div className="mt-2 flex justify-between text-[0.7rem] tabular-nums text-muted-foreground">
        <span>{formatSpeakingRate(SPEEDS[0])}</span>
        <span className="font-medium text-primary">1x</span>
        <span>{formatSpeakingRate(SPEEDS[SPEEDS.length - 1])}</span>
      </div>
    </div>
  );
}
