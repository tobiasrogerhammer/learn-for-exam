import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** The signed-in user's progress as { key: value }, or null when signed out */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_user_key", (q) => q.eq("userId", userId))
      .collect();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, { key, value }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Logg inn for å lagre fremgang");
    if (!/^learn-for-exam:[a-z0-9:-]{1,80}$/.test(key)) {
      throw new Error("Ugyldig nøkkel");
    }
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user_key", (q) => q.eq("userId", userId).eq("key", key))
      .unique();
    const row = { userId, key, value, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("progress", row);
  },
});
