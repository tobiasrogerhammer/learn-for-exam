import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AccountButton } from "@/components/account-button";

/** Top bar for pages outside the main study view */
export function PageHeader({ title }: { title: string }) {
  return (
    <header className="border-b border-border/50 bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Pensum
          </Link>
          <h1 className="truncate font-[family-name:var(--font-reading)] text-xl leading-tight">
            {title}
          </h1>
        </div>
        <AccountButton />
      </div>
    </header>
  );
}
