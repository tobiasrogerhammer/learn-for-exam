import { ConvexReactClient } from "convex/react";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;

/** Shared client, used by the React provider and by the storage layer outside React */
export const convex = url ? new ConvexReactClient(url) : null;
