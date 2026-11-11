"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { Lightbulb, LogIn, LogOut, TrendingUp } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Links to the idea board and your profile, and Google sign-in, for the top bar */
export function AccountButton() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.me);
  const { signIn, signOut } = useAuthActions();
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
      <Link
        href="/profil"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      >
        <TrendingUp className="size-3.5" />
        Fremgang
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
      <span className="ml-1 max-w-40 truncate text-sm text-muted-foreground" title={name}>
        {name}
        {me?.isAdmin ? " · admin" : ""}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => void signOut()}
        aria-label="Logg ut"
        title="Logg ut"
      >
        <LogOut className="size-3.5" />
      </Button>
    </div>
  );
}
