/**
 * Pure functions for sanitizing and deriving session titles.
 */

export function toSingleLineTitle(raw: string | undefined, max = 72): string {
  const base = (raw ?? '(untitled)')
    .replace(/<attachment[\s\S]*?<\/attachment>/gi, ' ')
    .replace(/<attachments?>|<\/attachments?>/gi, ' ')
    .replace(/<reminder>[\s\S]*?<\/reminder>/gi, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (base.length <= max) return base;
  return `${base.slice(0, Math.max(1, max - 1))}…`;
}

export function looksLikeGenericTitle(title: string | undefined): boolean {
  if (!title) return true;
  const t = title.trim();
  if (!t) return true;
  if (/^session$/i.test(t)) return true;
  if (/^[a-z]+:\/\//i.test(t) || /^[a-z]+:\//i.test(t)) return true;
  return false;
}

export function firstPromptTitle(text: string, max = 64): string {
  const oneLine = text.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!oneLine) return 'New session';
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}
