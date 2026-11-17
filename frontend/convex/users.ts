import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { currentUser, isAdminUser } from "./access";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const avatar = user.avatarId ? await ctx.storage.getUrl(user.avatarId) : null;
    return {
      name: user.displayName ?? user.name ?? null,
      /** The name from Google, shown as a hint when you have set your own */
      googleName: user.name ?? null,
      email: user.email ?? null,
      image: avatar ?? user.image ?? null,
      hasOwnImage: !!avatar,
      isAdmin: isAdminUser(user),
    };
  },
});

async function signedIn(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Du må være logget inn");
  return userId;
}

/** Your own display name; an empty name goes back to the one from Google */
export const setName = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const userId = await signedIn(ctx);
    const trimmed = name.trim();
    if (trimmed.length > 60) throw new Error("Navnet kan være på opptil 60 tegn");
    await ctx.db.patch(userId, { displayName: trimmed || undefined });
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await signedIn(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Uses an uploaded image as your picture, or goes back to the one from Google with null */
export const setAvatar = mutation({
  args: { storageId: v.union(v.id("_storage"), v.null()) },
  handler: async (ctx, { storageId }) => {
    const userId = await signedIn(ctx);
    if (storageId) {
      const file = await ctx.db.system.get("_storage", storageId);
      if (!file) throw new Error("Fant ikke bildet");
      if (!file.contentType?.startsWith("image/") || file.size > 2 * 1024 * 1024) {
        await ctx.storage.delete(storageId);
        throw new Error("Bildet må være en bildefil på under 2 MB");
      }
    }
    const user = await ctx.db.get(userId);
    if (user?.avatarId && user.avatarId !== storageId) await ctx.storage.delete(user.avatarId);
    await ctx.db.patch(userId, { avatarId: storageId ?? undefined });
  },
});

/**
 * Deletes your account and everything saved on it: progress, answers, ratings,
 * votes and your ideas, your picture, and your sign-in. Ideas others voted on
 * go too, since they carry your name.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await signedIn(ctx);
    for await (const row of ctx.db.query("progress").withIndex("by_user_key", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db.query("practiceEvents").withIndex("by_user_at", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }
    for await (const row of ctx.db
      .query("topicConfidence")
      .withIndex("by_user_topic", (q) => q.eq("userId", userId))) {
      await ctx.db.delete(row._id);
    }

    // Your votes come off the score of the ideas you voted on
    for await (const vote of ctx.db.query("ideaVotes").withIndex("by_user", (q) => q.eq("userId", userId))) {
      const idea = await ctx.db.get(vote.ideaId);
      if (idea) await ctx.db.patch(idea._id, { score: idea.score - vote.value });
      await ctx.db.delete(vote._id);
    }
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_author", (q) => q.eq("authorId", userId))
      .collect();
    for (const idea of ideas) {
      for await (const vote of ctx.db.query("ideaVotes").withIndex("by_idea_user", (q) => q.eq("ideaId", idea._id))) {
        await ctx.db.delete(vote._id);
      }
      await ctx.db.delete(idea._id);
    }

    for await (const account of ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))) {
      for await (const code of ctx.db
        .query("authVerificationCodes")
        .withIndex("accountId", (q) => q.eq("accountId", account._id))) {
        await ctx.db.delete(code._id);
      }
      await ctx.db.delete(account._id);
    }
    for await (const session of ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", userId))) {
      for await (const token of ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    const user = await ctx.db.get(userId);
    if (user?.avatarId) await ctx.storage.delete(user.avatarId);
    await ctx.db.delete(userId);
  },
});
