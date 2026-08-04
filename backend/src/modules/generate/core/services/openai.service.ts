import { fetchWithTimeout } from '../../../sources/core/services/atlassian-auth.service';
import { logger } from '../../../../logger/logger';
import { AppError } from '../../../../exceptions/AppError';

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

const OPENAI_TIMEOUT_MS = 180_000;

export async function createStructuredCompletion(
  apiKey: string,
  system: string,
  content: OpenAIContentPart[]
): Promise<string> {
  const imageCount = content.filter((p) => p.type === 'image_url').length;
  const textParts = content.filter((p) => p.type === 'text').length;

  logger.info('openai_call_start', {
    model: 'gpt-4o',
    textParts,
    imageCount,
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
        max_tokens: 4500,
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

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const contentText = data.choices?.[0]?.message?.content;
  if (!contentText?.trim()) {
    throw new AppError(502, 'Bad Gateway', 'Empty response from OpenAI', {
      event: 'openai_call_fail',
      fields: { reason: 'empty_response', durationMs: Date.now() - started },
    });
  }

  logger.info('openai_call_end', {
    durationMs: Date.now() - started,
    responseChars: contentText.length,
  });
  return contentText;
}
