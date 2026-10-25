/** Biggest PDF a teacher can upload. */
export const MAX_LECTURE_BYTES = 20 * 1024 * 1024;

/**
 * Whether the bytes are a PDF: the "%PDF-" header must be in the first
 * kilobyte (the spec allows some bytes before it). The file name and the
 * browser's MIME type are not trusted.
 */
export function isPdf(data: Buffer): boolean {
  return data.subarray(0, 1024).includes('%PDF-');
}

/**
 * The uploaded file's name, readable: browsers send UTF-8 bytes that multer
 * reads as latin1 ("LecÈ›ie.pdf" for "Lecție.pdf"). Path parts and control
 * characters are dropped, and it always ends in .pdf.
 */
export function cleanFileName(original: string): string {
  let name = original;
  const decoded = Buffer.from(original, 'latin1').toString('utf8');
  if (!decoded.includes('�')) name = decoded;
  name = name
    .split(/[\\/]/)
    .pop()!
    .split('')
    .filter((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) !== 0x7f)
    .join('')
    .trim()
    .slice(0, 150);
  if (!name.toLowerCase().endsWith('.pdf')) name = `${name || 'lecture'}.pdf`;
  return name;
}
