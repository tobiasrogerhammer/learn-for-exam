import { query } from "./_generated/server";
import { currentUser, isAdminUser } from "./access";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return {
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      isAdmin: isAdminUser(user),
    };
  },
});
