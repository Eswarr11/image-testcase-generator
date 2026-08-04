import { Router, Request, Response } from 'express';
import { getSession, SESSION_COOKIE } from '../session/vault';
import { fetchConfluenceContent, SourceServiceError } from '../services/confluence';
import { fetchFigmaContent } from '../services/figma';
import { SYSTEM_PROMPT } from '../constants/systemPrompt';
import { fetchWithTimeout } from '../utils/atlassianAuth';

interface ApiErrorBody {
  error: string;
  message: string;
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

const MAX_OPENAI_IMAGES = 12;
const OPENAI_TIMEOUT_MS = 180_000;

const router = Router();

function readCookieSessionId(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[SESSION_COOKIE];
}

router.post('/', async (req: Request, res: Response<ApiErrorBody | { content: string }>) => {
  const session = getSession(readCookieSessionId(req));
  if (!session?.openai?.trim()) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Save your OpenAI API key in the Credentials panel first',
    });
  }

  const body = (req.body || {}) as {
    prompt?: string;
    confluenceUrls?: string[];
    figmaUrls?: string[];
    images?: string[];
  };

  const prompt = String(body.prompt || '').trim();
  const confluenceUrls = (body.confluenceUrls || []).map((u) => String(u).trim()).filter(Boolean);
  const figmaUrls = (body.figmaUrls || []).map((u) => String(u).trim()).filter(Boolean);
  const clientImages = (body.images || []).filter((u) => typeof u === 'string' && u.startsWith('data:'));

  if (confluenceUrls.length === 0 && figmaUrls.length === 0 && clientImages.length === 0) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Provide at least one Confluence URL, Figma URL, or uploaded image',
    });
  }

  if (confluenceUrls.length > 0 && !session.atlassian) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Save Atlassian credentials before fetching Confluence pages',
    });
  }

  if (figmaUrls.length > 0 && !session.figma?.accessToken) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Save a Figma token before fetching designs',
    });
  }

  try {
    const textSections: string[] = [];
    const figmaImages: string[] = [];

    if (prompt) {
      textSections.push(`## Focus prompt\n${prompt}`);
    }

    if (session.atlassian) {
      for (let i = 0; i < confluenceUrls.length; i++) {
        const url = confluenceUrls[i];
        if (!url) continue;
        const page = await fetchConfluenceContent(url, {
          siteUrl: session.atlassian.siteUrl,
          email: session.atlassian.email,
          token: session.atlassian.apiToken,
        });
        textSections.push(
          `## Confluence document ${i + 1}\nTitle: ${page.title}\nURL: ${page.url}\n\n${page.text}`
        );
      }
    }

    if (session.figma?.accessToken) {
      for (let i = 0; i < figmaUrls.length; i++) {
        const url = figmaUrls[i];
        if (!url) continue;
        if (i > 0) await new Promise((r) => setTimeout(r, 1500));
        const design = await fetchFigmaContent(url, session.figma.accessToken);
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

    const openaiRes = await fetchWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.openai}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: contentArray },
          ],
          max_tokens: 4000,
          temperature: 0.2,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      },
      OPENAI_TIMEOUT_MS
    );

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({})) as { error?: { message?: string } };
      return res.status(502).json({
        error: 'Bad Gateway',
        message: errBody.error?.message || `OpenAI request failed (${openaiRes.status})`,
      });
    }

    const data = await openaiRes.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content?.trim()) {
      return res.status(502).json({
        error: 'Bad Gateway',
        message: 'Empty response from OpenAI',
      });
    }

    return res.json({ content });
  } catch (err) {
    if (err instanceof SourceServiceError) {
      if (err.status === 429) res.setHeader('Retry-After', '60');
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    if ((err as Error).name === 'AbortError') {
      return res.status(504).json({
        error: 'Timeout',
        message: 'Generation timed out. Try fewer links or images.',
      });
    }
    return res.status(502).json({
      error: 'Bad Gateway',
      message: (err as Error).message || 'Generation failed',
    });
  }
});

export default router;
