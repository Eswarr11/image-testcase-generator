import React, { createContext, useContext, useEffect, useState } from 'react'

interface ApiKeyContextType {
  apiKey: string | null
  setApiKey: (key: string | null) => void
  isConfigured: boolean
  clearApiKey: () => void
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined)

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('openai_api_key')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'string' && parsed.trim()) {
          setApiKeyState(parsed)
        }
      } catch {
        // If it's not JSON, it might be a plain string
        if (stored.trim()) {
          setApiKeyState(stored)
        }
      }
    }
  }, [])

  const setApiKey = (key: string | null) => {
    setApiKeyState(key)
    if (key) {
      localStorage.setItem('openai_api_key', JSON.stringify(key))
    } else {
      localStorage.removeItem('openai_api_key')
    }
  }

  const clearApiKey = () => {
    setApiKey(null)
  }

  const isConfigured = Boolean(apiKey?.trim())

  return (
    <ApiKeyContext.Provider value={{ 
      apiKey, 
      setApiKey, 
      isConfigured, 
      clearApiKey 
    }}>
      {children}
    </ApiKeyContext.Provider>
  )
}

export function useApiKey() {
  const context = useContext(ApiKeyContext)
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider')
  }
  return context
}
