import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { fetchConfluenceContent } from '../../../sources/core/services/confluence.service';
import { fetchFigmaContent } from '../../../sources/core/services/figma.service';
import type { AtlassianSessionCreds, FigmaSessionCreds } from '../../../session/core/repositories/session.repository';

export interface OrchestratorCredentials {
  openaiKey: string;
  atlassian?: AtlassianSessionCreds | null;
  figma?: FigmaSessionCreds | null;
}

export interface ToolFetchResult {
  title: string;
  url: string;
  text: string;
  images?: string[];
}

export function createOrchestratorAgent(credentials: OrchestratorCredentials) {
  const tools: StructuredToolInterface[] = [];

  if (credentials.atlassian) {
    const atl = credentials.atlassian;
    tools.push(
      tool(
        async ({ url }: { url: string }): Promise<string> => {
          const page = await fetchConfluenceContent(url, {
            siteUrl: atl.siteUrl,
            email: atl.email,
            token: atl.apiToken,
          });
          const result: ToolFetchResult = { title: page.title, url: page.url, text: page.text };
          return JSON.stringify(result);
        },
        {
          name: 'fetch_confluence',
          description: 'Fetch the text content of a Confluence page by URL. Call once per URL.',
          schema: z.object({ url: z.string().describe('Full Confluence page URL') }),
        }
      )
    );
  }

  if (credentials.figma?.accessToken) {
    const accessToken = credentials.figma.accessToken;
    tools.push(
      tool(
        async ({ url, selectedFrameIds }: { url: string; selectedFrameIds?: string[] }): Promise<string> => {
          const design = await fetchFigmaContent(url, accessToken, {
            ...(selectedFrameIds?.length ? { selectedFrameIds } : {}),
          });
          const result: ToolFetchResult = {
            title: design.title,
            url: design.url,
            text: design.text,
            ...(design.images?.length ? { images: design.images } : {}),
          };
          return JSON.stringify(result);
        },
        {
          name: 'fetch_figma',
          description: 'Fetch the content and frame images of a Figma design by URL. Call once per URL.',
          schema: z.object({
            url: z.string().describe('Figma file URL'),
            selectedFrameIds: z.array(z.string()).optional().describe('Specific frame IDs to export'),
          }),
        }
      )
    );
  }

  const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
    temperature: 0,
    apiKey: credentials.openaiKey,
    timeout: 60_000,
  });

  return createReactAgent({
    llm: model,
    tools,
    stateModifier:
      'You are a source-fetching agent. Fetch ALL provided URLs using the available tools, calling each tool exactly once per URL. Do not skip any URL.',
  });
}
