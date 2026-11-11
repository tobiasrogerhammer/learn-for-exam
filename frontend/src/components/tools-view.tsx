"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { SubjectTool } from "@/lib/types";

type Props = {
  tools: SubjectTool[];
};

/** Interactive practice pages (plain HTML in public/ovinger) shown inside the app */
export function ToolsView({ tools }: Props) {
  const [activeId, setActiveId] = useState(tools[0]?.id);
  const tool = tools.find((t) => t.id === activeId) ?? tools[0];
  if (!tool) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {tools.length > 1
          ? tools.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === tool.id}
                onClick={() => setActiveId(t.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  t.id === tool.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background/60 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                {t.title}
              </button>
            ))
          : null}
        <a
          href={tool.src}
          target="_blank"
          rel="noreferrer"
          className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
          Åpne i egen fane
        </a>
      </div>
      <iframe
        key={tool.id}
        src={tool.src}
        title={tool.title}
        className="h-[calc(100vh-11rem)] min-h-[600px] w-full rounded-md border border-border/70 bg-background shadow-sm"
      />
    </section>
  );
}
