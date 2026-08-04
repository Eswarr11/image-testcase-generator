import type { CoverageItem } from './structured-output.service';
import type { RequirementItem } from './requirements.service';

export function buildCoverage(
  requirements: RequirementItem[],
  links: Array<{ requirementId: string; coveredBy: string[] }>,
  testCases: Array<{ id: string; coversRequirements?: string[] }>
): CoverageItem[] {
  const byRequirement = new Map<string, string[]>();

  for (const link of links) byRequirement.set(link.requirementId, [...(link.coveredBy || [])]);
  for (const testCase of testCases) {
    for (const requirementId of testCase.coversRequirements || []) {
      const coveredBy = byRequirement.get(requirementId) || [];
      if (!coveredBy.includes(testCase.id)) coveredBy.push(testCase.id);
      byRequirement.set(requirementId, coveredBy);
    }
  }

  return requirements.map((requirement) => {
    const coveredBy = byRequirement.get(requirement.id) || [];
    return {
      requirementId: requirement.id,
      requirementText: requirement.text,
      coveredBy,
      status: coveredBy.length ? 'covered' : 'uncovered',
    };
  });
}
