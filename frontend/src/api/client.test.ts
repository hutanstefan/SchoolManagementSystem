import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage, unwrap } from './client'

const response = (status: number) => new Response(null, { status })

describe('unwrap', () => {
  it('returns the data of a successful response', async () => {
    await expect(
      unwrap(Promise.resolve({ data: { id: 1 }, response: response(200) })),
    ).resolves.toEqual({ id: 1 })
  })

  it('turns the API error format into an ApiError', async () => {
    const error = await unwrap(
      Promise.resolve({
        error: { statusCode: 404, message: 'Student not found' },
        response: response(404),
      }),
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, message: 'Student not found' })
  })

  it('joins validation messages and keeps them as details', async () => {
    const error = (await unwrap(
      Promise.resolve({
        error: { message: ['email must be an email', 'name is too long'] },
        response: response(400),
      }),
    ).catch((e: unknown) => e)) as ApiError

    expect(error.message).toBe('email must be an email. name is too long')
    expect(error.details).toHaveLength(2)
  })

  it('explains when the server cannot be reached', async () => {
    const error = await unwrap(
      Promise.reject(new TypeError('fetch failed')),
    ).catch((e: unknown) => e)
    expect(errorMessage(error)).toBe(
      'Cannot reach the server. Is the API running?',
    )
  })
})
