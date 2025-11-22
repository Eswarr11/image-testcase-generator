import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useToast } from './ToastContext'

// Types
interface User {
  id: number
  email: string
  hasApiKey: boolean
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  updateApiKey: (apiKey: string) => Promise<boolean>
  getApiKey: () => Promise<string | null>
  refreshUser: () => Promise<void>
}

interface LoginResponse {
  success: boolean
  message: string
  user?: User
}

interface ApiKeyResponse {
  success: boolean
  hasApiKey: boolean
  apiKey?: string
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// API base URL
const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : ''

// Provider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { showToast } = useToast()

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.user) {
          setUser(data.user)
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data: LoginResponse = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
        showToast('Login successful!', 'success')
        return true
      } else {
        showToast(data.message || 'Login failed', 'error')
        return false
      }
    } catch (error) {
      console.error('Login error:', error)
      showToast('Login failed. Please check your connection.', 'error')
      return false
    }
  }

  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      const data: LoginResponse = await response.json()

      if (data.success && data.user) {
        setUser(data.user)
        showToast('Account created successfully!', 'success')
        return true
      } else {
        showToast(data.message || 'Registration failed', 'error')
        return false
      }
    } catch (error) {
      console.error('Registration error:', error)
      showToast('Registration failed. Please check your connection.', 'error')
      return false
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })

      setUser(null)
      showToast('Logged out successfully', 'info')
    } catch (error) {
      console.error('Logout error:', error)
      // Clear user state even if logout request fails
      setUser(null)
    }
  }

  const updateApiKey = async (apiKey: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/api-key`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ apiKey }),
      })

      const data = await response.json()

      if (data.success) {
        // Update user state to reflect API key presence
        if (user) {
          setUser({ ...user, hasApiKey: true })
        }
        showToast('API key updated successfully!', 'success')
        return true
      } else {
        showToast(data.message || 'Failed to update API key', 'error')
        return false
      }
    } catch (error) {
      console.error('API key update error:', error)
      showToast('Failed to update API key. Please check your connection.', 'error')
      return false
    }
  }

  const getApiKey = async (): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/api-key`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data: ApiKeyResponse = await response.json()
        return data.apiKey || null
      }
      
      return null
    } catch (error) {
      console.error('Get API key error:', error)
      return null
    }
  }

  const refreshUser = async (): Promise<void> => {
    await checkAuthStatus()
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
    updateApiKey,
    getApiKey,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
