import type { GoogleGenAI } from '@google/genai';
import { GeminiTestReader } from './gemini-test-reader';

const context = {
  className: '9A',
  subjectName: 'Mathematics',
  roster: [{ number: 1, firstName: 'Ioana', lastName: 'Popescu' }],
};
const image = {
  data: Buffer.from('fake-png'),
  mediaType: 'image/png' as const,
  fileName: 'popescu-ioana.png',
};

describe('GeminiTestReader', () => {
  const generateContent = jest.fn();
  const client = { models: { generateContent } } as unknown as GoogleGenAI;
  const reader = new GeminiTestReader(client, 'gemini-3.8-flash');

  beforeEach(() => generateContent.mockReset());

  it('sends the photo inline with the prompt and asks for JSON matching the schema', async () => {
    const reading = {
      studentName: 'Popescu Ioana',
      rosterNumber: 1,
      grade: 8,
      confidence: 'medium',
      note: null,
    };
    generateContent.mockResolvedValue({ text: JSON.stringify(reading) });

    await expect(reader.read(image, context)).resolves.toEqual(reading);

    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe('gemini-3.8-flash');
    const [imagePart, textPart] = request.contents[0].parts;
    expect(imagePart.inlineData).toEqual({
      mimeType: 'image/png',
      data: Buffer.from('fake-png').toString('base64'),
    });
    expect(textPart.text).toContain('1. Popescu Ioana');
    expect(request.config.responseMimeType).toBe('application/json');
    expect(request.config.responseJsonSchema.required).toEqual(
      expect.arrayContaining(['studentName', 'rosterNumber', 'grade']),
    );
    expect(JSON.stringify(request)).not.toContain('popescu-ioana');
  });

  it('rejects an answer that does not match the schema', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ studentName: 'X', grade: 'ten' }),
    });

    await expect(reader.read(image, context)).rejects.toThrow(
      'Unexpected answer from the model',
    );
  });

  it('rejects an empty answer', async () => {
    generateContent.mockResolvedValue({ text: undefined });

    await expect(reader.read(image, context)).rejects.toThrow('Empty answer');
  });
});
