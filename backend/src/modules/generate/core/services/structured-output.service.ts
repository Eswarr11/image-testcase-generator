export interface StructuredTestCase {
  id: string;
  title: string;
  description: string;
  preconditions: string[];
  steps: string[];
  expected: string[];
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  regression: 'YES' | 'NO' | string;
  testData: string[];
  postconditions: string[];
  coversRequirements?: string[];
  sources?: string[];
}

export interface CoverageItem {
  requirementId: string;
  requirementText: string;
  coveredBy: string[];
  status: 'covered' | 'uncovered';
}

export interface GenerateResponse {
  testCases: StructuredTestCase[];
  markdown: string;
  requirements: Array<{ id: string; text: string }>;
  coverage: CoverageItem[];
}

export const STRUCTURED_OUTPUT_INSTRUCTIONS = `
You MUST respond with a single JSON object only (no markdown fences, no commentary) matching this schema:

{
  "testCases": [
    {
      "id": "TC-001",
      "title": "string",
      "description": "string",
      "preconditions": ["string"],
      "steps": ["string"],
      "expected": ["string"],
      "priority": "Critical|High|Medium|Low",
      "regression": "YES|NO",
      "testData": ["string"],
      "postconditions": ["string"],
      "coversRequirements": ["REQ-001"],
      "sources": ["Confluence: …", "Figma: …"]
    }
  ],
  "coverage": [
    {
      "requirementId": "REQ-001",
      "coveredBy": ["TC-001"]
    }
  ]
}

Rules:
- Generate multiple test cases covering positive, negative, and edge cases where applicable
- Ground steps in Confluence requirements and Figma UI when provided
- coversRequirements must reference requirement IDs from the provided requirements list when possible
- coverage must include EVERY requirement id from the provided list (coveredBy may be empty)
- Prefer concrete, executable QA steps
`;

export function exactCountInstruction(count: number): string {
  const padded = String(count).padStart(3, '0');
  return [
    `## Exact test case count (mandatory)`,
    `You MUST return EXACTLY ${count} objects in the "testCases" array — no more, no fewer.`,
    `Use sequential IDs TC-001 through TC-${padded}.`,
    `If sources are thin, still produce ${count} distinct, useful cases (vary positive/negative/edge/UI paths).`,
    `Keep each case compact: 2–4 steps, short expected results, short arrays — the full JSON must fit in one response.`,
  ].join('\n');
}

export function retryExactCountInstruction(count: number, previousCount: number): string {
  return [
    `## Correction required`,
    `Your previous response had ${previousCount} test cases but EXACTLY ${count} are required.`,
    `Return a complete JSON object again with EXACTLY ${count} test cases (TC-001 … TC-${String(count).padStart(3, '0')}).`,
    `Keep fields compact so the JSON is complete and valid.`,
  ].join('\n');
}

export function retryInvalidJsonInstruction(count: number): string {
  return [
    `## Correction required`,
    `Your previous reply was not valid complete JSON (likely truncated).`,
    `Return ONE complete valid JSON object with EXACTLY ${count} compact test cases.`,
    `Prefer shorter steps/expected arrays so the response finishes within token limits.`,
  ].join('\n');
}

function extractJsonObject(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();

  if (text.startsWith('{') && text.endsWith('}')) return text;

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '')).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeTestCase(raw: Record<string, unknown>, index: number): StructuredTestCase {
  const n = String(index + 1).padStart(3, '0');
  return {
    id: String(raw.id || `TC-${n}`),
    title: String(raw.title || `Test case ${index + 1}`),
    description: String(raw.description || ''),
    preconditions: asStringArray(raw.preconditions),
    steps: asStringArray(raw.steps),
    expected: asStringArray(raw.expected),
    priority: String(raw.priority || 'Medium'),
    regression: String(raw.regression || 'NO'),
    testData: asStringArray(raw.testData),
    postconditions: asStringArray(raw.postconditions),
    coversRequirements: asStringArray(raw.coversRequirements),
    sources: asStringArray(raw.sources),
  };
}

export function testCasesToMarkdown(cases: StructuredTestCase[]): string {
  return cases
    .map((tc, i) => {
      const n = i + 1;
      return [
        `## Test Case ${n}: ${tc.title}`,
        '',
        `**Test Case Title:** ${tc.title}`,
        `**Test Case ID:** ${tc.id}`,
        `**Description:** ${tc.description}`,
        `**Regression Candidate:** ${tc.regression}`,
        '**Pre-conditions:**',
        ...(tc.preconditions.length ? tc.preconditions.map((p) => `- ${p}`) : ['- None']),
        '',
        '**Test Steps:**',
        ...(tc.steps.length ? tc.steps.map((s, idx) => `${idx + 1}. ${s}`) : ['1. N/A']),
        '',
        '**Expected Results:**',
        ...(tc.expected.length ? tc.expected.map((e) => `- ${e}`) : ['- N/A']),
        '',
        `**Priority Level:** ${tc.priority}`,
        '**Test Data:**',
        ...(tc.testData.length ? tc.testData.map((d) => `- ${d}`) : ['- N/A']),
        '',
        '**Post-conditions:**',
        ...(tc.postconditions.length ? tc.postconditions.map((p) => `- ${p}`) : ['- N/A']),
        tc.coversRequirements?.length
          ? `\n**Covers:** ${tc.coversRequirements.join(', ')}`
          : '',
        tc.sources?.length ? `\n**Sources:** ${tc.sources.join('; ')}` : '',
        '',
        '---',
        '',
      ].join('\n');
    })
    .join('\n');
}

export function parseGenerateJson(raw: string): {
  testCases: StructuredTestCase[];
  coverageLinks: Array<{ requirementId: string; coveredBy: string[] }>;
} {
  const text = extractJsonObject(raw);

  let parsed: {
    testCases?: unknown;
    coverage?: Array<{ requirementId?: string; coveredBy?: unknown }>;
  };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JSON parse failed';
    throw new Error(
      `${message} (chars=${raw.length}, head=${JSON.stringify(raw.slice(0, 120))}, tail=${JSON.stringify(raw.slice(-120))})`
    );
  }

  const rawCases = Array.isArray(parsed.testCases) ? parsed.testCases : [];
  const testCases = rawCases
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .map((c, i) => normalizeTestCase(c, i));

  const coverageLinks = Array.isArray(parsed.coverage)
    ? parsed.coverage
        .filter((c) => c && typeof c.requirementId === 'string')
        .map((c) => ({
          requirementId: String(c.requirementId),
          coveredBy: asStringArray(c.coveredBy),
        }))
    : [];

  return { testCases, coverageLinks };
}
