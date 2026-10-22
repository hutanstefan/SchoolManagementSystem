import type { Confidence } from '../../grades/matching';

export type { Confidence };

/** Image formats every AI provider accepts. */
export type ImageMediaType =
  'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface TestImage {
  data: Buffer;
  mediaType: ImageMediaType;
  /** The uploaded file name. Not shown to the AI, so it can't bias the reading. */
  fileName: string;
}

/** A student of the class, numbered for the reader (the model never sees ids). */
export interface RosterEntry {
  number: number;
  firstName: string;
  lastName: string;
}

export interface ReadContext {
  className: string;
  subjectName: string;
  roster: RosterEntry[];
}

/** What a reader found on one photo, before the service checks it. */
export interface TestReading {
  /** The name as written on the test. */
  studentName: string | null;
  /** The matching student's number in the roster. */
  rosterNumber: number | null;
  /** The final grade as written, possibly with decimals (e.g. 9.5). */
  grade: number | null;
  confidence: Confidence;
  note: string | null;
  /** The model that actually read it, when a fallback model was used. */
  readBy?: string;
}

/** Reads one photo of a graded test. */
export interface TestReader {
  /** "ai" reads the photo with Claude; "demo" simulates a result. */
  readonly mode: 'ai' | 'demo';
  readonly model: string | null;
  read(image: TestImage, context: ReadContext): Promise<TestReading>;
}

/** Injection token for the TestReader in use. */
export const TEST_READER = Symbol('TEST_READER');
