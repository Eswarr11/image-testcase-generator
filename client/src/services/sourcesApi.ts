import type { AtlassianCredentials, SourceFetchResult } from '../types'

export interface SessionStatus {
  openai: boolean
  atlassian: boolean
  figma: boolean
  siteUrl?: string
  email?: string
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json() as { message?: string; error?: string }
    return data.message || data.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status} ${res.statusText})`
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function getSessionStatus(): Promise<SessionStatus> {
  const res = await fetch('/api/session/status', { credentials: 'include' })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SessionStatus>
}

export async function clearSession(): Promise<void> {
  const res = await fetch('/api/session', {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function saveSessionCredentials(payload: {
  openai?: string | null
  atlassian?: AtlassianCredentials | null
  figma?: { accessToken: string } | null
}): Promise<SessionStatus> {
  const res = await fetch('/api/session/credentials', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SessionStatus>
}

export async function fetchConfluencePage(pageUrl: string): Promise<SourceFetchResult> {
  const res = await fetch('/api/sources/confluence', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ pageUrl }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SourceFetchResult>
}

export async function fetchFigmaDesign(figmaUrl: string): Promise<SourceFetchResult> {
  const res = await fetch('/api/sources/figma', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ figmaUrl }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SourceFetchResult>
}

export async function generateTestCase(payload: {
  prompt?: string
  confluenceUrls: string[]
  figmaUrls: string[]
  images?: string[]
}): Promise<string> {
  const res = await fetch('/api/generate-test-case', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const data = await res.json() as { content: string }
  return data.content
}
