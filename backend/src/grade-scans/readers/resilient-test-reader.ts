import { Logger } from '@nestjs/common';
import { classifyError, retryDelayMs, statusOf } from './ai-errors';
import type {
  ReadContext,
  TestImage,
  TestReader,
  TestReading,
} from './test-reader';

export interface RetryPolicy {
  /** Longest time spent on one photo, waits included. */
  budgetMs: number;
  /** First wait when no model is available; doubles every round. */
  baseDelayMs: number;
  /** Longest single wait. */
  maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  budgetMs: 60_000,
  baseDelayMs: 2_000,
  maxDelayMs: 20_000,
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reads a photo with a list of models, so a busy or rate-limited model doesn't
 * fail the scan:
 * 1. Try the models in order; on a limit (429) or an outage, move on to the
 *    next one right away (on free tiers every model has its own quota).
 * 2. A model that can't do it (bad key, unknown model) is dropped for this photo.
 * 3. If every model is busy, wait (as long as the API asked, or 2 s, 4 s, 8 s...)
 *    and go round again, until the time budget for the photo runs out.
 */
export class ResilientTestReader implements TestReader {
  readonly mode = 'ai' as const;
  private readonly logger = new Logger(ResilientTestReader.name);

  constructor(
    private readonly readers: TestReader[],
    private readonly policy: RetryPolicy = DEFAULT_RETRY_POLICY,
    private readonly wait: (ms: number) => Promise<void> = sleep,
    private readonly now: () => number = Date.now,
  ) {
    if (readers.length === 0) throw new Error('At least one reader is needed');
  }

  /** The preferred model; the one that actually read a photo is in readBy. */
  get model(): string | null {
    return this.readers[0].model;
  }

  get models(): (string | null)[] {
    return this.readers.map((reader) => reader.model);
  }

  async read(image: TestImage, context: ReadContext): Promise<TestReading> {
    const deadline = this.now() + this.policy.budgetMs;
    let available = [...this.readers];
    let lastError: unknown;

    for (let round = 0; ; round++) {
      let requestedWait: number | undefined;

      for (const reader of [...available]) {
        try {
          const reading = await reader.read(image, context);
          return { ...reading, readBy: reader.model ?? undefined };
        } catch (error) {
          lastError = error;
          const kind = classifyError(error);
          this.logger.warn(
            `${reader.model} failed (${statusOf(error) ?? 'no status'}, ${kind}): ${
              error instanceof Error
                ? error.message.slice(0, 200)
                : String(error)
            }`,
          );
          if (kind === 'skip') {
            available = available.filter((r) => r !== reader);
          } else {
            const asked = retryDelayMs(error);
            if (asked !== undefined) {
              requestedWait = Math.min(requestedWait ?? asked, asked);
            }
          }
        }
      }

      if (available.length === 0) throw lastError;

      const backoff = Math.min(
        this.policy.baseDelayMs * 2 ** round,
        this.policy.maxDelayMs,
      );
      const delay = Math.min(requestedWait ?? backoff, this.policy.maxDelayMs);
      if (this.now() + delay > deadline) throw lastError;
      await this.wait(delay);
    }
  }
}
