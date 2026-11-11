import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { currentUser, isAdminUser } from "./access";

const STATUSES = ["ny", "planlagt", "laget"];

/** All ideas, most liked first, with your own vote when you are signed in */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const ideas = await ctx.db.query("ideas").withIndex("by_score").order("desc").take(500);
    const myVotes = userId
      ? await ctx.db
          .query("ideaVotes")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect()
      : [];
    const voteOf = new Map(myVotes.map((v) => [v.ideaId, v.value]));
    return ideas.map((i) => ({
      id: i._id,
      title: i.title,
      description: i.description,
      authorName: i.authorName,
      createdAt: i.createdAt,
      score: i.score,
      status: i.status,
      mine: i.authorId === userId,
      myVote: voteOf.get(i._id) ?? 0,
    }));
  },
});

async function signedInUser(ctx: MutationCtx) {
  const user = await currentUser(ctx);
  if (!user) throw new Error("Logg inn for å foreslå og stemme på ideer");
  return user;
}

export const create = mutation({
  args: { title: v.string(), description: v.string() },
  handler: async (ctx, args) => {
    const user = await signedInUser(ctx);
    const title = args.title.trim();
    const description = args.description.trim();
    if (title.length < 3 || title.length > 120) throw new Error("Tittelen må være mellom 3 og 120 tegn");
    if (description.length > 2000) throw new Error("Beskrivelsen kan være på opptil 2000 tegn");
    const id = await ctx.db.insert("ideas", {
      title,
      description,
      authorId: user._id,
      authorName: user.name?.split(" ")[0] ?? "Anonym",
      createdAt: Date.now(),
      score: 1,
      status: "ny",
    });
    // Your own idea starts with your upvote
    await ctx.db.insert("ideaVotes", { ideaId: id, userId: user._id, value: 1 });
  },
});

/** Up (1), down (-1) or take back your vote (0) */
export const vote = mutation({
  args: { ideaId: v.id("ideas"), value: v.union(v.literal(1), v.literal(-1), v.literal(0)) },
  handler: async (ctx, { ideaId, value }) => {
    const user = await signedInUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) throw new Error("Fant ikke ideen");
    const existing = await ctx.db
      .query("ideaVotes")
      .withIndex("by_idea_user", (q) => q.eq("ideaId", ideaId).eq("userId", user._id))
      .unique();
    const before = existing?.value ?? 0;
    if (existing && value === 0) await ctx.db.delete(existing._id);
    else if (existing) await ctx.db.patch(existing._id, { value });
    else if (value !== 0) await ctx.db.insert("ideaVotes", { ideaId, userId: user._id, value });
    await ctx.db.patch(ideaId, { score: idea.score - before + value });
  },
});

async function deleteIdea(ctx: MutationCtx, ideaId: Id<"ideas">) {
  const votes = await ctx.db
    .query("ideaVotes")
    .withIndex("by_idea_user", (q) => q.eq("ideaId", ideaId))
    .collect();
  for (const vote of votes) await ctx.db.delete(vote._id);
  await ctx.db.delete(ideaId);
}

/** The author or the admin can remove an idea */
export const remove = mutation({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, { ideaId }) => {
    const user = await signedInUser(ctx);
    const idea = await ctx.db.get(ideaId);
    if (!idea) return;
    if (idea.authorId !== user._id && !isAdminUser(user)) {
      throw new Error("Du kan bare slette dine egne ideer");
    }
    await deleteIdea(ctx, ideaId);
  },
});

export const setStatus = mutation({
  args: { ideaId: v.id("ideas"), status: v.string() },
  handler: async (ctx, { ideaId, status }) => {
    const user = await signedInUser(ctx);
    if (!isAdminUser(user)) throw new Error("Bare administrator kan endre status");
    if (!STATUSES.includes(status)) throw new Error("Ukjent status");
    await ctx.db.patch(ideaId, { status });
  },
});
