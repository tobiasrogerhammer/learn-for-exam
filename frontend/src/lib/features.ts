/**
 * Audiobooks are only shown where NEXT_PUBLIC_SHOW_AUDIOBOOKS=true is set,
 * i.e. in .env.local on your own machine. The published site leaves it out,
 * so audio is neither shown nor streamed from Convex there.
 */
export const showAudiobooks = process.env.NEXT_PUBLIC_SHOW_AUDIOBOOKS === "true";
