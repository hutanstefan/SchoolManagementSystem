import { z } from 'zod';

/** "a, b,,c" -> ["a", "b", "c"] */
function commaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** An optional key: empty or whitespace counts as not set. */
const optionalSecret = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

/**
 * Schema for all environment variables used by the API.
 * The app refuses to start if any of them is missing or invalid.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /**
   * Number of reverse proxies in front of the API (e.g. 1 behind nginx in
   * Docker). Lets Express read the client IP from X-Forwarded-For, so rate
   * limits apply per client and not to the proxy as a whole.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  /**
   * Which AI reads grades from photos of tests. "auto" uses Gemini if
   * GEMINI_API_KEY is set, else Claude if ANTHROPIC_API_KEY is set, else the
   * demo mode with simulated results.
   */
  AI_PROVIDER: z.enum(['auto', 'gemini', 'claude', 'demo']).default('auto'),
  /** Google Gemini API key (has a free tier: https://aistudio.google.com/apikey). */
  GEMINI_API_KEY: optionalSecret,
  /** Gemini model that reads the photos (any model with image input). */
  GEMINI_MODEL: z.string().min(1).default('gemini-3.8-flash'),
  /**
   * Gemini models to switch to when the main one is rate-limited or busy
   * (comma-separated). On the free tier every model has its own quota.
   */
  GEMINI_FALLBACK_MODELS: z
    .string()
    .default('gemini-3.6-flash,gemini-2.5-flash')
    .transform(commaList),
  /** Anthropic API key for Claude (https://console.anthropic.com). */
  ANTHROPIC_API_KEY: optionalSecret,
  /** Claude model that reads the photos (any model with vision). */
  ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  /** Photos read at the same time. Keep it low on free tiers. */
  AI_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  /** Longest time spent on one photo, waits for rate limits included. */
  AI_RETRY_SECONDS: z.coerce.number().int().min(0).max(300).default(60),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return result.data;
}
