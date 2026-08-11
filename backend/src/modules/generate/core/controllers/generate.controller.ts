import { Router, Request, Response } from 'express';
import { getSession, SESSION_COOKIE } from '../../../session/core/repositories/session.repository';
import { fetchConfluenceContent } from '../../../sources/core/services/confluence.service';
import { fetchFigmaContent } from '../../../sources/core/services/figma.service';
import { SYSTEM_PROMPT } from '../../../../constants/systemPrompt';
import { extractRequirements } from '../services/requirements.service';
import {
  GenerateResponse,
  STRUCTURED_OUTPUT_INSTRUCTIONS,
  exactCountInstruction,
  testCasesToMarkdown,
} from '../services/structured-output.service';
import { AppError } from '../../../../exceptions/AppError';
import { tokensForExpectedCount } from '../services/openai.service';
import { generateGraph } from '../graph/generate.graph';
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

const STEP_LABELS: Record<string, string> = {
  prepareContent: 'Preparing content…',
  callLLM: 'Calling AI model…',
  parseResponse: 'Parsing response…',
  validateCount: 'Validating test cases…',
};

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

      if (session.atlassian) {
        for (let i = 0; i < confluenceUrls.length; i++) {
          const url = confluenceUrls[i];
          if (!url) continue;
          logger.info('generate_source_fetch', { source: 'confluence', index: i });
          const page = await fetchConfluenceContent(url, {
            siteUrl: session.atlassian.siteUrl,
            email: session.atlassian.email,
            token: session.atlassian.apiToken,
          });
          confluenceBodies.push(page.text);
          textSections.push(
            `## Confluence document ${i + 1}\nTitle: ${page.title}\nURL: ${page.url}\n\n${page.text}`
          );
        }
      }

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

      if (session.figma?.accessToken) {
        for (let i = 0; i < figmaUrls.length; i++) {
          const url = figmaUrls[i];
          if (!url) continue;
          if (i > 0) await new Promise((r) => setTimeout(r, 1500));
          logger.info('generate_source_fetch', { source: 'figma', index: i });
          const selected = frameSelections[url];
          const design = await fetchFigmaContent(url, session.figma.accessToken, {
            ...(selected && selected.length > 0 ? { selectedFrameIds: selected } : {}),
          });
          textSections.push(
            `## Figma design ${i + 1}\nTitle: ${design.title}\nURL: ${design.url}\n\n${design.text}`
          );
          if (design.images?.length) figmaImages.push(...design.images);
        }
      }

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

      for await (const event of run) {
        const params = event.params as Record<string, unknown> | undefined;
        const data = params?.['data'] as Record<string, unknown> | undefined;
        const method = event.method as string;

        // Node started: tasks event with name but no result yet
        if (method === 'tasks' && data && 'name' in data && !('result' in data)) {
          const nodeName = data['name'] as string;
          if (nodeName in STEP_LABELS) {
            if (nodeName === 'callLLM') callLLMCount++;
            writeSSE(res, 'progress', {
              step: nodeName,
              label: nodeName === 'callLLM' && callLLMCount > 1
                ? `Calling AI model… (attempt ${callLLMCount})`
                : STEP_LABELS[nodeName],
            });
          }
        }

        // LLM token delta
        if (method === 'messages') {
          const msgData = data as { event?: string; delta?: { type?: string; text?: string } } | undefined;
          if (
            msgData?.event === 'content-block-delta' &&
            msgData.delta?.type === 'text-delta' &&
            typeof msgData.delta.text === 'string'
          ) {
            writeSSE(res, 'token', { text: msgData.delta.text });
          }
        }
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
