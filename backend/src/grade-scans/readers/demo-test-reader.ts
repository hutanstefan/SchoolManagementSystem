import { createHash } from 'node:crypto';
import { nameTokens } from '../matching';
import type {
  Confidence,
  ReadContext,
  TestImage,
  TestReader,
  TestReading,
} from './test-reader';

const CONFIDENCES: Confidence[] = ['high', 'high', 'medium', 'low'];

/**
 * Used when no ANTHROPIC_API_KEY is configured, so the whole flow can be tried
 * without an API key. The student comes from the file name when it contains a
 * student's name (like the samples in docs/sample-tests), otherwise from the
 * image bytes; the grade comes from the image bytes. The same photo always
 * gives the same result.
 */
export class DemoTestReader implements TestReader {
  readonly mode = 'demo' as const;
  readonly model = null;

  read(image: TestImage, context: ReadContext): Promise<TestReading> {
    const hash = createHash('sha256').update(image.data).digest();
    const fileTokens = nameTokens(image.fileName);
    const named = context.roster.filter((s) =>
      nameTokens(s.lastName).every((token) => fileTokens.includes(token)),
    );
    const fromFileName =
      named.find((s) =>
        nameTokens(s.firstName).some((token) => fileTokens.includes(token)),
      ) ?? named[0];
    const student =
      fromFileName ??
      (context.roster.length > 0
        ? context.roster[hash.readUInt16BE(0) % context.roster.length]
        : undefined);

    return Promise.resolve({
      studentName: student ? `${student.lastName} ${student.firstName}` : null,
      rosterNumber: student?.number ?? null,
      grade: 4 + (hash[2] % 7), // 4..10
      confidence: CONFIDENCES[hash[3] % CONFIDENCES.length],
      note: null,
    });
  }
}
