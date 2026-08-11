import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { APIConnectionTimeoutError } from 'openai';
import type { OpenAIContentPart } from '../services/openai.service';
import type { StructuredTestCase } from '../services/structured-output.service';
import {
  parseGenerateJson,
  retryInvalidJsonInstruction,
  retryExactCountInstruction,
} from '../services/structured-output.service';
import { logger } from '../../../../logger/logger';

const GraphState = Annotation.Root({
  openaiKey: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  systemPrompt: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  contentParts: Annotation<OpenAIContentPart[]>({ reducer: (_, y) => y, default: () => [] }),
  expectedCount: Annotation<number>({ reducer: (_, y) => y, default: () => 10 }),
  maxTokens: Annotation<number>({ reducer: (_, y) => y, default: () => 8000 }),

  currentParts: Annotation<OpenAIContentPart[]>({ reducer: (_, y) => y, default: () => [] }),
  rawResponse: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),

  jsonRetryCount: Annotation<number>({ reducer: (_, y) => y, default: () => 0 }),
  countRetryCount: Annotation<number>({ reducer: (_, y) => y, default: () => 0 }),
  parseNeedsRetry: Annotation<boolean>({ reducer: (_, y) => y, default: () => false }),
  countNeedsRetry: Annotation<boolean>({ reducer: (_, y) => y, default: () => false }),

  testCases: Annotation<StructuredTestCase[]>({ reducer: (_, y) => y, default: () => [] }),
  coverageLinks: Annotation<Array<{ requirementId: string; coveredBy: string[] }>>({
    reducer: (_, y) => y,
    default: () => [],
  }),

  error: Annotation<string>({ reducer: (_, y) => y, default: () => '' }),
  errorStatus: Annotation<number>({ reducer: (_, y) => y, default: () => 0 }),
});

type State = typeof GraphState.State;

function prepareContentNode(state: State): Partial<State> {
  return { currentParts: state.contentParts };
}

async function callLLMNode(state: State): Promise<Partial<State>> {
  const imageCount = state.currentParts.filter((p) => p.type === 'image_url').length;
  const textParts = state.currentParts.filter((p) => p.type === 'text').length;

  logger.info('openai_call_start', {
    model: 'gpt-4o',
    textParts,
    imageCount,
    maxTokens: state.maxTokens,
  });
  const started = Date.now();

  try {
    const model = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: state.maxTokens,
      apiKey: state.openaiKey,
      timeout: 180_000,
      modelKwargs: { response_format: { type: 'json_object' } },
    });

    const humanContent = state.currentParts.map((part) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text };
      }
      return {
        type: 'image_url' as const,
        image_url: { url: part.image_url.url, detail: part.image_url.detail },
      };
    });

    const messages = [
      new SystemMessage(state.systemPrompt),
      new HumanMessage({ content: humanContent }),
    ];

    const response = await model.invoke(messages);

    const content = response.content;
    let rawResponse: string;
    if (typeof content === 'string') {
      rawResponse = content;
    } else if (Array.isArray(content)) {
      rawResponse = content
        .map((c) => {
          if (typeof c === 'string') return c;
          if (typeof c === 'object' && c !== null && 'text' in c) {
            return String((c as { text: unknown }).text);
          }
          return '';
        })
        .join('');
    } else {
      rawResponse = '';
    }

    const meta = response.response_metadata as Record<string, unknown> | undefined;
    const finishReason = meta?.['finish_reason'];

    logger.info('openai_call_end', {
      durationMs: Date.now() - started,
      responseChars: rawResponse.length,
      finishReason,
    });

    if (!rawResponse.trim()) {
      return { error: 'Empty response from OpenAI', errorStatus: 502 };
    }

    if (finishReason === 'length') {
      logger.warn('openai_response_truncated', {
        responseChars: rawResponse.length,
        maxTokens: state.maxTokens,
      });
    }

    return { rawResponse };
  } catch (err) {
    const durationMs = Date.now() - started;
    if (err instanceof APIConnectionTimeoutError) {
      logger.error('openai_call_fail', { status: 'timeout', durationMs });
      return {
        error: 'Generation timed out. Try fewer links or images.',
        errorStatus: 504,
      };
    }
    const message = err instanceof Error ? err.message : 'OpenAI request failed';
    logger.error('openai_call_fail', { status: 'error', durationMs, message });
    return { error: message, errorStatus: 502 };
  }
}

function parseResponseNode(state: State): Partial<State> {
  try {
    const { testCases, coverageLinks } = parseGenerateJson(state.rawResponse);
    logger.info('generate_parse_success', {
      testCaseCount: testCases.length,
      expectedCount: state.expectedCount,
      recovered: state.jsonRetryCount > 0,
    });
    return { testCases, coverageLinks, parseNeedsRetry: false };
  } catch (parseErr) {
    if (state.jsonRetryCount >= 1) {
      logger.error('generate_parse_fail', {
        expectedCount: state.expectedCount,
        error: (parseErr as Error).message,
        responseChars: state.rawResponse.length,
      });
      return {
        error: 'Model did not return valid structured JSON. Try fewer test cases or simpler inputs.',
        errorStatus: 502,
      };
    }
    logger.warn('generate_parse_fail_retry', {
      expectedCount: state.expectedCount,
      error: (parseErr as Error).message,
      responseChars: state.rawResponse.length,
    });
    return {
      jsonRetryCount: state.jsonRetryCount + 1,
      parseNeedsRetry: true,
      currentParts: [
        ...state.contentParts,
        { type: 'text' as const, text: retryInvalidJsonInstruction(state.expectedCount) },
      ],
    };
  }
}

function validateCountNode(state: State): Partial<State> {
  const { testCases, expectedCount } = state;

  if (testCases.length > expectedCount) {
    logger.info('generate_count_truncated', { expectedCount, previous: testCases.length });
    return { testCases: testCases.slice(0, expectedCount), countNeedsRetry: false };
  }

  if (testCases.length === expectedCount) {
    return { countNeedsRetry: false };
  }

  // Under count
  if (state.countRetryCount >= 1) {
    return {
      error: `Model returned ${testCases.length} test cases but ${expectedCount} were required. Please try again.`,
      errorStatus: 502,
    };
  }

  const previousCount = testCases.length;
  logger.info('generate_count_retry', { expectedCount, previousCount });
  return {
    countRetryCount: state.countRetryCount + 1,
    countNeedsRetry: true,
    currentParts: [
      ...state.contentParts,
      { type: 'text' as const, text: retryExactCountInstruction(expectedCount, previousCount) },
    ],
  };
}

function routeAfterParse(state: State): 'callLLM' | 'validateCount' | typeof END {
  if (state.error) return END;
  if (state.parseNeedsRetry) return 'callLLM';
  return 'validateCount';
}

function routeAfterValidate(state: State): 'callLLM' | typeof END {
  if (state.error) return END;
  if (state.countNeedsRetry) return 'callLLM';
  return END;
}

const workflow = new StateGraph(GraphState)
  .addNode('prepareContent', prepareContentNode)
  .addNode('callLLM', callLLMNode)
  .addNode('parseResponse', parseResponseNode)
  .addNode('validateCount', validateCountNode)
  .addEdge(START, 'prepareContent')
  .addEdge('prepareContent', 'callLLM')
  .addEdge('callLLM', 'parseResponse')
  .addConditionalEdges('parseResponse', routeAfterParse, {
    callLLM: 'callLLM',
    validateCount: 'validateCount',
    [END]: END,
  })
  .addConditionalEdges('validateCount', routeAfterValidate, {
    callLLM: 'callLLM',
    [END]: END,
  });

export const generateGraph = workflow.compile();
