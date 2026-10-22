import type Anthropic from '@anthropic-ai/sdk';
import { ClaudeTestReader } from './claude-test-reader';
import { buildPrompt } from './prompt';

const context = {
  className: '9A',
  subjectName: 'Mathematics',
  roster: [
    { number: 1, firstName: 'Ioana', lastName: 'Popescu' },
    { number: 2, firstName: 'Andrei', lastName: 'Georgescu' },
  ],
};
const image = {
  data: Buffer.from('fake-jpeg'),
  mediaType: 'image/jpeg' as const,
  fileName: 'popescu-ioana.jpg',
};

describe('ClaudeTestReader', () => {
  const parse = jest.fn();
  const client = { messages: { parse } } as unknown as Anthropic;
  const reader = new ClaudeTestReader(client, 'claude-haiku-5-5');

  beforeEach(() => parse.mockReset());

  it('sends the photo and the numbered class list, and asks for structured output', async () => {
    const reading = {
      studentName: 'Georgescu Andrei',
      rosterNumber: 2,
      grade: 9.5,
      confidence: 'high',
      note: null,
    };
    parse.mockResolvedValue({
      parsed_output: reading,
      stop_reason: 'end_turn',
    });

    await expect(reader.read(image, context)).resolves.toEqual(reading);

    const request = parse.mock.calls[0][0];
    expect(request.model).toBe('claude-haiku-5-5');
    expect(request.output_config.format.type).toBe('json_schema');
    const [imageBlock, textBlock] = request.messages[0].content;
    expect(imageBlock.source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: Buffer.from('fake-jpeg').toString('base64'),
    });
    expect(textBlock.text).toContain('class 9A, subject Mathematics');
    expect(textBlock.text).toContain('2. Georgescu Andrei');
    // The file name could bias the reading, so the model never sees it.
    expect(JSON.stringify(request)).not.toContain('popescu-ioana');
  });

  it('fails when the model gives no structured answer (e.g. a refusal)', async () => {
    parse.mockResolvedValue({ parsed_output: null, stop_reason: 'refusal' });

    await expect(reader.read(image, context)).rejects.toThrow('refusal');
  });

  it('never puts student ids in the prompt, only numbers and names', () => {
    const prompt = buildPrompt(context);
    expect(prompt).toContain('1. Popescu Ioana');
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});
