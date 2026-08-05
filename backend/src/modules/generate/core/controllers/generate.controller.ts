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
  parseGenerateJson,
  retryExactCountInstruction,
  retryInvalidJsonInstruction,
  testCasesToMarkdown,
} from '../services/structured-output.service';
import { AppError } from '../../../../exceptions/AppError';
import {
  createStructuredCompletion,
  tokensForExpectedCount,
} from '../services/openai.service';
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

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response<GenerateResponse>) => {
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

      const runCompletion = async (parts: ContentPart[]) =>
        createStructuredCompletion(openaiKey, system, parts, { maxTokens });

      let raw = await runCompletion(contentArray);

      let testCases;
      let coverageLinks;
      try {
        const parsed = parseGenerateJson(raw);
        testCases = parsed.testCases;
        coverageLinks = parsed.coverageLinks;
        logger.info('generate_parse_success', { testCaseCount: testCases.length, expectedCount });
      } catch (parseErr) {
        logger.warn('generate_parse_fail_retry', {
          expectedCount,
          error: (parseErr as Error).message,
          responseChars: raw.length,
        });
        const retryParts: ContentPart[] = [
          ...contentArray,
          { type: 'text', text: retryInvalidJsonInstruction(expectedCount) },
        ];
        raw = await runCompletion(retryParts);
        try {
          const parsed = parseGenerateJson(raw);
          testCases = parsed.testCases;
          coverageLinks = parsed.coverageLinks;
          logger.info('generate_parse_success', {
            testCaseCount: testCases.length,
            expectedCount,
            recovered: true,
          });
        } catch (retryErr) {
          logger.error('generate_parse_fail', {
            expectedCount,
            error: (retryErr as Error).message,
            responseChars: raw.length,
          });
          throw new AppError(
            502,
            'Bad Gateway',
            'Model did not return valid structured JSON. Try fewer test cases or simpler inputs.',
            { event: 'generate_parse_fail' }
          );
        }
      }

      if (!testCases.length) {
        throw new AppError(502, 'Bad Gateway', 'No test cases in model response', {
          event: 'generate_parse_fail',
          fields: { reason: 'empty_test_cases' },
        });
      }

      if (testCases.length > expectedCount) {
        const previous = testCases.length;
        testCases = testCases.slice(0, expectedCount);
        logger.info('generate_count_truncated', { expectedCount, previous });
      } else if (testCases.length < expectedCount) {
        const previousCount = testCases.length;
        logger.info('generate_count_retry', { expectedCount, previousCount });
        const retryParts: ContentPart[] = [
          ...contentArray,
          {
            type: 'text',
            text: retryExactCountInstruction(expectedCount, previousCount),
          },
        ];
        raw = await runCompletion(retryParts);
        try {
          const parsed = parseGenerateJson(raw);
          testCases = parsed.testCases;
          coverageLinks = parsed.coverageLinks;
        } catch {
          throw new AppError(
            502,
            'Bad Gateway',
            'Model did not return valid structured JSON on retry. Please try again.',
            { event: 'generate_parse_fail', fields: { reason: 'retry_parse_fail' } }
          );
        }

        if (testCases.length > expectedCount) {
          testCases = testCases.slice(0, expectedCount);
        } else if (testCases.length < expectedCount) {
          throw new AppError(
            502,
            'Bad Gateway',
            `Model returned ${testCases.length} test cases but ${expectedCount} were required. Please try again.`,
            {
              event: 'generate_parse_fail',
              fields: { reason: 'count_mismatch', expectedCount, got: testCases.length },
            }
          );
        }
      }

      const markdown = testCasesToMarkdown(testCases);
      logger.info('generate_success', { testCaseCount: testCases.length, expectedCount });
      return res.json(assembleGeneratedTestCases(
        testCases,
        markdown,
        requirements,
        coverageLinks
      ));
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as Error).name === 'AbortError') {
        throw new AppError(
          504,
          'Timeout',
          'Generation timed out. Try fewer links or images.',
          { event: 'generate_fail', fields: { reason: 'timeout' } }
        );
      }
      throw new AppError(
        502,
        'Bad Gateway',
        (err as Error).message || 'Generation failed',
        { event: 'generate_fail', fields: { reason: 'unexpected' } }
      );
    }
  })
);

export default router;
