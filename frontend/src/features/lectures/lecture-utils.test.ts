import { describe, expect, it } from 'vitest'
import { titleFromFileName } from './lecture-utils'

describe('titleFromFileName', () => {
  it('turns a file name into a readable title', () => {
    expect(titleFromFileName('quadratic-equations_summary.PDF')).toBe(
      'Quadratic equations summary',
    )
    expect(titleFromFileName('Lecție 3.pdf')).toBe('Lecție 3')
  })
})
