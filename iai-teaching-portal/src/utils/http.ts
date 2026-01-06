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
    const token = localStorage.getItem('iai-token')
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await originalFetch(input, { ...init, headers })

    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }

    return response
  }
}
