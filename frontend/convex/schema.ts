import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Content (subjects, documents, study sets, audiobooks) is public to read and
 * only the admin can change it. Progress belongs to each signed-in user.
 * `key` keeps the ids the frontend already uses, so links between rows are by key.
 */
export default defineSchema({
  ...authTables,

  /**
   * Convex Auth's users table, plus the name and picture you set yourself.
   * Google fills in name and image on every sign-in, so your own choices are
   * kept in separate fields that sign-in leaves alone.
   */
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    displayName: v.optional(v.string()),
    avatarId: v.optional(v.id("_storage")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  subjects: defineTable({
    key: v.string(),
    name: v.string(),
    createdAt: v.string(),
    tools: v.optional(
      v.array(v.object({ id: v.string(), title: v.string(), src: v.string() })),
    ),
    /** The exam day, as YYYY-MM-DD, set by the admin */
    examDate: v.optional(v.string()),
  }).index("by_key", ["key"]),

  documents: defineTable({
    key: v.string(),
    subjectKey: v.string(),
    category: v.optional(v.string()),
    title: v.string(),
    sourceType: v.string(),
    createdAt: v.string(),
    sectionCount: v.number(),
    charCount: v.number(),
    speakingRate: v.optional(v.number()),
    /**
     * Older rows kept the text here. It now lives in documentContent, so the
     * list everyone loads stays small; these are emptied by the migration.
     */
    document: v.optional(v.any()),
    script: v.optional(v.any()),
    reading: v.optional(v.any()),
    /** Worked out from the content whenever it changes, for lists and progress */
    chapterCount: v.optional(v.number()),
    wordCount: v.optional(v.number()),
    hasReading: v.optional(v.boolean()),
    hasScript: v.optional(v.boolean()),
    /** Topics in the study set and how many questions each has, when there is one */
    topics: v.optional(v.array(v.object({ topic: v.string(), items: v.number() }))),
    /** Published audiobook, made locally with Piper */
    audio: v.optional(
      v.object({
        storageId: v.id("_storage"),
        format: v.string(),
        durationSec: v.number(),
        speakingRate: v.optional(v.number()),
        /** Older rows only; the timings now live in documentContent.audioChunks */
        chunks: v.optional(
          v.array(v.object({ id: v.string(), durationSec: v.union(v.number(), v.null()) })),
        ),
        publishedAt: v.string(),
      }),
    ),
  })
    .index("by_key", ["key"])
    .index("by_subject", ["subjectKey"]),

  /** The text of a document, loaded only when someone opens it */
  documentContent: defineTable({
    key: v.string(),
    /** ExtractedDocument with sections and raw text */
    document: v.any(),
    /** Text written for listening; Lytt reads and shows this instead of the document when set */
    script: v.optional(
      v.object({
        sections: v.array(
          v.object({ id: v.string(), title: v.string(), level: v.number(), text: v.string() }),
        ),
        rawText: v.string(),
        files: v.array(v.string()),
        updatedAt: v.string(),
      }),
    ),
    /** Cleaned-up text for Les, in Markdown with headings and tables */
    reading: v.optional(
      v.object({ markdown: v.string(), files: v.array(v.string()), updatedAt: v.string() }),
    ),
    /** Spoken length of each TTS chunk of the audiobook, used to follow along sentence by sentence */
    audioChunks: v.optional(
      v.array(v.object({ id: v.string(), durationSec: v.union(v.number(), v.null()) })),
    ),
  }).index("by_key", ["key"]),

  studySets: defineTable({
    documentKey: v.string(),
    subjectKey: v.string(),
    /** StudySet as the frontend uses it */
    data: v.any(),
  }).index("by_document", ["documentKey"]),

  /** Every answer in practice, so progress can be followed per subject and topic */
  practiceEvents: defineTable({
    userId: v.id("users"),
    subjectKey: v.string(),
    documentKey: v.string(),
    /** Topic as named in the study set, usually a chapter of the lesson */
    topic: v.string(),
    mode: v.string(),
    /** 0 is wrong, 1 is right; self-graded modes use values in between */
    score: v.number(),
    at: v.number(),
  }).index("by_user_at", ["userId", "at"]),

  /** Feature ideas from signed-in users */
  ideas: defineTable({
    title: v.string(),
    description: v.string(),
    authorId: v.id("users"),
    authorName: v.string(),
    createdAt: v.number(),
    /** Upvotes minus downvotes, kept up to date on every vote */
    score: v.number(),
    /** Set by the admin: "ny", "planlagt" or "laget" */
    status: v.string(),
  })
    .index("by_score", ["score"])
    .index("by_author", ["authorId"]),

  ideaVotes: defineTable({
    ideaId: v.id("ideas"),
    userId: v.id("users"),
    value: v.number(),
  })
    .index("by_idea_user", ["ideaId", "userId"])
    .index("by_user", ["userId"]),

  /** How sure you feel about a topic, rated by yourself */
  topicConfidence: defineTable({
    userId: v.id("users"),
    documentKey: v.string(),
    topic: v.string(),
    level: v.number(),
    updatedAt: v.number(),
  }).index("by_user_topic", ["userId", "documentKey", "topic"]),

  /** One row per user and progress key, e.g. card reviews or listening positions */
  progress: defineTable({
    userId: v.id("users"),
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_user_key", ["userId", "key"]),
});
