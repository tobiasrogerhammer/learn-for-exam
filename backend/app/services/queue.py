from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from app.models.schemas import (
    ChunkStatus,
    ChunkState,
    CreateJobRequest,
    JobProgress,
    JobStatus,
    TextChunkIn,
)
from app.services.audio import (
    SENTENCE_GAP_SEC,
    merge_wav_files,
    wav_duration_seconds,
)
from app.services.tts import BACKEND_ROOT, piper_service

logger = logging.getLogger(__name__)

DATA_DIR = BACKEND_ROOT / "data"
JOBS_DIR = DATA_DIR / "jobs"
AUDIO_DIR = DATA_DIR / "audio"


@dataclass
class InternalChunk:
    id: str
    index: int
    text: str
    title: Optional[str]
    status: ChunkStatus = ChunkStatus.pending
    error: Optional[str] = None
    duration_sec: Optional[float] = None


@dataclass
class InternalJob:
    job_id: str
    title: str
    status: JobStatus = JobStatus.queued
    chunks: list[InternalChunk] = field(default_factory=list)
    error: Optional[str] = None
    audio_path: Optional[Path] = None
    speaking_rate: float = 1.0


class JobQueue:
    """Sequential TTS job queue with per-chunk recovery."""

    def __init__(self) -> None:
        self._jobs: dict[str, InternalJob] = {}
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        JOBS_DIR.mkdir(parents=True, exist_ok=True)
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    def start(self) -> None:
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

    async def create_job(self, request: CreateJobRequest) -> InternalJob:
        job_id = uuid.uuid4().hex
        chunks = [
            InternalChunk(
                id=chunk.id or f"chunk-{i}",
                index=i,
                text=chunk.text.strip(),
                title=chunk.title,
            )
            for i, chunk in enumerate(request.chunks)
            if chunk.text.strip()
        ]
        if not chunks:
            raise ValueError("Job has no non-empty text chunks")

        job = InternalJob(
            job_id=job_id,
            title=request.title,
            chunks=chunks,
            speaking_rate=float(request.speaking_rate),
        )
        job_dir = JOBS_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        self._persist_meta(job)

        async with self._lock:
            self._jobs[job_id] = job

        await self._queue.put(job_id)
        return job

    def get_job(self, job_id: str) -> Optional[InternalJob]:
        return self._jobs.get(job_id)

    def get_progress(self, job_id: str) -> Optional[JobProgress]:
        job = self._jobs.get(job_id)
        if not job:
            return None
        return self._to_progress(job)

    async def retry_failed(self, job_id: str) -> Optional[JobProgress]:
        job = self._jobs.get(job_id)
        if not job:
            return None

        failed = [c for c in job.chunks if c.status == ChunkStatus.failed]
        if not failed:
            return self._to_progress(job)

        for chunk in failed:
            chunk.status = ChunkStatus.pending
            chunk.error = None

        job.status = JobStatus.queued
        job.error = None
        self._persist_meta(job)
        await self._queue.put(job_id)
        return self._to_progress(job)

    def audio_path(self, job_id: str) -> Optional[Path]:
        job = self._jobs.get(job_id)
        if not job or not job.audio_path or not job.audio_path.exists():
            return None
        return job.audio_path

    async def _worker_loop(self) -> None:
        logger.info("TTS job worker started")
        while True:
            job_id = await self._queue.get()
            try:
                await self._process_job(job_id)
            except Exception:
                logger.exception("Unhandled error processing job %s", job_id)
            finally:
                self._queue.task_done()

    async def _process_job(self, job_id: str) -> None:
        job = self._jobs.get(job_id)
        if not job:
            return

        job.status = JobStatus.processing
        self._persist_meta(job)
        job_dir = JOBS_DIR / job_id
        chunk_paths: list[Path] = []

        for chunk in job.chunks:
            chunk_wav = job_dir / f"{chunk.index:04d}.wav"
            if chunk.status == ChunkStatus.done and chunk_wav.exists():
                if chunk.duration_sec is None:
                    chunk.duration_sec = await asyncio.to_thread(
                        wav_duration_seconds, chunk_wav
                    )
                chunk_paths.append(chunk_wav)
                continue

            chunk.status = ChunkStatus.processing
            self._persist_meta(job)

            try:
                await asyncio.to_thread(
                    piper_service.synthesize_to_wav,
                    chunk.text,
                    chunk_wav,
                    speaking_rate=job.speaking_rate,
                )
                chunk.duration_sec = await asyncio.to_thread(
                    wav_duration_seconds, chunk_wav
                )
                chunk.status = ChunkStatus.done
                chunk.error = None
                chunk_paths.append(chunk_wav)
            except Exception as exc:
                logger.exception("Chunk %s failed in job %s", chunk.id, job_id)
                chunk.status = ChunkStatus.failed
                chunk.error = str(exc)
                chunk.duration_sec = None

            self._persist_meta(job)

        failed = sum(1 for c in job.chunks if c.status == ChunkStatus.failed)
        done = sum(1 for c in job.chunks if c.status == ChunkStatus.done)

        if chunk_paths:
            # Remeasure speech length, then add inter-sentence pause so
            # frontend highlighting stays aligned with the merged WAV.
            done_chunks = [c for c in job.chunks if c.status == ChunkStatus.done]
            for i, chunk in enumerate(done_chunks):
                wav_path = job_dir / f"{chunk.index:04d}.wav"
                speech = await asyncio.to_thread(wav_duration_seconds, wav_path)
                gap = SENTENCE_GAP_SEC if i < len(done_chunks) - 1 else 0.0
                chunk.duration_sec = speech + gap

        if failed == 0 and done == len(job.chunks):
            out = AUDIO_DIR / f"{job_id}.wav"
            await asyncio.to_thread(
                merge_wav_files, chunk_paths, out, gap_sec=SENTENCE_GAP_SEC
            )
            job.audio_path = out
            job.status = JobStatus.completed
            job.error = None
        elif done > 0:
            # Merge whatever succeeded so the user can listen while retrying
            if chunk_paths:
                out = AUDIO_DIR / f"{job_id}.wav"
                await asyncio.to_thread(
                    merge_wav_files, chunk_paths, out, gap_sec=SENTENCE_GAP_SEC
                )
                job.audio_path = out
            job.status = JobStatus.partial
            job.error = f"{failed} chunk(s) failed"
        else:
            job.status = JobStatus.failed
            job.error = "All chunks failed"

        self._persist_meta(job)

    def _persist_meta(self, job: InternalJob) -> None:
        meta = {
            "job_id": job.job_id,
            "title": job.title,
            "status": job.status.value,
            "error": job.error,
            "speaking_rate": job.speaking_rate,
            "audio_ready": bool(job.audio_path and job.audio_path.exists()),
            "chunks": [
                {
                    "id": c.id,
                    "index": c.index,
                    "title": c.title,
                    "status": c.status.value,
                    "error": c.error,
                    "char_count": len(c.text),
                    "text": c.text,
                    "duration_sec": c.duration_sec,
                }
                for c in job.chunks
            ],
        }
        path = JOBS_DIR / job.job_id / "meta.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    def _to_progress(self, job: InternalJob) -> JobProgress:
        completed = sum(1 for c in job.chunks if c.status == ChunkStatus.done)
        failed = sum(1 for c in job.chunks if c.status == ChunkStatus.failed)
        total = len(job.chunks)
        return JobProgress(
            job_id=job.job_id,
            title=job.title,
            status=job.status,
            total_chunks=total,
            completed_chunks=completed,
            failed_chunks=failed,
            progress=(completed / total) if total else 0.0,
            chunks=[
                ChunkState(
                    id=c.id,
                    index=c.index,
                    title=c.title,
                    status=c.status,
                    error=c.error,
                    char_count=len(c.text),
                    text=c.text,
                    duration_sec=c.duration_sec,
                )
                for c in job.chunks
            ],
            audio_ready=bool(job.audio_path and job.audio_path.exists()),
            error=job.error,
            speaking_rate=job.speaking_rate,
        )


job_queue = JobQueue()
