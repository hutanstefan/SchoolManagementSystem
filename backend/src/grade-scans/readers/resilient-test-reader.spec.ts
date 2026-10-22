import { Logger } from '@nestjs/common';
import { ResilientTestReader } from './resilient-test-reader';
import type { TestReader, TestReading } from './test-reader';

/** An error shaped like the ones from the AI SDKs. */
class ApiError extends Error {
  constructor(
    readonly status: number,
    message = `HTTP ${status}`,
  ) {
    super(message);
  }
}

const reading: TestReading = {
  studentName: 'Popescu Ioana',
  rosterNumber: 1,
  grade: 9,
  confidence: 'high',
  note: null,
};
const image = {
  data: Buffer.from('x'),
  mediaType: 'image/jpeg' as const,
  fileName: 'a.jpg',
};
const context = { className: '9A', subjectName: 'Maths', roster: [] };

function fakeReader(model: string, ...outcomes: (TestReading | Error)[]) {
  const read = jest.fn(() => {
    const next = outcomes.length > 1 ? outcomes.shift()! : outcomes[0];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  return { reader: { mode: 'ai', model, read } as TestReader, read };
}

describe('ResilientTestReader', () => {
  let clock: number;
  const waits: number[] = [];
  const wait = (ms: number) => {
    waits.push(ms);
    clock += ms;
    return Promise.resolve();
  };
  const policy = { budgetMs: 60_000, baseDelayMs: 2_000, maxDelayMs: 20_000 };
  const build = (...readers: TestReader[]) =>
    new ResilientTestReader(readers, policy, wait, () => clock);

  beforeAll(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation());
  beforeEach(() => {
    clock = 0;
    waits.length = 0;
  });

  it('switches to the next model right away when one is rate-limited', async () => {
    const main = fakeReader('gemini-a', new ApiError(429));
    const fallback = fakeReader('gemini-b', reading);

    const result = await build(main.reader, fallback.reader).read(
      image,
      context,
    );

    expect(result).toEqual({ ...reading, readBy: 'gemini-b' });
    expect(waits).toEqual([]);
  });

  it('waits and retries when every model is busy, then succeeds', async () => {
    const main = fakeReader(
      'gemini-a',
      new ApiError(429),
      new ApiError(503),
      reading,
    );

    const result = await build(main.reader).read(image, context);

    expect(result.readBy).toBe('gemini-a');
    expect(waits).toEqual([2_000, 4_000]);
  });

  it('waits as long as the API asked (Gemini retryDelay)', async () => {
    const limited = new ApiError(
      429,
      '{"error":{"details":[{"retryDelay":"7s"}]}}',
    );
    const main = fakeReader('gemini-a', limited, reading);

    await build(main.reader).read(image, context);

    expect(waits).toEqual([7_000]);
  });

  it('drops a model that cannot work (unknown model, bad key) without waiting', async () => {
    const unknown = fakeReader('gemini-old', new ApiError(404));
    const good = fakeReader('gemini-b', new ApiError(429), reading);

    const result = await build(unknown.reader, good.reader).read(
      image,
      context,
    );

    expect(result.readBy).toBe('gemini-b');
    expect(unknown.read).toHaveBeenCalledTimes(1);
    expect(waits).toEqual([2_000]);
  });

  it('gives up with the last error once the time budget is spent', async () => {
    const main = fakeReader('gemini-a', new ApiError(429));

    await expect(build(main.reader).read(image, context)).rejects.toMatchObject(
      {
        status: 429,
      },
    );
    // 2 + 4 + 8 + 16 + 20 = 50 s waited; one more 20 s wait would pass 60 s.
    expect(waits).toEqual([2_000, 4_000, 8_000, 16_000, 20_000]);
  });

  it('fails right away when no model can work', async () => {
    const bad = fakeReader('claude', new ApiError(401));

    await expect(build(bad.reader).read(image, context)).rejects.toMatchObject({
      status: 401,
    });
    expect(waits).toEqual([]);
  });
});
