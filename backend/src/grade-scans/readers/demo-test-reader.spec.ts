import { DemoTestReader } from './demo-test-reader';

const context = {
  className: '9A',
  subjectName: 'Mathematics',
  roster: [
    { number: 1, firstName: 'Vasile', lastName: 'Banica' },
    { number: 2, firstName: 'Ioana', lastName: 'Popescu' },
    { number: 3, firstName: 'Andrei', lastName: 'Popescu' },
  ],
};
const image = (fileName: string, data = 'photo') => ({
  data: Buffer.from(data),
  mediaType: 'image/jpeg' as const,
  fileName,
});

describe('DemoTestReader', () => {
  const reader = new DemoTestReader();

  it('takes the student from the file name when it contains one', async () => {
    expect(
      (await reader.read(image('test-banica.jpg'), context)).rosterNumber,
    ).toBe(1);
    expect(
      (await reader.read(image('popescu-andrei.png'), context)).rosterNumber,
    ).toBe(3);
  });

  it('gives the same valid result for the same photo', async () => {
    const first = await reader.read(image('IMG_1.jpg', 'abc'), context);
    const again = await reader.read(image('IMG_1.jpg', 'abc'), context);

    expect(again).toEqual(first);
    expect(first.grade).toBeGreaterThanOrEqual(4);
    expect(first.grade).toBeLessThanOrEqual(10);
    expect([1, 2, 3]).toContain(first.rosterNumber);
  });
});
