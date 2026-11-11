import {
  ClipboardType,
  FileText,
  FileType2,
  NotebookText,
  type LucideIcon,
} from "lucide-react";
import type { LibraryItem } from "@/lib/types";

const SOURCE_ICONS: Record<LibraryItem["sourceType"], { icon: LucideIcon; label: string; color: string }> = {
  pdf: { icon: FileText, label: "PDF", color: "text-red-600 dark:text-red-400" },
  docx: { icon: FileType2, label: "Word", color: "text-blue-600 dark:text-blue-400" },
  txt: { icon: NotebookText, label: "Tekstfil", color: "text-slate-500 dark:text-slate-400" },
  paste: { icon: ClipboardType, label: "Innlimt tekst", color: "text-amber-600 dark:text-amber-400" },
};

/** File type shown as a colored icon instead of a text label */
export function SourceIcon({ type }: { type: LibraryItem["sourceType"] }) {
  const { icon: Icon, label, color } = SOURCE_ICONS[type] ?? SOURCE_ICONS.txt;
  return (
    <span className="mt-0.5 shrink-0" title={label}>
      <Icon className={`size-4 ${color}`} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
