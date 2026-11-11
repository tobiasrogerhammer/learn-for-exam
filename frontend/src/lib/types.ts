export type Section = {
  id: string;
  title: string;
  level: number;
  text: string;
};

export type ExtractedDocument = {
  id: string;
  title: string;
  sourceType: "pdf" | "docx" | "txt" | "paste";
  createdAt: string;
  sections: Section[];
  rawText: string;
};

/** An interactive practice page served from public/ovinger */
export type SubjectTool = {
  id: string;
  title: string;
  src: string;
};

export type Subject = {
  id: string;
  name: string;
  createdAt: string;
  tools?: SubjectTool[];
};

/** How documents are grouped in the library */
export type DocCategory = "leksjon" | "forelesning" | "oppgave" | "annet";

export type LibraryItem = {
  id: string;
  /** Emne dokumentet hører til */
  subjectId?: string;
  /** Set when saved or moved by hand; older items fall back to a guess from the title */
  category?: DocCategory;
  title: string;
  sourceType: ExtractedDocument["sourceType"];
  createdAt: string;
  sectionCount: number;
  charCount: number;
  document: ExtractedDocument;
  /** Chosen at upload; baked into Piper synthesis */
  speakingRate?: number;
  /** Cleaned-up text for Les, in Markdown with headings and tables */
  reading?: { markdown: string; files: string[]; updatedAt: string };
  /** Text written for listening; Lytt reads and shows it instead of the document */
  script?: AudiobookScript;
  /** Published audiobook anyone can play, made locally with Piper */
  audiobook?: Audiobook;
};

export type AudiobookScript = {
  sections: Section[];
  rawText: string;
  /** Uploaded file names, in the order they were joined */
  files: string[];
  updatedAt: string;
};

export type Audiobook = {
  url: string | null;
  format: string;
  durationSec: number;
  speakingRate?: number;
  /** Spoken length of each TTS chunk, in the order chunkSections makes them */
  chunks: { id: string; durationSec: number | null }[];
  publishedAt: string;
};

/** Where you stopped listening, per document */
export type ListenPosition = {
  time: number;
  duration: number;
  updatedAt: string;
};

export type TextChunk = {
  id: string;
  text: string;
  title?: string;
  sectionId: string;
};

export type ChunkStatus = "pending" | "processing" | "done" | "failed";
export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "partial";

export type JobProgress = {
  job_id: string;
  title: string;
  status: JobStatus;
  total_chunks: number;
  completed_chunks: number;
  failed_chunks: number;
  progress: number;
  chunks: {
    id: string;
    index: number;
    title?: string | null;
    status: ChunkStatus;
    error?: string | null;
    char_count: number;
    text?: string;
    duration_sec?: number | null;
  }[];
  audio_ready: boolean;
  error?: string | null;
  speaking_rate?: number;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  section: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  section: string;
};

export type RecallPrompt = {
  id: string;
  prompt: string;
  keyPoints: string[];
  section: string;
};

/** Øvingsmateriale for ett dokument, laget av Claude eller importert som JSON */
export type StudySet = {
  documentId: string;
  subjectId: string;
  documentTitle: string;
  generatedAt: string;
  source: "claude" | "import";
  model?: string | null;
  summary: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  recall: RecallPrompt[];
};

/** Spaced repetition-tilstand per flashcard (SM-2-variant) */
export type CardReview = {
  cardId: string;
  due: string;
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
};

export type ReviewGrade = "again" | "hard" | "good" | "easy";

export type PracticeMode =
  | "pensum"
  | "read"
  | "listen"
  | "tools"
  | "flashcards"
  | "quiz"
  | "recall"
  | "typing"
  | "match"
  | "kahoot";
