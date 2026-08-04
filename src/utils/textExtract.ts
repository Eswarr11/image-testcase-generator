const MAX_TEXT_LENGTH = 80_000;

/** Strip HTML tags and decode common entities into readable plain text. */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (text.length > MAX_TEXT_LENGTH) {
    text = `${text.slice(0, MAX_TEXT_LENGTH)}\n\n[...truncated]`;
  }

  return text;
}

export function truncateText(text: string, max = MAX_TEXT_LENGTH): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[...truncated]`;
}
