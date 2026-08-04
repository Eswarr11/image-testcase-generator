import type {
  AtlassianSessionCreds,
  FigmaSessionCreds,
  SessionStatus,
} from '../core/repositories/session.repository';

export interface SaveCredentialsDto {
  openai?: string | null;
  atlassian?: Partial<AtlassianSessionCreds> | null;
  figma?: Partial<FigmaSessionCreds> | null;
}

export type { SessionStatus };
