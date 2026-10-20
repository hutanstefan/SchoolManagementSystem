/**
 * localStorage wrapper. Access can throw (private mode, blocked storage),
 * so every call is guarded and the app keeps working without it.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // Storage unavailable: the value just isn't remembered.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Nothing to remove.
    }
  },
}

const TOKEN_KEY = 'sms.accessToken'

/**
 * The JWT is kept in localStorage so a page refresh doesn't log the user out.
 * Trade-off (see README): any script running on the page could read it. The risk
 * is limited because tokens expire after an hour and logout revokes them on the server.
 */
export const tokenStorage = {
  get: () => storage.get(TOKEN_KEY),
  set: (token: string) => storage.set(TOKEN_KEY, token),
  clear: () => storage.remove(TOKEN_KEY),
}
