/**
 * Lightweight fetch wrapper that injects Authorization header from localStorage.
 * Acts like an interceptor for all subsequent fetch calls.
 */
let installed = false
const originalFetch = typeof window !== 'undefined' ? window.fetch : undefined

export function setupAuthFetch() {
  if (installed || !originalFetch) return
  installed = true

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers ?? {})

    const rawUrl = typeof input === 'string' ? input : input.toString()
    const isAuthEndpoint =
      rawUrl.startsWith('/api/auth/login') ||
      rawUrl.startsWith('/api/auth/register') ||
      rawUrl.startsWith('/api/auth/mock')

    const token = localStorage.getItem('iai-token')
    if (token && !isAuthEndpoint && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await originalFetch(input, { ...init, headers })

    // Only auto-logout when we *had* a token but got rejected.
    // Avoid logging out on expected 401 responses (e.g. invalid login, unauthenticated public pages).
    if (response.status === 401 && token && !isAuthEndpoint) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return response
  }
}
