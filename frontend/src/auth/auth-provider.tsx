import { useQueryClient } from '@tanstack/react-query'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { api, AUTH_EXPIRED_EVENT, unwrap } from '@/api/client'
import { tokenStorage } from '@/lib/storage'
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './auth-context'
import type { AuthUser } from './roles'

/**
 * Holds the logged-in user. On startup it restores the session from the stored
 * token (GET /auth/me); when the API rejects the token it logs out everywhere.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(null)
  const loggingOut = useRef(false)
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? 'loading' : 'anonymous',
  )

  const endSession = useCallback(() => {
    tokenStorage.clear()
    queryClient.clear()
    setUser(null)
    setStatus('anonymous')
  }, [queryClient])

  // Restore the session after a page refresh.
  useEffect(() => {
    if (!tokenStorage.get()) return
    let cancelled = false
    unwrap(api.GET('/api/auth/me'))
      .then((me) => {
        if (cancelled) return
        setUser(me)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!cancelled) endSession()
      })
    return () => {
      cancelled = true
    }
  }, [endSession])

  // The token expired or was revoked (logout on another device, password reset).
  useEffect(() => {
    const onExpired = () => {
      // Our own logout also ends the session (and closes the live connection).
      if (loggingOut.current) return
      endSession()
      toast.error('Your session has ended. Please log in again.')
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [endSession])

  const login = useCallback(async (email: string, password: string) => {
    const result = await unwrap(
      api.POST('/api/auth/login', { body: { email, password } }),
    )
    tokenStorage.set(result.accessToken)
    setUser(result.user)
    setStatus('authenticated')
    return result.user
  }, [])

  const logout = useCallback(async () => {
    loggingOut.current = true
    try {
      // Revokes the token on the server too, not just in this browser.
      await unwrap(api.POST('/api/auth/logout'))
    } catch {
      // Already invalid or the server is down: still log out locally.
    } finally {
      endSession()
      loggingOut.current = false
    }
  }, [endSession])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
