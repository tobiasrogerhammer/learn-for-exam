import { v, type ObjectType } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./access";
import { frontMatterCount } from "./lib/frontMatter";

const toolValidator = v.object({ id: v.string(), title: v.string(), src: v.string() });

const scriptValidator = v.object({
  sections: v.array(
    v.object({ id: v.string(), title: v.string(), level: v.number(), text: v.string() }),
  ),
  rawText: v.string(),
  files: v.array(v.string()),
  updatedAt: v.string(),
});

const chunkValidator = v.object({
  id: v.string(),
  durationSec: v.union(v.number(), v.null()),
});

/**
 * What everyone loads up front: subjects, and a short summary of each document
 * with its audiobook link. The text and practice material come with
 * documentDetail when a document is opened, so this stays small.
 */
export const load = query({
  args: {},
  handler: async (ctx) => {
    const subjects = await ctx.db.query("subjects").collect();
    const documents = await ctx.db.query("documents").collect();

    return {
      subjects: subjects.map((s) => ({
        id: s.key,
        name: s.name,
        createdAt: s.createdAt,
        tools: s.tools,
        examDate: s.examDate,
      })),
      documents: await Promise.all(
        documents.map(async (d) => ({
          id: d.key,
          subjectId: d.subjectKey,
          category: d.category,
          title: d.title,
          sourceType: d.sourceType,
          createdAt: d.createdAt,
          sectionCount: d.sectionCount,
          charCount: d.charCount,
          speakingRate: d.speakingRate,
          chapterCount: d.chapterCount ?? d.sectionCount,
          wordCount: d.wordCount ?? 0,
          hasReading: d.hasReading ?? false,
          hasScript: d.hasScript ?? false,
          topics: d.topics ?? null,
          audiobook: d.audio
            ? {
                url: await ctx.storage.getUrl(d.audio.storageId),
                format: d.audio.format,
                durationSec: d.audio.durationSec,
                speakingRate: d.audio.speakingRate,
                publishedAt: d.audio.publishedAt,
              }
            : undefined,
        })),
      ),
    };
  },
});

/** The text, audiobook script and practice material of one document */
export const documentDetail = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const stored = await ctx.db
      .query("documentContent")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    // Until migrateContent has run, the text is still on the document itself
    const legacy = stored
      ? null
      : await ctx.db
          .query("documents")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique();
    const content = stored ?? (legacy?.document ? legacy : null);
    if (!content) return null;
    const studySet = await ctx.db
      .query("studySets")
      .withIndex("by_document", (q) => q.eq("documentKey", key))
      .unique();
    const audioChunks =
      stored?.audioChunks ??
      (legacy ?? (await ctx.db.query("documents").withIndex("by_key", (q) => q.eq("key", key)).unique()))
        ?.audio?.chunks ??
      null;
    return {
      document: content.document,
      reading: content.reading,
      script: content.script,
      audioChunks,
      studySet: studySet?.data ?? null,
    };
  },
});

async function documentByKey(ctx: MutationCtx, key: string) {
  return await ctx.db
    .query("documents")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function contentByKey(ctx: MutationCtx, key: string) {
  return await ctx.db
    .query("documentContent")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

type ContentFields = Partial<
  Pick<Doc<"documentContent">, "document" | "reading" | "script" | "audioChunks">
>;

/** Writes the text of a document, keeping the parts that are not given */
async function writeContent(ctx: MutationCtx, key: string, fields: ContentFields) {
  const existing = await contentByKey(ctx, key);
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("documentContent", { key, document: fields.document ?? null, ...fields });
}

/** The chapter and word counts and practice topics the light list shows */
async function refreshSummary(ctx: MutationCtx, key: string) {
  const doc = await documentByKey(ctx, key);
  const content = await contentByKey(ctx, key);
  if (!doc) return;
  const markdown: string | undefined = content?.reading?.markdown;
  const sections: { title: string; text: string }[] = content?.document?.sections ?? [];
  const text: string = markdown ?? content?.document?.rawText ?? "";
  const set = await ctx.db
    .query("studySets")
    .withIndex("by_document", (q) => q.eq("documentKey", key))
    .unique();
  let topics: { topic: string; items: number }[] | undefined;
  if (set) {
    const counts = new Map<string, number>();
    const data = set.data as Record<string, { section?: string }[] | undefined>;
    for (const item of [...(data.flashcards ?? []), ...(data.quiz ?? []), ...(data.recall ?? [])]) {
      const topic = item.section?.trim() || "Uten tema";
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    topics = [...counts].map(([topic, items]) => ({ topic, items }));
  }
  await ctx.db.patch(doc._id, {
    chapterCount: markdown
      ? (markdown.match(/^## +/gm) ?? []).length
      : sections.length - frontMatterCount(sections),
    wordCount: text.split(/\s+/).filter(Boolean).length,
    hasReading: !!content?.reading,
    hasScript: !!content?.script,
    topics,
  });
}

async function removeDocument(ctx: MutationCtx, doc: Doc<"documents">) {
  const content = await contentByKey(ctx, doc.key);
  if (content) await ctx.db.delete(content._id);
  if (doc.audio) await ctx.storage.delete(doc.audio.storageId);
  const sets = await ctx.db
    .query("studySets")
    .withIndex("by_document", (q) => q.eq("documentKey", doc.key))
    .collect();
  for (const set of sets) await ctx.db.delete(set._id);
  await ctx.db.delete(doc._id);
}

export const saveSubject = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    createdAt: v.string(),
    tools: v.optional(v.array(toolValidator)),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("subjects")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("subjects", args);
  },
});

/** Sets the exam day for a subject (YYYY-MM-DD), or removes it with null */
export const setExamDate = mutation({
  args: { key: v.string(), examDate: v.union(v.string(), v.null()) },
  handler: async (ctx, { key, examDate }) => {
    await requireAdmin(ctx);
    if (examDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) throw new Error("Ugyldig dato");
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!subject) throw new Error("Fant ikke emnet");
    await ctx.db.patch(subject._id, { examDate: examDate ?? undefined });
  },
});

/** Deletes the subject with all its documents, audiobooks and study sets */
export const deleteSubject = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_subject", (q) => q.eq("subjectKey", key))
      .collect();
    for (const doc of docs) await removeDocument(ctx, doc);
    const subject = await ctx.db
      .query("subjects")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (subject) await ctx.db.delete(subject._id);
  },
});

/** Creates or replaces a document. A published audiobook is kept. */
export const saveDocument = mutation({
  args: {
    key: v.string(),
    subjectKey: v.string(),
    category: v.optional(v.string()),
    title: v.string(),
    sourceType: v.string(),
    createdAt: v.string(),
    sectionCount: v.number(),
    charCount: v.number(),
    speakingRate: v.optional(v.number()),
    document: v.any(),
  },
  handler: async (ctx, { document, ...meta }) => {
    await requireAdmin(ctx);
    const existing = await documentByKey(ctx, meta.key);
    if (existing) await ctx.db.patch(existing._id, meta);
    else await ctx.db.insert("documents", meta);
    await writeContent(ctx, meta.key, { document });
    await refreshSummary(ctx, meta.key);
  },
});

export const setCategory = mutation({
  args: { key: v.string(), category: v.string() },
  handler: async (ctx, { key, category }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, key);
    if (doc) await ctx.db.patch(doc._id, { category });
  },
});

/** Renames a document, and its study set so practice lists show the new name */
export const renameDocument = mutation({
  args: { key: v.string(), title: v.string(), category: v.optional(v.string()) },
  handler: async (ctx, { key, title, category }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, key);
    if (!doc) throw new Error("Fant ikke dokumentet");
    await ctx.db.patch(doc._id, { title, ...(category ? { category } : {}) });
    const content = await contentByKey(ctx, key);
    if (content) await ctx.db.patch(content._id, { document: { ...content.document, title } });
    const sets = await ctx.db
      .query("studySets")
      .withIndex("by_document", (q) => q.eq("documentKey", key))
      .collect();
    for (const set of sets) {
      await ctx.db.patch(set._id, { data: { ...set.data, documentTitle: title } });
    }
  },
});

/** Attaches the cleaned-up reading text (or removes it with null) */
export const setReading = mutation({
  args: {
    key: v.string(),
    reading: v.union(
      v.object({ markdown: v.string(), files: v.array(v.string()), updatedAt: v.string() }),
      v.null(),
    ),
  },
  handler: async (ctx, { key, reading }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, key);
    if (!doc) throw new Error("Fant ikke dokumentet");
    await writeContent(ctx, key, { reading: reading ?? undefined });
    await refreshSummary(ctx, key);
  },
});

/** Attaches the audiobook script (or removes it with null). The audio is kept. */
export const setScript = mutation({
  args: { key: v.string(), script: v.union(scriptValidator, v.null()) },
  handler: async (ctx, { key, script }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, key);
    if (!doc) throw new Error("Fant ikke dokumentet");
    await writeContent(ctx, key, { script: script ?? undefined });
    await refreshSummary(ctx, key);
  },
});

/**
 * Moves an audiobook made on a separate document (an uploaded script) to the
 * document it belongs to. The source text becomes the target's script so the
 * text still lines up with the audio, and the source document is deleted.
 */
export const moveAudiobook = mutation({
  args: { fromKey: v.string(), toKey: v.string(), fileName: v.string() },
  handler: async (ctx, { fromKey, toKey, fileName }) => {
    await requireAdmin(ctx);
    const from = await documentByKey(ctx, fromKey);
    const to = await documentByKey(ctx, toKey);
    if (!from?.audio || !to) throw new Error("Fant ikke lydboken eller dokumentet");
    if (to.audio) await ctx.storage.delete(to.audio.storageId);
    const source = (await contentByKey(ctx, fromKey))?.document;
    if (!source) throw new Error("Fant ikke teksten til lydboken");
    const fromChunks = (await contentByKey(ctx, fromKey))?.audioChunks ?? from.audio.chunks;
    await ctx.db.patch(to._id, { audio: { ...from.audio, chunks: undefined } });
    await writeContent(ctx, toKey, {
      audioChunks: fromChunks,
      script: {
        sections: source.sections.map(
          (s: { id: string; title: string; level: number; text: string }) => ({
            id: s.id,
            title: s.title,
            level: s.level,
            text: s.text,
          }),
        ),
        rawText: source.rawText,
        files: [fileName],
        updatedAt: from.audio.publishedAt,
      },
    });
    await refreshSummary(ctx, toKey);
    // Detach the audio first so deleting the source keeps the file
    await ctx.db.patch(from._id, { audio: undefined });
    await removeDocument(ctx, { ...from, audio: undefined });
  },
});

export const deleteDocument = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, key);
    if (doc) await removeDocument(ctx, doc);
  },
});

export const saveStudySet = mutation({
  args: { documentKey: v.string(), subjectKey: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("studySets")
      .withIndex("by_document", (q) => q.eq("documentKey", args.documentKey))
      .unique();
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("studySets", args);
    await refreshSummary(ctx, args.documentKey);
  },
});

/**
 * Works out the counts and topics again for every document, a few per run,
 * e.g. after the way chapters are counted has changed:
 *   npx convex run content:refreshSummaries '{"cursor": null}'
 * and again with the cursor it returns until it says done.
 */
export const refreshSummaries = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("documents").paginate({ cursor, numItems: 5 });
    for (const doc of page.page) await refreshSummary(ctx, doc.key);
    return { done: page.isDone, cursor: page.continueCursor };
  },
});

/**
 * One-off move of document text from the documents table to documentContent,
 * a few documents per run so each run stays small. Run it until it says done:
 *   npx convex run content:migrateContent
 */
export const migrateContent = internalMutation({
  args: {},
  handler: async (ctx) => {
    let moved = 0;
    for await (const doc of ctx.db.query("documents")) {
      const legacyChunks = doc.audio?.chunks;
      if (doc.chapterCount !== undefined && doc.document === undefined && !legacyChunks) continue;
      if (doc.document !== undefined || legacyChunks) {
        await writeContent(ctx, doc.key, {
          ...(doc.document !== undefined ? { document: doc.document } : {}),
          ...(doc.reading ? { reading: doc.reading } : {}),
          ...(doc.script ? { script: doc.script } : {}),
          ...(legacyChunks ? { audioChunks: legacyChunks } : {}),
        });
        await ctx.db.patch(doc._id, {
          document: undefined,
          reading: undefined,
          script: undefined,
          ...(doc.audio ? { audio: { ...doc.audio, chunks: undefined } } : {}),
        });
      }
      await refreshSummary(ctx, doc.key);
      if (++moved >= 5) return { done: false, moved };
    }
    return { done: true, moved };
  },
});

const audioArgs = {
  documentKey: v.string(),
  storageId: v.id("_storage"),
  format: v.string(),
  durationSec: v.number(),
  speakingRate: v.optional(v.number()),
  chunks: v.array(chunkValidator),
};

async function attachAudio(
  ctx: MutationCtx,
  { documentKey, ...audio }: ObjectType<typeof audioArgs>,
) {
  const doc = await documentByKey(ctx, documentKey);
  if (!doc) {
    await ctx.storage.delete(audio.storageId);
    throw new Error("Fant ikke dokumentet");
  }
  if (doc.audio) await ctx.storage.delete(doc.audio.storageId);
  const { chunks, ...rest } = audio;
  await ctx.db.patch(doc._id, {
    audio: { ...rest, publishedAt: new Date().toISOString() },
  });
  await writeContent(ctx, documentKey, { audioChunks: chunks });
}

/** Step 1 of publishing an audiobook: where to upload the MP3 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Step 2: attach the uploaded file to the document, replacing any earlier version */
export const publishAudio = mutation({
  args: audioArgs,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await attachAudio(ctx, args);
  },
});

export const removeAudio = mutation({
  args: { documentKey: v.string() },
  handler: async (ctx, { documentKey }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, documentKey);
    if (!doc?.audio) return;
    await ctx.storage.delete(doc.audio.storageId);
    await ctx.db.patch(doc._id, { audio: undefined });
    await writeContent(ctx, documentKey, { audioChunks: undefined });
  },
});
