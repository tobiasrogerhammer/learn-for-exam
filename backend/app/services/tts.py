from __future__ import annotations

import logging
import wave
from pathlib import Path
from threading import Lock

from piper import PiperVoice, SynthesisConfig

logger = logging.getLogger(__name__)

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = BACKEND_ROOT / "models" / "no_NO-talesyntese-medium.onnx"


class PiperService:
    """Singleton wrapper around the Norwegian Piper voice."""

    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = Path(model_path) if model_path else DEFAULT_MODEL
        self._voice: PiperVoice | None = None
        self._lock = Lock()

    @property
    def ready(self) -> bool:
        return self.model_path.exists()

    @property
    def voice_name(self) -> str:
        return self.model_path.stem

    def load(self) -> None:
        if self._voice is not None:
            return
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Norwegian voice model not found at {self.model_path}. "
                "Run: python -m piper.download_voices no_NO-talesyntese-medium --data-dir models"
            )
        logger.info("Loading Piper voice from %s", self.model_path)
        self._voice = PiperVoice.load(str(self.model_path))
        logger.info(
            "Voice ready: %s (%s Hz)",
            self.voice_name,
            self._voice.config.sample_rate,
        )

    @property
    def sample_rate(self) -> int:
        self.load()
        assert self._voice is not None
        return int(self._voice.config.sample_rate)

    def synthesize_to_wav(
        self,
        text: str,
        output_path: Path,
        *,
        speaking_rate: float = 1.0,
    ) -> None:
        """Synthesize a single text chunk to a WAV file (thread-safe).

        speaking_rate follows player convention (0.75 = slower, 2 = faster).
        Piper length_scale is the inverse (higher = slower speech).
        """
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("Cannot synthesize empty text")

        rate = max(0.5, min(float(speaking_rate), 2.0))
        length_scale = 1.0 / rate

        self.load()
        assert self._voice is not None

        syn_config = SynthesisConfig(length_scale=length_scale)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            with wave.open(str(output_path), "wb") as wav_file:
                self._voice.synthesize_wav(
                    cleaned,
                    wav_file,
                    syn_config=syn_config,
                )


piper_service = PiperService()
