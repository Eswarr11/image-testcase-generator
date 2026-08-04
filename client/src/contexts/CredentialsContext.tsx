import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AtlassianCredentials, FigmaCredentials } from '../types'
import {
  clearSession,
  getSessionStatus,
  saveSessionCredentials,
  type SessionStatus,
} from '../services/sourcesApi'

const PREFS_KEY = 'tcg_prefs_v1'
const LEGACY_CREDS_KEY = 'tcg_credentials_v1'
const LEGACY_OPENAI_KEY = 'openai_api_key'

interface Prefs {
  siteUrl: string
  email: string
}

interface CredentialsContextType {
  status: SessionStatus
  prefs: Prefs
  setPrefs: (prefs: Partial<Prefs>) => void
  refreshStatus: () => Promise<void>
  saveOpenAI: (key: string) => Promise<void>
  saveAtlassian: (creds: AtlassianCredentials) => Promise<void>
  saveFigma: (creds: FigmaCredentials) => Promise<void>
  clearOpenAI: () => Promise<void>
  clearAtlassian: () => Promise<void>
  clearFigma: () => Promise<void>
  clearAll: () => Promise<void>
  isOpenAIConfigured: boolean
  isAtlassianConfigured: boolean
  isFigmaConfigured: boolean
  /** @deprecated */
  isConfigured: boolean
  /** @deprecated secrets no longer kept in browser */
  apiKey: string | null
  openaiKey: string | null
  credentials: {
    openai: string | null
    atlassian: AtlassianCredentials | null
    figma: FigmaCredentials | null
  }
  setApiKey: (key: string | null) => void
  setOpenAIKey: (key: string | null) => void
  setAtlassian: (value: AtlassianCredentials | null) => void
  setFigma: (value: FigmaCredentials | null) => void
  clearApiKey: () => void
}

const emptyStatus = (): SessionStatus => ({
  openai: false,
  atlassian: false,
  figma: false,
})

const CredentialsContext = createContext<CredentialsContextType | undefined>(undefined)

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Prefs>
      return {
        siteUrl: typeof parsed.siteUrl === 'string' ? parsed.siteUrl : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
      }
    }
  } catch {
    // ignore
  }

  // migrate non-secret fields from old credential blob
  try {
    const legacy = localStorage.getItem(LEGACY_CREDS_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as {
        atlassian?: { siteUrl?: string; email?: string }
      }
      return {
        siteUrl: parsed.atlassian?.siteUrl || '',
        email: parsed.atlassian?.email || '',
      }
    }
  } catch {
    // ignore
  }

  return { siteUrl: '', email: '' }
}

function wipeLegacySecrets(): void {
  localStorage.removeItem(LEGACY_CREDS_KEY)
  localStorage.removeItem(LEGACY_OPENAI_KEY)
}

export function CredentialsProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(emptyStatus)
  const [prefs, setPrefsState] = useState<Prefs>({ siteUrl: '', email: '' })

  const setPrefs = useCallback((partial: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...partial }
      localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getSessionStatus()
      setStatus(next)
      if (next.siteUrl || next.email) {
        setPrefs({
          ...(next.siteUrl ? { siteUrl: next.siteUrl } : {}),
          ...(next.email ? { email: next.email } : {}),
        })
      }
    } catch {
      setStatus(emptyStatus())
    }
  }, [setPrefs])

  useEffect(() => {
    setPrefsState(loadPrefs())
    wipeLegacySecrets()
    void refreshStatus()
  }, [refreshStatus])

  const saveOpenAI = useCallback(async (key: string) => {
    const next = await saveSessionCredentials({ openai: key })
    setStatus(next)
  }, [])

  const saveAtlassian = useCallback(async (creds: AtlassianCredentials) => {
    const next = await saveSessionCredentials({ atlassian: creds })
    setStatus(next)
    setPrefs({ siteUrl: creds.siteUrl, email: creds.email })
  }, [setPrefs])

  const saveFigma = useCallback(async (creds: FigmaCredentials) => {
    const next = await saveSessionCredentials({ figma: creds })
    setStatus(next)
  }, [])

  const clearOpenAI = useCallback(async () => {
    const next = await saveSessionCredentials({ openai: null })
    setStatus(next)
  }, [])

  const clearAtlassian = useCallback(async () => {
    const next = await saveSessionCredentials({ atlassian: null })
    setStatus(next)
  }, [])

  const clearFigma = useCallback(async () => {
    const next = await saveSessionCredentials({ figma: null })
    setStatus(next)
  }, [])

  const clearAll = useCallback(async () => {
    await clearSession()
    setStatus(emptyStatus())
  }, [])

  const isOpenAIConfigured = status.openai
  const isAtlassianConfigured = status.atlassian
  const isFigmaConfigured = status.figma

  // Deprecated sync setters — forward to async session saves without awaiting
  const setOpenAIKey = (key: string | null) => {
    if (key) void saveOpenAI(key)
    else void clearOpenAI()
  }

  return (
    <CredentialsContext.Provider
      value={{
        status,
        prefs,
        setPrefs,
        refreshStatus,
        saveOpenAI,
        saveAtlassian,
        saveFigma,
        clearOpenAI,
        clearAtlassian,
        clearFigma,
        clearAll,
        isOpenAIConfigured,
        isAtlassianConfigured,
        isFigmaConfigured,
        isConfigured: isOpenAIConfigured,
        apiKey: null,
        openaiKey: null,
        credentials: {
          openai: null,
          atlassian: isAtlassianConfigured
            ? { siteUrl: prefs.siteUrl, email: prefs.email, apiToken: '' }
            : null,
          figma: isFigmaConfigured ? { accessToken: '' } : null,
        },
        setApiKey: setOpenAIKey,
        setOpenAIKey,
        setAtlassian: (v) => {
          if (v) void saveAtlassian(v)
          else void clearAtlassian()
        },
        setFigma: (v) => {
          if (v) void saveFigma(v)
          else void clearFigma()
        },
        clearApiKey: () => {
          void clearOpenAI()
        },
      }}
    >
      {children}
    </CredentialsContext.Provider>
  )
}

export function useCredentials() {
  const context = useContext(CredentialsContext)
  if (context === undefined) {
    throw new Error('useCredentials must be used within a CredentialsProvider')
  }
  return context
}

/** @deprecated Prefer useCredentials */
export function useApiKey() {
  return useCredentials()
}
