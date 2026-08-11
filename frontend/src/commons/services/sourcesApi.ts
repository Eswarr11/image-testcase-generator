import type {
  AtlassianCredentials,
  GenerateResponse,
  SourceFetchResult,
} from '@/commons/types'

export interface SessionStatus {
  openai: boolean
  atlassian: boolean
  figma: boolean
  siteUrl?: string
  email?: string
}

async function parseError(res: Response): Promise<string> {
  if (res.status === 413) {
    return (
      'Upload too large for hosting limits (max ~4.5MB request). ' +
      'Try fewer images, or wait while we optimize — if this persists, use smaller screenshots.'
    )
  }
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

export async function fetchFigmaDesign(
  figmaUrl: string,
  selectedFrameIds?: string[]
): Promise<SourceFetchResult> {
  const res = await fetch('/api/sources/figma', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({
      figmaUrl,
      ...(selectedFrameIds && selectedFrameIds.length > 0 ? { selectedFrameIds } : {}),
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json() as Promise<SourceFetchResult>
}

export interface GeneratePayload {
  prompt?: string
  confluenceUrls: string[]
  figmaUrls: string[]
  images?: string[]
  expectedCount?: number
  figmaFrameSelections?: Record<string, string[]>
  uncoveredRequirementIds?: string[]
  existingRequirements?: Array<{ id: string; text: string }>
}

export interface GenerateStreamCallbacks {
  onToolCall?: (name: string, input: Record<string, unknown>) => void
  onToolResult?: (name: string, summary: string) => void
  onGenerating?: (attempt: number) => void
  onTokenBatch?: (text: string) => void
  onParse?: (attempt: number) => void
  onDone?: (result: GenerateResponse) => void
  onError?: (status: number, message: string) => void
}

export async function generateTestCaseStream(
  payload: GeneratePayload,
  callbacks: GenerateStreamCallbacks
): Promise<void> {
  const res = await fetch('/api/generate-test-case', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(payload),
  })

  // Non-SSE errors (validation failures before SSE headers were set)
  if (!res.ok) {
    callbacks.onError?.(res.status, await parseError(res))
    return
  }

  if (!res.body) {
    callbacks.onError?.(502, 'No response body from server')
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by double newline
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const eventMatch = part.match(/^event: (\w+)\ndata: (.+)$/s)
      if (!eventMatch) continue
      const eventType = eventMatch[1]
      const dataStr = eventMatch[2]
      if (!eventType || !dataStr) continue
      let data: Record<string, unknown>
      try {
        data = JSON.parse(dataStr) as Record<string, unknown>
      } catch {
        continue
      }

      if (eventType === 'tool_call') {
        callbacks.onToolCall?.(data['name'] as string, data['input'] as Record<string, unknown>)
      } else if (eventType === 'tool_result') {
        callbacks.onToolResult?.(data['name'] as string, data['summary'] as string)
      } else if (eventType === 'generating') {
        callbacks.onGenerating?.(data['attempt'] as number)
      } else if (eventType === 'token_batch') {
        callbacks.onTokenBatch?.(data['text'] as string)
      } else if (eventType === 'parse') {
        callbacks.onParse?.(data['attempt'] as number)
      } else if (eventType === 'done') {
        callbacks.onDone?.(data as unknown as GenerateResponse)
      } else if (eventType === 'error') {
        callbacks.onError?.(data['status'] as number, data['message'] as string)
      }
    }
  }
}
