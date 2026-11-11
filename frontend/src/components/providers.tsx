"use client";

import type { ReactNode } from "react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { convex } from "@/lib/convex";

export function Providers({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <p className="m-8 text-sm text-destructive">
        NEXT_PUBLIC_CONVEX_URL mangler. Kjør npx convex dev i frontend-mappen.
      </p>
    );
  }
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
