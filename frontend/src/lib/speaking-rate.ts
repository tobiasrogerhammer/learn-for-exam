/** Piper speaking rates available at document upload (0.75–1.25, step 0.05). */
export const SPEEDS = Array.from(
  { length: 11 },
  (_, i) => Number(((75 + i * 5) / 100).toFixed(2)),
) as readonly number[];

export type SpeakingRate = (typeof SPEEDS)[number];

export function formatSpeakingRate(rate: number): string {
  return `${Number(rate).toFixed(2).replace(/\.?0+$/, "") || rate}x`;
}

export function isSpeakingRate(value: number): value is SpeakingRate {
  return SPEEDS.some((s) => Math.abs(s - value) < 0.001);
}
