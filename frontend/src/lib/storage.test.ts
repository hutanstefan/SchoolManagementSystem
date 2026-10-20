import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenStorage } from './storage'

describe('tokenStorage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('stores, reads and clears the token', () => {
    tokenStorage.set('abc')
    expect(tokenStorage.get()).toBe('abc')
    tokenStorage.clear()
    expect(tokenStorage.get()).toBeNull()
  })

  it('keeps working when localStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => tokenStorage.set('abc')).not.toThrow()
    expect(tokenStorage.get()).toBeNull()
  })
})
