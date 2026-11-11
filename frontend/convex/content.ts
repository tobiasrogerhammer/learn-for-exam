import { v, type ObjectType } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./access";

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

/** Everything anyone can read: subjects, documents with audiobook links, and study sets */
export const load = query({
  args: {},
  handler: async (ctx) => {
    const subjects = await ctx.db.query("subjects").collect();
    const documents = await ctx.db.query("documents").collect();
    const studySets = await ctx.db.query("studySets").collect();

    return {
      subjects: subjects.map((s) => ({
        id: s.key,
        name: s.name,
        createdAt: s.createdAt,
        tools: s.tools,
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
          document: d.document,
          script: d.script,
          reading: d.reading,
          audiobook: d.audio
            ? {
                url: await ctx.storage.getUrl(d.audio.storageId),
                format: d.audio.format,
                durationSec: d.audio.durationSec,
                speakingRate: d.audio.speakingRate,
                chunks: d.audio.chunks,
                publishedAt: d.audio.publishedAt,
              }
            : undefined,
        })),
      ),
      studySets: studySets.map((s) => s.data),
    };
  },
});

async function documentByKey(ctx: MutationCtx, key: string) {
  return await ctx.db
    .query("documents")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function removeDocument(ctx: MutationCtx, doc: Doc<"documents">) {
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
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await documentByKey(ctx, args.key);
    if (existing) await ctx.db.patch(existing._id, args);
    else await ctx.db.insert("documents", args);
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
    await ctx.db.patch(doc._id, {
      title,
      document: { ...doc.document, title },
      ...(category ? { category } : {}),
    });
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
    await ctx.db.patch(doc._id, { reading: reading ?? undefined });
  },
});

/** Attaches the audiobook script (or removes it with null). The audio is kept. */
export const setScript = mutation({
  args: { key: v.string(), script: v.union(scriptValidator, v.null()) },
  handler: async (ctx, { key, script }) => {
    await requireAdmin(ctx);
    const doc = await documentByKey(ctx, key);
    if (!doc) throw new Error("Fant ikke dokumentet");
    await ctx.db.patch(doc._id, { script: script ?? undefined });
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
    await ctx.db.patch(to._id, {
      audio: from.audio,
      script: {
        sections: from.document.sections.map(
          (s: { id: string; title: string; level: number; text: string }) => ({
            id: s.id,
            title: s.title,
            level: s.level,
            text: s.text,
          }),
        ),
        rawText: from.document.rawText,
        files: [fileName],
        updatedAt: from.audio.publishedAt,
      },
    });
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
  await ctx.db.patch(doc._id, {
    audio: { ...audio, publishedAt: new Date().toISOString() },
  });
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
  },
});
