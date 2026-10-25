/** Searching lectures without caring about case or diacritics. */

/** Letters with diacritics and what they become in a search (Romanian first). */
export const FOLD_FROM = 'ăâîșşțţĂÂÎȘŞȚŢáàäéèëíìïóòöúùüçñÁÀÄÉÈËÍÌÏÓÒÖÚÙÜÇÑ';
export const FOLD_TO = 'aaissttaaissttaaaeeeiiiooouuucnaaaeeeiiiooouuucn';

/** "Creangă" -> "creanga": lower case, without diacritics. */
export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}
