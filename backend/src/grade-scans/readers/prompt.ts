import { z } from 'zod';
import type { ReadContext, TestReading } from './test-reader';

/**
 * The prompt and the answer format, shared by every AI provider, so they all
 * read tests the same way and their answers are checked the same way.
 */

/** The answer the model must give (sent to the provider as a JSON schema). */
export const readingSchema = z.object({
  studentName: z.string().nullable(),
  rosterNumber: z.number().int().nullable(),
  grade: z.number().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
  note: z.string().nullable(),
});

export const SYSTEM_PROMPT =
  'You read photos of graded paper tests from a Romanian school for the teacher who graded them. ' +
  'You report only what is written on the paper and never guess a grade or a student.';

export function buildPrompt(context: ReadContext): string {
  const roster = context.roster
    .map((s) => `${s.number}. ${s.lastName} ${s.firstName}`)
    .join('\n');

  return `This is one graded test from class ${context.className}, subject ${context.subjectName}.

Students of the class (number. last name, first name):
${roster}

Report:
- studentName: the student's name exactly as written on the test, or null if no name is visible.
- rosterNumber: the number of the student from the list above who wrote this test, or null if you can't tell with reasonable certainty. Names may be handwritten, abbreviated, written first name first, or without diacritics.
- grade: the final grade the teacher gave (usually written in red, circled, or after "Nota" / "Notă" / "Calificativ"), as a number from 1 to 10, keeping decimals if written (e.g. 9.50). If a grade is crossed out and another one is written next to it, report the one that is not crossed out. Ignore points for individual exercises unless the final grade is missing; null if no final grade is visible.
- confidence: "high", "medium" or "low": how sure you are about both the student and the grade.
- note: a short note in English if something is unusual (grade crossed out and rewritten, illegible, two names, not a test at all), otherwise null.`;
}

/** Validates a JSON answer from a provider that has no typed SDK helper. */
export function parseReading(text: string | undefined): TestReading {
  if (!text) throw new Error('Empty answer from the model');
  const result = readingSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error(
      `Unexpected answer from the model: ${result.error.message}`,
    );
  }
  return result.data;
}
