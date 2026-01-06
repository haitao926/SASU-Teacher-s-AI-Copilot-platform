import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

interface User {
  id: string
  username: string
  name: string
  role: string
  roles?: string[]
}

// Helper for safe JSON parse
function safeParse(key: string) {
  const item = localStorage.getItem(key)
  if (!item) return null
  try {
    return JSON.parse(item)
  } catch (e) {
    console.warn(`[Auth] Corrupted data in ${key}, clearing...`)
    localStorage.removeItem(key)
    return null
  }
}

// Global state
const token = ref<string | null>(localStorage.getItem('iai-token'))
const user = ref<User | null>(safeParse('iai-user'))
const loadingProfile = ref(false)
let unauthorizedListenerBound = false
let initCheckDone = false

export function useAuth() {
  const router = useRouter()

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'ADMIN')

  // Helper to sync state to localStorage
  function setAuth(newToken: string | null, newUser: User | null) {
    token.value = newToken
    user.value = newUser
    
    if (newToken) {
      localStorage.setItem('iai-token', newToken)
    } else {
      localStorage.removeItem('iai-token')
    }

    if (newUser) {
      localStorage.setItem('iai-user', JSON.stringify(newUser))
    } else {
      localStorage.removeItem('iai-user')
    }
  }

  const fetchProfile = async () => {
    if (!token.value) return null
    loadingProfile.value = true
    try {
      console.log('[Auth] Fetching profile...')
      const res = await fetch('/api/whoami', {
        headers: {
          'Authorization': `Bearer ${token.value}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        console.log('[Auth] Profile verified:', data.user.username)
        // Update user but keep token
        setAuth(token.value, data.user)
      } else if (res.status === 401) {
        console.warn('[Auth] Token invalid (401), logging out')
        logout(false)
      }
    } catch (error) {
      console.error('[Auth] Network error', error)
    } finally {
      loadingProfile.value = false
    }
  }

  async function login(username: string, password: string) {
    try {
      console.log('[Auth] Logging in...')
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Login failed')
      }

      const data = await res.json()
      console.log('[Auth] Login success')
      setAuth(data.token, data.user ?? null)
      
      return true
    } catch (e: any) {
      console.error('[Auth] Login error:', e)
      throw e
    }
  }

  function logout(redirect = true) {
    console.log('[Auth] Logging out')
    setAuth(null, null)
    if (redirect) {
      router.push('/login')
    }
  }

  // Initialize once
  if (!initCheckDone && typeof window !== 'undefined') {
    initCheckDone = true
    if (token.value) {
      // Verify token on page load
      fetchProfile()
    }
    
    if (!unauthorizedListenerBound) {
      window.addEventListener('auth:unauthorized', () => logout(true))
      unauthorizedListenerBound = true
    }
  }

  return {
    user,
    token,
    loadingProfile,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchProfile
  }
}
