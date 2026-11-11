from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from typing import Any

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.models.schemas import (
    CreateJobRequest,
    CreateJobResponse,
    HealthResponse,
    JobProgress,
    StudyGenerateRequest,
    StudyHealthResponse,
    StudySetOut,
)
from app.services import store
from app.services.audio import wav_to_mp3
from app.services.queue import job_queue
from app.services.study import (
    StudyGenerationError,
    generate_study_set,
    study_model,
    study_ready,
)
from app.services.tts import piper_service

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        piper_service.load()
    except FileNotFoundError as exc:
        logger.warning("Voice model not loaded yet: %s", exc)
    job_queue.start()
    yield
    await job_queue.stop()


app = FastAPI(
    title="Lær for eksamen TTS",
    description="Local Norwegian Piper TTS for course materials",
    version="0.1.0",
    lifespan=lifespan,
)

# The published site (e.g. https://your-site.vercel.app) can reach Piper on this
# machine when listed in CORS_ORIGINS, so you can make audiobooks from there
extra_origins = [
    o.strip().rstrip("/")
    for o in os.environ.get("CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def allow_private_network(request: Request, call_next):
    # Chrome asks before a public site may call 127.0.0.1; this header says yes
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    ready = piper_service.ready
    sample_rate = 0
    if ready:
        try:
            sample_rate = piper_service.sample_rate
        except Exception:
            ready = False
    return HealthResponse(
        status="ok" if ready else "degraded",
        voice=piper_service.voice_name,
        sample_rate=sample_rate,
        ready=ready,
    )


@app.post("/tts/jobs", response_model=CreateJobResponse)
async def create_job(request: CreateJobRequest) -> CreateJobResponse:
    if not piper_service.ready:
        raise HTTPException(
            status_code=503,
            detail=(
                "Norwegian Piper model is missing. "
                "Download with: python -m piper.download_voices "
                "no_NO-talesyntese-medium --data-dir models"
            ),
        )
    try:
        job = await job_queue.create_job(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CreateJobResponse(
        job_id=job.job_id,
        status=job.status,
        total_chunks=len(job.chunks),
    )


@app.get("/tts/jobs/{job_id}", response_model=JobProgress)
def get_job(job_id: str) -> JobProgress:
    progress = job_queue.get_progress(job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")
    return progress


@app.post("/tts/jobs/{job_id}/retry", response_model=JobProgress)
async def retry_job(job_id: str) -> JobProgress:
    progress = await job_queue.retry_failed(job_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Job not found")
    return progress


@app.get("/tts/jobs/{job_id}/audio")
def download_audio(job_id: str) -> FileResponse:
    path = job_queue.audio_path(job_id)
    if not path:
        raise HTTPException(status_code=404, detail="Audio not ready")
    filename = f"{job_id}.wav"
    return FileResponse(
        path=path,
        media_type="audio/wav",
        filename=filename,
    )


@app.get("/tts/jobs/{job_id}/audio.mp3")
def download_mp3(job_id: str) -> FileResponse:
    """The finished audio as MP3, about a tenth of the WAV, for publishing."""
    path = job_queue.audio_path(job_id)
    if not path:
        raise HTTPException(status_code=404, detail="Audio not ready")
    mp3 = path.with_suffix(".mp3")
    if not mp3.exists() or mp3.stat().st_mtime < path.stat().st_mtime:
        wav_to_mp3(path, mp3)
    return FileResponse(path=mp3, media_type="audio/mpeg", filename=f"{job_id}.mp3")


@app.get("/study/health", response_model=StudyHealthResponse)
def study_health() -> StudyHealthResponse:
    return StudyHealthResponse(ready=study_ready(), model=study_model())


@app.post("/study/generate", response_model=StudySetOut)
def generate_study(request: StudyGenerateRequest) -> StudySetOut:
    # Sync endpoint: FastAPI runs it in a worker thread while Claude streams
    try:
        return generate_study_set(request)
    except StudyGenerationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@app.get("/store")
def read_store() -> dict[str, Any]:
    """Everything the frontend has saved, keyed by its storage key."""
    return store.read_all()


@app.put("/store/{key}", status_code=204)
def write_store(key: str, value: Any = Body(...)) -> None:
    if not store.valid_key(key):
        raise HTTPException(status_code=400, detail="Ugyldig lagringsnøkkel")
    store.write(key, value)
