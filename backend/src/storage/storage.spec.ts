import { contentDisposition } from './storage';

describe('contentDisposition', () => {
  it('names the file, keeping Romanian letters for browsers that can', () => {
    expect(contentDisposition('attachment', 'Lecție (1).pdf')).toBe(
      `attachment; filename="Lectie (1).pdf"; filename*=UTF-8''Lec%C8%9Bie%20%281%29.pdf`,
    );
  });

  it("can't be broken out of with quotes", () => {
    expect(contentDisposition('inline', 'a"; evil=1.pdf')).toMatch(
      /^inline; filename="a_; evil=1.pdf";/,
    );
  });
});
