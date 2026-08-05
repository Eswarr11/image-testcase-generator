import type { RequirementItem } from '../core/services/requirements.service';

export interface GenerateRequestDto {
  prompt?: string;
  confluenceUrls?: string[];
  figmaUrls?: string[];
  images?: string[];
  expectedCount?: number;
  figmaFrameSelections?: Record<string, string[]>;
  uncoveredRequirementIds?: string[];
  existingRequirements?: RequirementItem[];
}
