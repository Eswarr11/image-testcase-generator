import { Router, Request, Response } from 'express';
import { getSession, SESSION_COOKIE } from '../../../session/core/repositories/session.repository';
import { extractRequirements } from '../services/requirements.service';
import { SYSTEM_PROMPT } from '../../../../constants/systemPrompt';
import {
  GenerateResponse,
  STRUCTURED_OUTPUT_INSTRUCTIONS,
  exactCountInstruction,
  testCasesToMarkdown,
} from '../services/structured-output.service';
import { AppError } from '../../../../exceptions/AppError';
import { tokensForExpectedCount } from '../services/openai.service';
import { generateGraph } from '../graph/generate.graph';
import { createOrchestratorAgent } from '../graph/orchestrator.graph';
import type { ToolFetchResult } from '../graph/orchestrator.graph';
import { assembleGeneratedTestCases } from '../services/generate.service';
import type { GenerateRequestDto } from '../../dto/generate.dto';
import { logger } from '../../../../logger/logger';
import { asyncHandler } from '../../../../utils/asyncHandler';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

const MAX_OPENAI_IMAGES = 20;
const MIN_EXPECTED_COUNT = 1;
const MAX_EXPECTED_COUNT = 40;
const DEFAULT_EXPECTED_COUNT = 10;
const router = Router();

function clampExpectedCount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_EXPECTED_COUNT;
  return Math.min(MAX_EXPECTED_COUNT, Math.max(MIN_EXPECTED_COUNT, Math.round(n)));
}

function readCookieSessionId(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE];
}

function writeSSE(res: Response, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { /* client disconnected */ }
}

function parseToolOutput(raw: unknown): ToolFetchResult | null {
  const str = typeof raw === 'string'
    ? raw
    : (raw && typeof raw === 'object' && 'content' in raw && typeof (raw as Record<string, unknown>)['content'] === 'string')
      ? (raw as Record<string, string>)['content']
      : null;
  if (!str) return null;
  try {
    return JSON.parse(str) as ToolFetchResult;
  } catch {
    return null;
  }
}

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response<GenerateResponse>) => {
    // Phase 1: Validation — errors here are normal JSON responses via asyncHandler
    const session = await getSession(readCookieSessionId(req));
    if (!session?.openai?.trim()) {
      throw new AppError(
        401,
        'Unauthorized',
        'Save your OpenAI API key in the Credentials panel first',
        { event: 'generate_reject', fields: { reason: 'missing_openai' } }
      );
    }
    const openaiKey = session.openai.trim();

    const body = (req.body || {}) as GenerateRequestDto;

    const prompt = String(body.prompt || '').trim();
    const confluenceUrls = (body.confluenceUrls || []).map((u) => String(u).trim()).filter(Boolean);
    const figmaUrls = (body.figmaUrls || []).map((u) => String(u).trim()).filter(Boolean);
    const clientImages = (body.images || []).filter((u) => typeof u === 'string' && u.startsWith('data:'));
    const frameSelections = body.figmaFrameSelections || {};
    const expectedCount = clampExpectedCount(body.expectedCount);
    const uncoveredIds = new Set(
      (body.uncoveredRequirementIds || []).map((id) => String(id)).filter(Boolean)
    );

    if (
      confluenceUrls.length === 0 &&
      figmaUrls.length === 0 &&
      clientImages.length === 0 &&
      !prompt
    ) {
      throw new AppError(
        400,
        'Bad Request',
        'Provide a prompt, Confluence URL, Figma URL, or uploaded image',
        { event: 'generate_reject', fields: { reason: 'empty_input' } }
      );
    }

    if (confluenceUrls.length > 0 && !session.atlassian) {
      throw new AppError(
        401,
        'Unauthorized',
        'Save Atlassian credentials before fetching Confluence pages',
        { event: 'generate_reject', fields: { reason: 'missing_atlassian' } }
      );
    }

    if (figmaUrls.length > 0 && !session.figma?.accessToken) {
      throw new AppError(
        401,
        'Unauthorized',
        'Save a Figma token before fetching designs',
        { event: 'generate_reject', fields: { reason: 'missing_figma' } }
      );
    }

    logger.info('generate_start', {
      confluenceCount: confluenceUrls.length,
      figmaCount: figmaUrls.length,
      clientImageCount: clientImages.length,
      hasPrompt: Boolean(prompt),
      expectedCount,
      uncoveredCount: uncoveredIds.size,
    });

    // Phase 2: SSE streaming — all errors from here go through writeSSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const textSections: string[] = [];
      const figmaImages: string[] = [];
      const confluenceBodies: string[] = [];

      if (prompt) {
        textSections.push(`## Focus prompt\n${prompt}`);
      }

      if (uncoveredIds.size > 0) {
        textSections.push(
          `## Generation mode\nGenerate ONLY additional test cases for the uncovered requirements listed below. Do not repeat already covered scenarios.`
        );
      }

      // Orchestrator: fetch remote sources with SSE visibility per tool call
      if (confluenceUrls.length > 0 || figmaUrls.length > 0) {
        const agent = createOrchestratorAgent({
          openaiKey,
          atlassian: session.atlassian,
          figma: session.figma,
        });

        const urlInstructions = [
          confluenceUrls.length > 0
            ? `Fetch these Confluence pages (one tool call per URL):\n${confluenceUrls.map((u) => `- ${u}`).join('\n')}`
            : '',
          figmaUrls.length > 0
            ? `Fetch these Figma designs (one tool call per URL):\n${figmaUrls
                .map((u) => {
                  const frames = frameSelections[u];
                  return frames?.length
                    ? `- ${u} (selectedFrameIds: [${frames.join(',')}])`
                    : `- ${u}`;
                })
                .join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        const agentRun = agent.streamEvents(
          { messages: [{ role: 'user' as const, content: urlInstructions }] },
          { version: 'v2' as const }
        );

        let confluenceIdx = 0;
        let figmaIdx = 0;

        for await (const event of agentRun) {
          if (event.event === 'on_tool_start') {
            logger.info('orchestrator_tool_start', { tool: event.name });
            writeSSE(res, 'tool_call', {
              name: event.name,
              input: (event.data?.['input'] ?? {}) as Record<string, unknown>,
            });
          }

          if (event.event === 'on_tool_end') {
            const result = parseToolOutput(event.data?.['output']);
            const sizeKb = Math.round((result?.text?.length ?? 0) / 1000);
            const summary = result?.title
              ? `Loaded '${result.title}' (${sizeKb} KB)`
              : 'Done';

            if (result) {
              if (event.name === 'fetch_confluence') {
                confluenceBodies.push(result.text);
                textSections.push(
                  `## Confluence document ${++confluenceIdx}\nTitle: ${result.title}\nURL: ${result.url}\n\n${result.text}`
                );
              } else if (event.name === 'fetch_figma') {
                textSections.push(
                  `## Figma design ${++figmaIdx}\nTitle: ${result.title}\nURL: ${result.url}\n\n${result.text}`
                );
                if (result.images?.length) figmaImages.push(...result.images);
              }
            }

            logger.info('orchestrator_tool_end', { tool: event.name, summary });
            writeSSE(res, 'tool_result', { name: event.name, summary });
          }
        }
      }

      // Requirements extraction (from Confluence bodies collected by orchestrator)
      let requirements = body.existingRequirements?.length
        ? body.existingRequirements
        : extractRequirements(confluenceBodies);

      if (uncoveredIds.size > 0) {
        requirements = requirements.filter((r) => uncoveredIds.has(r.id));
      }

      if (requirements.length > 0) {
        textSections.push(
          `## Requirements inventory (use these IDs in coversRequirements / coverage)\n` +
            requirements.map((r) => `- ${r.id}: ${r.text}`).join('\n')
        );
      }

      textSections.push(exactCountInstruction(expectedCount));

      const contentArray: ContentPart[] = [
        {
          type: 'text',
          text:
            textSections.join('\n\n---\n\n') ||
            'Generate comprehensive Jira test cases from the attached design images.',
        },
      ];

      for (const url of figmaImages.slice(0, MAX_OPENAI_IMAGES)) {
        contentArray.push({ type: 'image_url', image_url: { url, detail: 'high' } });
      }

      const remaining = Math.max(0, MAX_OPENAI_IMAGES - Math.min(figmaImages.length, MAX_OPENAI_IMAGES));
      for (const url of clientImages.slice(0, remaining)) {
        contentArray.push({ type: 'image_url', image_url: { url, detail: 'high' } });
      }

      const system = `${SYSTEM_PROMPT}\n\n${STRUCTURED_OUTPUT_INSTRUCTIONS}\n\n- You MUST return EXACTLY ${expectedCount} test cases in "testCases"\n- Keep JSON compact so the response is complete (not truncated)`;
      const maxTokens = tokensForExpectedCount(expectedCount);

      const run = await generateGraph.streamEvents(
        { openaiKey, systemPrompt: system, contentParts: contentArray, expectedCount, maxTokens },
        { version: 'v3', streamMode: ['tasks', 'messages'] }
      );

      let callLLMCount = 0;
      let tokenBuffer = '';
      let flushTimer: NodeJS.Timeout | null = null;

      const startTokenBatching = (): void => {
        if (flushTimer !== null) return;
        flushTimer = setInterval(() => {
          if (tokenBuffer) {
            writeSSE(res, 'token_batch', { text: tokenBuffer });
            tokenBuffer = '';
          }
        }, 150);
      };

      const stopTokenBatching = (): void => {
        if (flushTimer !== null) {
          clearInterval(flushTimer);
          flushTimer = null;
        }
        if (tokenBuffer) {
          writeSSE(res, 'token_batch', { text: tokenBuffer });
          tokenBuffer = '';
        }
      };

      try {
        for await (const event of run) {
          const params = event.params as Record<string, unknown> | undefined;
          const data = params?.['data'] as Record<string, unknown> | undefined;
          const method = event.method as string;

          // Node lifecycle
          if (method === 'tasks' && data && 'name' in data && !('result' in data)) {
            const nodeName = data['name'] as string;
            if (nodeName === 'callLLM') {
              callLLMCount++;
              writeSSE(res, 'generating', { attempt: callLLMCount });
              startTokenBatching();
            } else if (nodeName === 'parseResponse') {
              stopTokenBatching();
              writeSSE(res, 'parse', { attempt: callLLMCount });
            }
          }

          // Token delta → accumulate in buffer (flushed by interval)
          if (method === 'messages') {
            const msgData = data as { event?: string; delta?: { type?: string; text?: string } } | undefined;
            if (
              msgData?.event === 'content-block-delta' &&
              msgData.delta?.type === 'text-delta' &&
              typeof msgData.delta.text === 'string'
            ) {
              tokenBuffer += msgData.delta.text;
            }
          }
        }
      } finally {
        stopTokenBatching();
      }

      const result = await run.output;

      if (result.error) {
        writeSSE(res, 'error', { status: result.errorStatus || 502, message: result.error });
        return res.end();
      }

      if (!result.testCases.length) {
        writeSSE(res, 'error', { status: 502, message: 'No test cases in model response' });
        return res.end();
      }

      const markdown = testCasesToMarkdown(result.testCases);
      logger.info('generate_success', { testCaseCount: result.testCases.length, expectedCount });

      writeSSE(res, 'done', assembleGeneratedTestCases(
        result.testCases,
        markdown,
        requirements,
        result.coverageLinks,
      ));
      return res.end();
    } catch (err) {
      const message = err instanceof AppError
        ? err.message
        : (err instanceof Error ? err.message : 'Generation failed');
      const status = err instanceof AppError ? err.status : 502;
      writeSSE(res, 'error', { status, message });
      return res.end();
    }
  })
);

export default router;
