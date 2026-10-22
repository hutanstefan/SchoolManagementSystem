import { createTestReader, type AiEnv } from './create-test-reader';
import { DemoTestReader } from './demo-test-reader';
import { ResilientTestReader } from './resilient-test-reader';

const env: AiEnv = {
  AI_PROVIDER: 'auto',
  GEMINI_API_KEY: undefined,
  GEMINI_MODEL: 'gemini-3.8-flash',
  GEMINI_FALLBACK_MODELS: ['gemini-3.6-flash', 'gemini-2.5-flash'],
  ANTHROPIC_API_KEY: undefined,
  ANTHROPIC_MODEL: 'claude-haiku-5-5',
  AI_RETRY_SECONDS: 60,
};

const models = (config: AiEnv) => {
  const reader = createTestReader(config);
  return reader instanceof ResilientTestReader ? reader.models : null;
};

describe('createTestReader', () => {
  it('runs in demo mode without any key', () => {
    expect(createTestReader(env)).toBeInstanceOf(DemoTestReader);
    expect(
      createTestReader({ ...env, AI_PROVIDER: 'demo', GEMINI_API_KEY: 'g' }),
    ).toBeInstanceOf(DemoTestReader);
  });

  it('chains the free Gemini models first, then Claude as the last resort', () => {
    expect(
      models({ ...env, GEMINI_API_KEY: 'g-key', ANTHROPIC_API_KEY: 'a-key' }),
    ).toEqual([
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'claude-haiku-5-5',
    ]);
  });

  it('uses only the chosen provider', () => {
    expect(models({ ...env, ANTHROPIC_API_KEY: 'a-key' })).toEqual([
      'claude-haiku-5-5',
    ]);
    expect(
      models({
        ...env,
        AI_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'g-key',
        ANTHROPIC_API_KEY: 'a-key',
        GEMINI_FALLBACK_MODELS: [],
      }),
    ).toEqual(['gemini-3.8-flash']);
  });

  it('does not list the main model twice', () => {
    expect(
      models({
        ...env,
        GEMINI_API_KEY: 'g-key',
        GEMINI_FALLBACK_MODELS: ['gemini-3.8-flash', 'gemini-2.5-flash'],
      }),
    ).toEqual(['gemini-3.8-flash', 'gemini-2.5-flash']);
  });

  it('fails at startup when the chosen provider has no key', () => {
    expect(() => createTestReader({ ...env, AI_PROVIDER: 'gemini' })).toThrow(
      'GEMINI_API_KEY is not set',
    );
  });
});
