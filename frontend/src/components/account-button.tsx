"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { Lightbulb, LogIn, UserRound } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Links to the idea board and your profile, and Google sign-in, for the top bar */
export function AccountButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);
  const { signIn } = useAuthActions();
  const name = me?.name ?? me?.email ?? null;

  const links = (
    <>
      <Link
        href="/ideer"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      >
        <Lightbulb className="size-3.5" />
        Ideer
      </Link>
    </>
  );

  if (isLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex items-center gap-1">
        {links}
        <Badge variant="outline">Laster…</Badge>
      </div>
    );
  }
  if (!name) {
    return (
      <div className="flex items-center gap-1">
        {links}
        <Button type="button" size="sm" onClick={() => void signIn("google")}>
          <LogIn className="size-3.5" />
          Logg inn med Google
        </Button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {links}
      <Link
        href="/profil"
        title="Profil"
        className="ml-1 flex items-center gap-2 rounded-full py-0.5 pr-2.5 pl-0.5 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      >
        {me?.image ? (
          // Pictures come from Google or Convex storage, so a plain img is simplest
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.image} alt="" className="size-7 rounded-full border border-border/70 object-cover" />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-muted">
            <UserRound className="size-3.5" />
          </span>
        )}
        <span className="max-w-32 truncate">
          {name}
          {me?.isAdmin ? " · admin" : ""}
        </span>
      </Link>
    </div>
  );
}
