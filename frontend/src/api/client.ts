import createClient, { type Middleware } from 'openapi-fetch'
import { tokenStorage } from '@/lib/storage'
import type { components, paths } from './schema'

/** Request and response types generated from the API's OpenAPI document. */
export type Schemas = components['schemas']

/** Fired when the API rejects our token, so the app can log out (see AuthProvider). */
export const AUTH_EXPIRED_EVENT = 'sms:auth-expired'

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = tokenStorage.get()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ request, response }) {
    const isLogin = new URL(request.url).pathname === '/api/auth/login'
    if (response.status === 401 && !isLogin && tokenStorage.get()) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    return response
  },
}

/**
 * Typed API client: paths, parameters and bodies are checked against the
 * backend's OpenAPI document (`npm run api:types` regenerates it).
 */
export const api = createClient<paths>({
  baseUrl: window.location.origin,
})
api.use(authMiddleware)

/** An error response from the API, in its standard format. */
export class ApiError extends Error {
  readonly status: number
  /** Individual validation messages, when the API returned a list. */
  readonly details: string[]

  constructor(status: number, message: string, details: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

function toApiError(status: number, body: unknown): ApiError {
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: unknown }).message
      : undefined

  if (Array.isArray(message)) {
    const details = message.map(String)
    return new ApiError(status, details.join('. '), details)
  }
  if (typeof message === 'string') return new ApiError(status, message)
  return new ApiError(status, 'Something went wrong, please try again')
}

/** Resolves to the response data, or throws an ApiError. */
export async function unwrap<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response }
  try {
    result = await request
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the API running?')
  }
  if (!result.response.ok) {
    throw toApiError(result.response.status, result.error)
  }
  return result.data as T
}

/** A readable message for any error (for toasts and inline alerts). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong, please try again'
}
