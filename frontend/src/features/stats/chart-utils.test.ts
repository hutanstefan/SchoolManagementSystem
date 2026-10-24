import { describe, expect, it } from 'vitest'
import { countTicks } from './chart-utils'

describe('countTicks', () => {
  it('uses round steps that reach past the maximum', () => {
    expect(countTicks(361)).toEqual([0, 100, 200, 300, 400])
    expect(countTicks(283)).toEqual([0, 100, 200, 300])
    expect(countTicks(9)).toEqual([0, 5, 10])
    expect(countTicks(3)).toEqual([0, 1, 2, 3])
  })

  it('handles empty data', () => {
    expect(countTicks(0)).toEqual([0, 1])
  })
})
