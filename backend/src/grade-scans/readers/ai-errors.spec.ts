import { classifyError, retryDelayMs, statusOf } from './ai-errors';

const withStatus = (status: number, message = '') =>
  Object.assign(new Error(message), { status });

describe('AI error helpers', () => {
  it('reads the HTTP status of SDK errors', () => {
    expect(statusOf(withStatus(429))).toBe(429);
    expect(statusOf(new Error('x'))).toBeUndefined();
  });

  it('retries limits, outages and network errors, skips the rest', () => {
    expect(classifyError(withStatus(429))).toBe('retry');
    expect(classifyError(withStatus(503))).toBe('retry');
    expect(classifyError(new TypeError('fetch failed'))).toBe('retry');
    expect(classifyError(withStatus(401))).toBe('skip');
    expect(classifyError(withStatus(404))).toBe('skip');
    expect(classifyError(new Error('Unexpected answer from the model'))).toBe(
      'skip',
    );
    expect(classifyError(new SyntaxError('Unexpected token'))).toBe('skip');
  });

  it('reads how long the API asked to wait', () => {
    expect(
      retryDelayMs(
        Object.assign(new Error('limit'), {
          headers: new Headers({ 'retry-after': '12' }),
        }),
      ),
    ).toBe(12_000);
    expect(
      retryDelayMs(new Error('{"@type":"RetryInfo","retryDelay": "37s"}')),
    ).toBe(37_000);
    expect(retryDelayMs(new Error('Please retry in 4.2s.'))).toBe(4_200);
    expect(retryDelayMs(new Error('quota'))).toBeUndefined();
  });
});
