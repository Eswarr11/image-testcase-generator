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
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();

  const parsed = JSON.parse(text) as {
    testCases?: StructuredTestCase[];
    coverage?: Array<{ requirementId: string; coveredBy?: string[] }>;
  };

  const testCases = Array.isArray(parsed.testCases) ? parsed.testCases : [];
  const coverageLinks = Array.isArray(parsed.coverage)
    ? parsed.coverage.map((c) => ({
        requirementId: c.requirementId,
        coveredBy: Array.isArray(c.coveredBy) ? c.coveredBy : [],
      }))
    : [];

  return { testCases, coverageLinks };
}
