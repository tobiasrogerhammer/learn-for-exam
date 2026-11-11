import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_EVENTS = 5000;

/** Your answers, newest first (the last 5000) */
export const myEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("practiceEvents")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_EVENTS);
    return rows.map(({ subjectKey, documentKey, topic, mode, score, at }) => ({
      subjectKey,
      documentKey,
      topic,
      mode,
      score,
      at,
    }));
  },
});

export const record = mutation({
  args: {
    events: v.array(
      v.object({
        subjectKey: v.string(),
        documentKey: v.string(),
        topic: v.string(),
        mode: v.string(),
        score: v.number(),
        at: v.number(),
      }),
    ),
  },
  handler: async (ctx, { events }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Logg inn for å lagre fremgang");
    if (events.length > 200) throw new Error("For mange svar på én gang");
    for (const e of events) {
      await ctx.db.insert("practiceEvents", {
        ...e,
        userId,
        score: Math.min(1, Math.max(0, e.score)),
      });
    }
  },
});

/** Your own rating of each topic: 1 usikker, 2 litt trygg, 3 trygg */
export const myConfidence = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("topicConfidence")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId))
      .collect();
    return rows.map(({ documentKey, topic, level, updatedAt }) => ({
      documentKey,
      topic,
      level,
      updatedAt,
    }));
  },
});

export const setConfidence = mutation({
  args: { documentKey: v.string(), topic: v.string(), level: v.union(v.number(), v.null()) },
  handler: async (ctx, { documentKey, topic, level }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Logg inn for å lagre hvor trygg du er");
    const existing = await ctx.db
      .query("topicConfidence")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", userId).eq("documentKey", documentKey).eq("topic", topic),
      )
      .unique();
    if (level === null) {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }
    const row = { userId, documentKey, topic, level: Math.round(Math.min(3, Math.max(1, level))), updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("topicConfidence", row);
  },
});
