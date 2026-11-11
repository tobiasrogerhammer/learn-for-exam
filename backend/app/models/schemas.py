from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ChunkStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class JobStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    partial = "partial"


class TextChunkIn(BaseModel):
    id: str
    text: str = Field(..., min_length=1, max_length=2000)
    title: Optional[str] = None


class CreateJobRequest(BaseModel):
    title: str = Field(default="Dokument", max_length=200)
    chunks: list[TextChunkIn] = Field(..., min_length=1, max_length=2000)
    # Player convention: 0.75 = slower speech, 2.0 = faster (Piper length_scale = 1/rate)
    speaking_rate: float = Field(default=1.0, ge=0.5, le=2.0)


class ChunkState(BaseModel):
    id: str
    index: int
    title: Optional[str] = None
    status: ChunkStatus
    error: Optional[str] = None
    char_count: int = 0
    text: str = ""
    duration_sec: Optional[float] = None


class JobProgress(BaseModel):
    job_id: str
    title: str
    status: JobStatus
    total_chunks: int
    completed_chunks: int
    failed_chunks: int
    progress: float
    chunks: list[ChunkState]
    audio_ready: bool = False
    error: Optional[str] = None
    speaking_rate: float = 1.0


class CreateJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    total_chunks: int


class HealthResponse(BaseModel):
    status: str
    voice: str
    sample_rate: int
    ready: bool


class StudySectionIn(BaseModel):
    title: str = Field(default="", max_length=500)
    text: str = Field(..., min_length=1, max_length=400_000)


class StudyGenerateRequest(BaseModel):
    title: str = Field(default="Dokument", max_length=200)
    subject: Optional[str] = Field(default=None, max_length=200)
    sections: list[StudySectionIn] = Field(..., min_length=1, max_length=500)
    focus: Optional[str] = Field(default=None, max_length=1000)
    flashcards: int = Field(default=25, ge=0, le=120)
    quiz: int = Field(default=15, ge=0, le=80)
    recall: int = Field(default=6, ge=0, le=40)


class FlashcardOut(BaseModel):
    front: str
    back: str
    section: str = ""


class QuizQuestionOut(BaseModel):
    question: str
    options: list[str]
    answer_index: int
    explanation: str = ""
    section: str = ""


class RecallPromptOut(BaseModel):
    prompt: str
    key_points: list[str]
    section: str = ""


class StudySetOut(BaseModel):
    summary: str = ""
    flashcards: list[FlashcardOut] = []
    quiz: list[QuizQuestionOut] = []
    recall: list[RecallPromptOut] = []
    model: Optional[str] = None


class StudyHealthResponse(BaseModel):
    ready: bool
    model: str
