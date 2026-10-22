/**
 * Classifies errors from the AI SDKs (Claude and Gemini both put the HTTP
 * status on their errors) to decide whether to wait, switch model or give up.
 */

/** HTTP status of an SDK error, if it has one. */
export function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
    ? error.status
    : undefined;
}

/**
 * - "retry": the service is busy or a limit was hit (429, 5xx, network error):
 *   the same model may work a bit later.
 * - "skip": this model can't do it (bad key, unknown model, invalid answer):
 *   try another model, but don't retry this one.
 */
export function classifyError(error: unknown): 'retry' | 'skip' {
  const status = statusOf(error);
  if (status === undefined) {
    // No HTTP status: a network failure or timeout (retry), or an answer
    // that didn't match the schema (another model may do better).
    return isInvalidAnswer(error) ? 'skip' : 'retry';
  }
  if (status === 408 || status === 409 || status === 429 || status >= 500) {
    return 'retry';
  }
  return 'skip';
}

function isInvalidAnswer(error: unknown): boolean {
  return (
    error instanceof SyntaxError ||
    (error instanceof Error && /answer from the model/i.test(error.message))
  );
}

/**
 * How long the API asked us to wait, in ms: the Retry-After header (Claude)
 * or the RetryInfo in the error body (Gemini: "retryDelay": "37s").
 */
export function retryDelayMs(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const headers = (error as { headers?: unknown }).headers;
  if (headers instanceof Headers) {
    const seconds = Number(headers.get('retry-after'));
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }

  const message = error instanceof Error ? error.message : '';
  const match =
    /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(message) ??
    /retry in ([\d.]+)\s*s/i.exec(message);
  return match ? Math.ceil(Number(match[1]) * 1000) : undefined;
}
