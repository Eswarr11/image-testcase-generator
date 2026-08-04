import type { RequirementItem } from './requirements.service';
import type { CoverageItem, StructuredTestCase } from './structured-output.service';
import { buildCoverage } from './coverage.service';

export interface GeneratedTestCases {
  testCases: StructuredTestCase[];
  markdown: string;
  requirements: RequirementItem[];
  coverage: CoverageItem[];
}

export function assembleGeneratedTestCases(
  testCases: StructuredTestCase[],
  markdown: string,
  requirements: RequirementItem[],
  coverageLinks: Array<{ requirementId: string; coveredBy: string[] }>
): GeneratedTestCases {
  return {
    testCases,
    markdown,
    requirements,
    coverage: buildCoverage(requirements, coverageLinks, testCases),
  };
}
