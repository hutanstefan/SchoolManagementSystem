import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import type { Env } from '../../config/env.validation';
import { ClaudeTestReader } from './claude-test-reader';
import { DemoTestReader } from './demo-test-reader';
import { GeminiTestReader } from './gemini-test-reader';
import {
  DEFAULT_RETRY_POLICY,
  ResilientTestReader,
} from './resilient-test-reader';
import type { TestReader } from './test-reader';

export type AiEnv = Pick<
  Env,
  | 'AI_PROVIDER'
  | 'GEMINI_API_KEY'
  | 'GEMINI_MODEL'
  | 'GEMINI_FALLBACK_MODELS'
  | 'ANTHROPIC_API_KEY'
  | 'ANTHROPIC_MODEL'
  | 'AI_RETRY_SECONDS'
>;

/** Each request gets this long; retries are handled by ResilientTestReader. */
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Builds the reader from the configuration: a chain of models, tried in
 * order. With AI_PROVIDER=auto: the Gemini models if GEMINI_API_KEY is set
 * (free tier), then Claude if ANTHROPIC_API_KEY is set. Without any key, the
 * demo reader, so the app always starts and the feature can be tried.
 */
export function createTestReader(env: AiEnv): TestReader {
  const useGemini =
    env.AI_PROVIDER === 'gemini' ||
    (env.AI_PROVIDER === 'auto' && Boolean(env.GEMINI_API_KEY));
  const useClaude =
    env.AI_PROVIDER === 'claude' ||
    (env.AI_PROVIDER === 'auto' && Boolean(env.ANTHROPIC_API_KEY));

  if (env.AI_PROVIDER === 'demo' || (!useGemini && !useClaude)) {
    return new DemoTestReader();
  }

  const readers: TestReader[] = [];
  if (useGemini) {
    if (!env.GEMINI_API_KEY) {
      throw new Error('AI_PROVIDER is gemini but GEMINI_API_KEY is not set');
    }
    const client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      // No retries inside the SDK: ResilientTestReader decides when to retry.
      httpOptions: { timeout: REQUEST_TIMEOUT_MS },
    });
    const models = [env.GEMINI_MODEL, ...env.GEMINI_FALLBACK_MODELS];
    for (const model of new Set(models)) {
      readers.push(new GeminiTestReader(client, model));
    }
  }
  if (useClaude) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('AI_PROVIDER is claude but ANTHROPIC_API_KEY is not set');
    }
    const client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS,
    });
    readers.push(new ClaudeTestReader(client, env.ANTHROPIC_MODEL));
  }

  return new ResilientTestReader(readers, {
    ...DEFAULT_RETRY_POLICY,
    budgetMs: env.AI_RETRY_SECONDS * 1000,
  });
}
