import mammoth from "mammoth";
import type { ExtractedDocument } from "../types";
import { cleanExtractedText } from "../text-cleanup";
import { detectSections } from "../structure";

function newId(): string {
  return crypto.randomUUID();
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Dokument";
}

export async function extractFromFile(file: File): Promise<ExtractedDocument> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return extractPdf(file);
  if (lower.endsWith(".docx")) return extractDocx(file);
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return extractTxt(file);
  throw new Error("Støttede formater: PDF, DOCX og TXT");
}

export function extractFromPaste(
  text: string,
  title = "Innlimt tekst",
): ExtractedDocument {
  const cleaned = cleanExtractedText(text);
  const sections = detectSections(cleaned, title);
  return {
    id: newId(),
    title,
    sourceType: "paste",
    createdAt: new Date().toISOString(),
    sections,
    rawText: cleaned,
  };
}

async function extractTxt(file: File): Promise<ExtractedDocument> {
  const text = await file.text();
  const title = titleFromFilename(file.name);
  const cleaned = cleanExtractedText(text);
  return {
    id: newId(),
    title,
    sourceType: "txt",
    createdAt: new Date().toISOString(),
    sections: detectSections(cleaned, title),
    rawText: cleaned,
  };
}

async function extractDocx(file: File): Promise<ExtractedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const title = titleFromFilename(file.name);
  const { text, sections } = htmlToStructuredText(result.value, title);
  const cleaned = cleanExtractedText(text);
  return {
    id: newId(),
    title,
    sourceType: "docx",
    createdAt: new Date().toISOString(),
    sections:
      sections.length > 0 ? sections : detectSections(cleaned, title),
    rawText: cleaned,
  };
}

async function extractPdf(file: File): Promise<ExtractedDocument> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings: string[] = [];
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = "transform" in item ? item.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(lastY - y) > 2) {
        strings.push("\n");
      } else if (strings.length > 0 && !strings[strings.length - 1].endsWith("\n")) {
        strings.push(" ");
      }
      strings.push(item.str);
      if (y !== null) lastY = y;
    }
    pages.push(strings.join("").replace(/[ \t]+\n/g, "\n"));
  }

  const title = titleFromFilename(file.name);
  const joined = pages.join("\f");
  const cleaned = cleanExtractedText(joined);
  return {
    id: newId(),
    title,
    sourceType: "pdf",
    createdAt: new Date().toISOString(),
    sections: detectSections(cleaned, title),
    rawText: cleaned,
  };
}

function htmlToStructuredText(
  html: string,
  fallbackTitle: string,
): {
  text: string;
  sections: ExtractedDocument["sections"];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const sections: ExtractedDocument["sections"] = [];
  let currentTitle = fallbackTitle;
  let currentLevel = 1;
  let buffer: string[] = [];
  let index = 0;

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (!body) return;
    sections.push({
      id: `section-${index++}`,
      title: currentTitle,
      level: currentLevel,
      text: body,
    });
    buffer = [];
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.replace(/\s+/g, " ") ?? "";
      if (t.trim()) buffer.push(t.trim());
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();
    if (/^h[1-3]$/.test(tag)) {
      flush();
      currentTitle = node.textContent?.trim() || currentTitle;
      currentLevel = Number(tag[1]);
      return;
    }
    if (tag === "p" || tag === "li") {
      const t = node.textContent?.replace(/\s+/g, " ").trim();
      if (t) buffer.push(t);
      return;
    }
    node.childNodes.forEach(walk);
  };

  doc.body.childNodes.forEach(walk);
  flush();

  const text = sections.map((s) => `${s.title}\n${s.text}`).join("\n\n");
  return { text, sections };
}
