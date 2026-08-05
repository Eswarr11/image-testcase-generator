import { fetchWithTimeout } from '../../../sources/core/services/atlassian-auth.service';
import { logger } from '../../../../logger/logger';
import { AppError } from '../../../../exceptions/AppError';

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

const OPENAI_TIMEOUT_MS = 180_000;
const MAX_OUTPUT_TOKENS = 16_384;

export function tokensForExpectedCount(expectedCount: number): number {
  // ~700–900 tokens per detailed case; leave headroom for coverage + JSON overhead
  const scaled = Math.ceil(expectedCount * 850 + 800);
  return Math.min(MAX_OUTPUT_TOKENS, Math.max(6_000, scaled));
}

export async function createStructuredCompletion(
  apiKey: string,
  system: string,
  content: OpenAIContentPart[],
  options?: { maxTokens?: number }
): Promise<string> {
  const imageCount = content.filter((p) => p.type === 'image_url').length;
  const textParts = content.filter((p) => p.type === 'text').length;
  const maxTokens = Math.min(
    MAX_OUTPUT_TOKENS,
    Math.max(1_000, options?.maxTokens ?? 8_000)
  );

  logger.info('openai_call_start', {
    model: 'gpt-4o',
    textParts,
    imageCount,
    maxTokens,
  });
  const started = Date.now();

  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    },
    OPENAI_TIMEOUT_MS
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new AppError(
      502,
      'Bad Gateway',
      error.error?.message || `OpenAI request failed (${response.status})`,
      {
        event: 'openai_call_fail',
        fields: { status: response.status, durationMs: Date.now() - started },
      }
    );
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const choice = data.choices?.[0];
  const contentText = choice?.message?.content;
  const finishReason = choice?.finish_reason;

  if (!contentText?.trim()) {
    throw new AppError(502, 'Bad Gateway', 'Empty response from OpenAI', {
      event: 'openai_call_fail',
      fields: { reason: 'empty_response', durationMs: Date.now() - started, finishReason },
    });
  }

  logger.info('openai_call_end', {
    durationMs: Date.now() - started,
    responseChars: contentText.length,
    finishReason,
  });

  if (finishReason === 'length') {
    // Still return content so caller can try parse / repair; tag via error if parse fails
    logger.warn('openai_response_truncated', {
      responseChars: contentText.length,
      maxTokens,
    });
  }

  return contentText;
}
