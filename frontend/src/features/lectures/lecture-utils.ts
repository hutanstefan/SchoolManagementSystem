/** "02_quadratic-equations.pdf" -> "02 quadratic equations" */
export function titleFromFileName(name: string): string {
  const base = name
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}
