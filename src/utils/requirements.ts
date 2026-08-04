/**
 * Heuristic extraction of requirement / acceptance-criteria style bullets from Confluence text.
 */

export interface RequirementItem {
  id: string;
  text: string;
}

const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;
const AC_HEADER_RE = /acceptance\s*criteria|requirements?|user\s*stories|scope|must\s*have|acceptance/i;

export function extractRequirements(confluenceTexts: string[]): RequirementItem[] {
  const items: RequirementItem[] = [];
  const seen = new Set<string>();
  let nearHeader = false;
  let counter = 1;

  for (const block of confluenceTexts) {
    const lines = block.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        nearHeader = false;
        continue;
      }

      if (AC_HEADER_RE.test(line) && line.length < 80) {
        nearHeader = true;
        continue;
      }

      const bullet = line.match(BULLET_RE);
      const candidate = bullet?.[1]?.trim() || (nearHeader && line.length > 12 && line.length < 280 ? line : '');

      if (!candidate) continue;
      // Skip navigation crumbs / space metadata
      if (/^(path|space|file|focus|frame):/i.test(candidate)) continue;

      const key = candidate.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        id: `REQ-${String(counter).padStart(3, '0')}`,
        text: candidate,
      });
      counter += 1;

      if (items.length >= 40) return items;
    }
  }

  return items;
}
