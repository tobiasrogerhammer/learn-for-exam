import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/** Comma-separated Google addresses allowed to change content (Convex env var ADMIN_EMAILS) */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: Doc<"users"> | null): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && adminEmails().includes(email);
}

export async function currentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get(userId) : null;
}

/** Throws unless the signed-in user is the admin */
export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUser(ctx);
  if (!user || !isAdminUser(user)) {
    throw new Error("Bare administrator kan endre innholdet");
  }
  return user;
}
