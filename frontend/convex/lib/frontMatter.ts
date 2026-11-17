/**
 * Lessons uploaded as plain PDF or Word files start with a title page, a
 * summary and a table of contents, which the upload splits into chapters of
 * their own. These are not chapters to read and take notes from, so they are
 * shown as a preface to the first real chapter instead.
 *
 * Shared by the app and Convex, so chapter counts agree everywhere.
 */

type SectionLike = { title: string; text: string };

/** Lines like "1.3. Produktutvikling 5" or "1.1.   INNLEDNING .......... 2" */
const TOC_LINE = /(\.{3,}|\s)\s*\d{1,3}\s*$/;
const TITLE_PAGE = /Opphavsrett|NTNU|TISIP|Lærestoffet|\b\d{2}\.\d{2}\.\d{4}\b|This article was first published/i;

function isFrontMatter(section: SectionLike): boolean {
  const text = section.text.trim();
  // The summary sometimes starts after the end of a heading that wrapped
  if (/Resymé/i.test(text.slice(0, 160)) || /^Resymé/i.test(section.title.trim())) return true;
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.filter((l) => TOC_LINE.test(l)).length >= 3 && /Innhold|INNLEDNING|Innledning|\.{6,}/.test(text)) return true;
  return text.length < 600 && TITLE_PAGE.test(text);
}

/** How many of the first sections are title page, summary or contents */
export function frontMatterCount(sections: SectionLike[]): number {
  let count = 0;
  // Always keep at least one real chapter
  while (count < sections.length - 1 && isFrontMatter(sections[count])) count++;
  return count;
}
