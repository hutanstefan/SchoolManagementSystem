import type { GoogleGenAI } from '@google/genai';
import { buildPrompt, parseReading, SYSTEM_PROMPT } from './prompt';
import type {
  ReadContext,
  TestImage,
  TestReader,
  TestReading,
} from './test-reader';

/**
 * The answer format as plain JSON Schema, limited to the keywords Gemini
 * supports. The answer is still validated with readingSchema (zod).
 */
const responseJsonSchema = {
  type: 'object',
  properties: {
    studentName: { type: ['string', 'null'] },
    rosterNumber: { type: ['integer', 'null'], minimum: 1 },
    grade: { type: ['number', 'null'] },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: { type: ['string', 'null'] },
  },
  required: ['studentName', 'rosterNumber', 'grade', 'confidence', 'note'],
  additionalProperties: false,
};

/**
 * Reads a photo of a test with Google Gemini (vision + JSON schema output).
 * Gemini has a free tier, so the feature can be used without paying.
 */
export class GeminiTestReader implements TestReader {
  readonly mode = 'ai' as const;

  constructor(
    private readonly client: GoogleGenAI,
    readonly model: string,
  ) {}

  async read(image: TestImage, context: ReadContext): Promise<TestReading> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: image.mediaType,
                data: image.data.toString('base64'),
              },
            },
            { text: buildPrompt(context) },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema,
        temperature: 0,
      },
    });
    return parseReading(response.text);
  }
}
