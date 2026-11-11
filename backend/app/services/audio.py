from __future__ import annotations

import wave
from pathlib import Path

# Extra silence inserted between sentence chunks when merging
SENTENCE_GAP_SEC = 0.45


def wav_duration_seconds(path: Path) -> float:
    """Return duration of a WAV file in seconds."""
    with wave.open(str(path), "rb") as src:
        frames = src.getnframes()
        rate = src.getframerate()
        if rate <= 0:
            return 0.0
        return frames / float(rate)


def _silence_bytes(
    nchannels: int, sampwidth: int, framerate: int, duration_sec: float
) -> bytes:
    if duration_sec <= 0 or framerate <= 0:
        return b""
    nframes = int(round(framerate * duration_sec))
    return b"\x00" * (nframes * nchannels * sampwidth)


def merge_wav_files(
    chunk_paths: list[Path],
    output_path: Path,
    *,
    gap_sec: float = SENTENCE_GAP_SEC,
) -> Path:
    """Concatenate WAV chunks in order, with optional silence between them."""
    if not chunk_paths:
        raise ValueError("No audio chunks to merge")

    params = None
    frames: list[bytes] = []

    for i, path in enumerate(chunk_paths):
        if not path.exists():
            raise FileNotFoundError(f"Missing chunk audio: {path}")
        with wave.open(str(path), "rb") as src:
            current = src.getparams()
            if params is None:
                params = current
            elif (
                current.nchannels != params.nchannels
                or current.sampwidth != params.sampwidth
                or current.framerate != params.framerate
            ):
                raise ValueError(f"Incompatible WAV format in {path}")
            frames.append(src.readframes(src.getnframes()))

        if params is not None and gap_sec > 0 and i < len(chunk_paths) - 1:
            frames.append(
                _silence_bytes(
                    params.nchannels,
                    params.sampwidth,
                    params.framerate,
                    gap_sec,
                )
            )

    assert params is not None
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output_path), "wb") as out:
        out.setparams(params)
        for frame in frames:
            out.writeframes(frame)

    return output_path


def wav_to_mp3(wav_path: Path, mp3_path: Path, *, bitrate_kbps: int = 64) -> Path:
    """Encode a mono or stereo 16-bit WAV as MP3, for publishing audiobooks."""
    import lameenc

    with wave.open(str(wav_path), "rb") as src:
        if src.getsampwidth() != 2:
            raise ValueError("Only 16-bit WAV can be encoded")
        encoder = lameenc.Encoder()
        encoder.set_bit_rate(bitrate_kbps)
        encoder.set_in_sample_rate(src.getframerate())
        encoder.set_channels(src.getnchannels())
        encoder.set_quality(2)
        data = encoder.encode(src.readframes(src.getnframes()))
        data += encoder.flush()

    tmp = mp3_path.with_suffix(".mp3.tmp")
    tmp.write_bytes(data)
    tmp.replace(mp3_path)
    return mp3_path
