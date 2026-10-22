import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { buildPrompt, readingSchema, SYSTEM_PROMPT } from './prompt';
import type {
  ReadContext,
  TestImage,
  TestReader,
  TestReading,
} from './test-reader';

/** Reads a photo of a test with Claude (vision + structured output). */
export class ClaudeTestReader implements TestReader {
  readonly mode = 'ai' as const;

  constructor(
    private readonly client: Anthropic,
    readonly model: string,
  ) {}

  async read(image: TestImage, context: ReadContext): Promise<TestReading> {
    const message = await this.client.messages.parse({
      model: this.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.mediaType,
                data: image.data.toString('base64'),
              },
            },
            { type: 'text', text: buildPrompt(context) },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(readingSchema) },
    });

    if (!message.parsed_output) {
      throw new Error(
        `No structured answer from the model (stop reason: ${message.stop_reason})`,
      );
    }
    return message.parsed_output;
  }
}
