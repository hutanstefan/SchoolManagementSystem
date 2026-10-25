/**
 * Small, dependency-free PDF writer for the demo lectures of the seed:
 * A4 pages with a coloured header, headings, paragraphs and lists, in the
 * standard Helvetica fonts (every PDF reader has them).
 */

export interface LectureSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Numbered list. */
  steps?: string[];
}

export interface LecturePdf {
  title: string;
  /** e.g. "Mathematics · Mihai Ionescu · 2026–2027" */
  subtitle: string;
  /** Header colour, 0-255. */
  color: [number, number, number];
  sections: LectureSection[];
}

// Helvetica widths (1/1000 em) for ASCII 32..126, from the font's AFM file.
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
  278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
  833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
  500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

/** PDF base fonts only know Latin-1-ish text: "ț" -> "t", "–" -> "-". */
function plain(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/·/g, '-')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

function textWidth(text: string, size: number, bold: boolean): number {
  let units = 0;
  for (const ch of text) units += WIDTHS[ch.charCodeAt(0) - 32] ?? 556;
  return (units / 1000) * size * (bold ? 1.06 : 1);
}

function wrap(
  text: string,
  size: number,
  width: number,
  bold = false,
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of plain(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, size, bold) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const escape = (text: string) => text.replace(/([\\()])/g, '\\$1');
const rgb = ([r, g, b]: [number, number, number]) =>
  `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;
const TEXT_W = PAGE_W - 2 * MARGIN;
const DARK: [number, number, number] = [44, 44, 42];
const MUTED: [number, number, number] = [110, 110, 105];

export function makeLecturePdf(doc: LecturePdf): Buffer {
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = 0;

  const text = (
    x: number,
    at: number,
    value: string,
    size: number,
    bold = false,
    color = DARK,
  ) =>
    ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${x.toFixed(1)} ${at.toFixed(1)} Td (${escape(value)}) Tj ET`,
    );

  const newPage = (first: boolean) => {
    ops = [];
    pages.push(ops);
    if (first) {
      ops.push(`${rgb(doc.color)} rg 0 ${PAGE_H - 132} ${PAGE_W} 132 re f`);
      let ty = PAGE_H - 64;
      for (const line of wrap(doc.title, 24, TEXT_W, true)) {
        text(MARGIN, ty, line, 24, true, [255, 255, 255]);
        ty -= 30;
      }
      text(
        MARGIN,
        PAGE_H - 110,
        plain(doc.subtitle),
        11,
        false,
        [255, 255, 255],
      );
      y = PAGE_H - 170;
    } else {
      ops.push(`${rgb(doc.color)} rg 0 ${PAGE_H - 8} ${PAGE_W} 8 re f`);
      y = PAGE_H - MARGIN;
    }
  };
  const need = (height: number) => {
    if (y - height < MARGIN + 30) newPage(false);
  };

  newPage(true);
  for (const section of doc.sections) {
    need(60);
    text(MARGIN, y, plain(section.heading), 15, true, doc.color);
    y -= 8;
    ops.push(
      `${rgb(doc.color)} RG 1 w ${MARGIN} ${y.toFixed(1)} m ${MARGIN + 40} ${y.toFixed(1)} l S`,
    );
    y -= 20;
    for (const paragraph of section.paragraphs ?? []) {
      for (const line of wrap(paragraph, 11, TEXT_W)) {
        need(15);
        text(MARGIN, y, line, 11);
        y -= 15;
      }
      y -= 6;
    }
    const items = [
      ...(section.bullets ?? []).map((item) => ({ mark: '-', item })),
      ...(section.steps ?? []).map((item, i) => ({ mark: `${i + 1}.`, item })),
    ];
    for (const { mark, item } of items) {
      const lines = wrap(item, 11, TEXT_W - 22);
      need(15 * lines.length);
      text(MARGIN + 4, y, mark, 11, true, doc.color);
      for (const line of lines) {
        text(MARGIN + 22, y, line, 11);
        y -= 15;
      }
      y -= 4;
    }
    y -= 10;
  }

  pages.forEach((page, i) => {
    page.push(
      `${rgb([225, 224, 218])} RG 0.5 w ${MARGIN} 44 m ${PAGE_W - MARGIN} 44 l S`,
    );
    const footer = `School Management - ${plain(doc.title)}`;
    const shown = footer.length > 80 ? `${footer.slice(0, 77)}...` : footer;
    const sizeOf = (t: string) => textWidth(t, 8, false);
    const pageLabel = `Page ${i + 1} of ${pages.length}`;
    page.push(
      `BT /F1 8 Tf ${rgb(MUTED)} rg ${MARGIN} 30 Td (${escape(shown)}) Tj ET`,
      `BT /F1 8 Tf ${rgb(MUTED)} rg ${(PAGE_W - MARGIN - sizeOf(pageLabel)).toFixed(1)} 30 Td (${escape(pageLabel)}) Tj ET`,
    );
  });

  // Objects: 1 catalog, 2 pages, 3-4 fonts, 5 info, then a page + content per page.
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 6 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[5] = `<< /Title (${escape(plain(doc.title))}) /Producer (School Management seed) >>`;
  pages.forEach((page, i) => {
    const content = page.join('\n');
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] =
      `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;
  });

  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, 'latin1');
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) {
    out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
