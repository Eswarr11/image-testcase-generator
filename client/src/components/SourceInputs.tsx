import { useState } from 'react'
import { BookOpen, PenTool, Link2, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react'
import type { SourceFetchResult } from '../types'

const MAX_LINKS = 10

interface LinkRowState {
  preview: SourceFetchResult | null
  error: string | null
  loading: boolean
}

interface SourceInputsProps {
  confluenceUrls: string[]
  figmaUrls: string[]
  onConfluenceUrlsChange: (urls: string[]) => void
  onFigmaUrlsChange: (urls: string[]) => void
  onPreviewConfluence: (url: string) => Promise<SourceFetchResult>
  onPreviewFigma: (url: string) => Promise<SourceFetchResult>
  disabled?: boolean
}

function emptyRow(): LinkRowState {
  return { preview: null, error: null, loading: false }
}

export default function SourceInputs({
  confluenceUrls,
  figmaUrls,
  onConfluenceUrlsChange,
  onFigmaUrlsChange,
  onPreviewConfluence,
  onPreviewFigma,
  disabled,
}: SourceInputsProps) {
  const [confluenceRows, setConfluenceRows] = useState<LinkRowState[]>(() =>
    confluenceUrls.map(() => emptyRow())
  )
  const [figmaRows, setFigmaRows] = useState<LinkRowState[]>(() =>
    figmaUrls.map(() => emptyRow())
  )

  const syncConfluence = (urls: string[]) => {
    onConfluenceUrlsChange(urls)
    setConfluenceRows((prev) => urls.map((_, i) => prev[i] || emptyRow()))
  }

  const syncFigma = (urls: string[]) => {
    onFigmaUrlsChange(urls)
    setFigmaRows((prev) => urls.map((_, i) => prev[i] || emptyRow()))
  }

  const updateConfluenceUrl = (index: number, value: string) => {
    const next = [...confluenceUrls]
    next[index] = value
    onConfluenceUrlsChange(next)
    setConfluenceRows((prev) => {
      const rows = [...prev]
      rows[index] = emptyRow()
      return rows
    })
  }

  const updateFigmaUrl = (index: number, value: string) => {
    const next = [...figmaUrls]
    next[index] = value
    onFigmaUrlsChange(next)
    setFigmaRows((prev) => {
      const rows = [...prev]
      rows[index] = emptyRow()
      return rows
    })
  }

  const previewOneConfluence = async (index: number) => {
    const url = confluenceUrls[index]?.trim()
    if (!url) return
    setConfluenceRows((prev) => {
      const rows = [...prev]
      rows[index] = { preview: null, error: null, loading: true }
      return rows
    })
    try {
      const result = await onPreviewConfluence(url)
      setConfluenceRows((prev) => {
        const rows = [...prev]
        rows[index] = { preview: result, error: null, loading: false }
        return rows
      })
    } catch (err) {
      setConfluenceRows((prev) => {
        const rows = [...prev]
        rows[index] = { preview: null, error: (err as Error).message, loading: false }
        return rows
      })
    }
  }

  const previewOneFigma = async (index: number) => {
    const url = figmaUrls[index]?.trim()
    if (!url) return
    setFigmaRows((prev) => {
      const rows = [...prev]
      rows[index] = { preview: null, error: null, loading: true }
      return rows
    })
    try {
      const result = await onPreviewFigma(url)
      setFigmaRows((prev) => {
        const rows = [...prev]
        rows[index] = { preview: result, error: null, loading: false }
        return rows
      })
    } catch (err) {
      setFigmaRows((prev) => {
        const rows = [...prev]
        rows[index] = { preview: null, error: (err as Error).message, loading: false }
        return rows
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center space-x-2 text-sm font-medium">
        <Link2 className="w-4 h-4 text-primary-600" />
        <span>Source links</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 -mt-3">
        Add one or more Confluence and/or Figma links (up to {MAX_LINKS} each). At least one is required to generate.
      </p>

      {/* Confluence */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 text-sm font-medium">
            <BookOpen className="w-4 h-4 text-primary-600" />
            <span>Confluence doc links</span>
          </label>
          <button
            type="button"
            disabled={disabled || confluenceUrls.length >= MAX_LINKS}
            onClick={() => syncConfluence([...confluenceUrls, ''])}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add link
          </button>
        </div>

        {confluenceUrls.map((url, index) => {
          const row = confluenceRows[index] || emptyRow()
          return (
            <div key={`conf-${index}`} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateConfluenceUrl(index, e.target.value)}
                  disabled={disabled}
                  placeholder="https://your-site.atlassian.net/wiki/spaces/.../pages/123456/..."
                  className="input-field"
                />
                <button
                  type="button"
                  onClick={() => previewOneConfluence(index)}
                  disabled={disabled || !url.trim() || row.loading}
                  className="btn-secondary text-sm whitespace-nowrap flex items-center gap-1"
                >
                  {row.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Preview
                </button>
                {confluenceUrls.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      syncConfluence(confluenceUrls.filter((_, i) => i !== index))
                    }}
                    className="btn-secondary text-sm px-2"
                    title="Remove link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {row.error && (
                <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{row.error}</span>
                </div>
              )}
              {row.preview && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
                    <CheckCircle className="w-4 h-4" />
                    {row.preview.title}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
                    {row.preview.text.slice(0, 400)}
                    {row.preview.text.length > 400 ? '…' : ''}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Figma */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 text-sm font-medium">
            <PenTool className="w-4 h-4 text-primary-600" />
            <span>Figma design links</span>
          </label>
          <button
            type="button"
            disabled={disabled || figmaUrls.length >= MAX_LINKS}
            onClick={() => syncFigma([...figmaUrls, ''])}
            className="btn-secondary text-xs flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add link
          </button>
        </div>

        {figmaUrls.map((url, index) => {
          const row = figmaRows[index] || emptyRow()
          return (
            <div key={`fig-${index}`} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateFigmaUrl(index, e.target.value)}
                  disabled={disabled}
                  placeholder="https://www.figma.com/design/:fileKey/...?node-id=1-2"
                  className="input-field"
                />
                <button
                  type="button"
                  onClick={() => previewOneFigma(index)}
                  disabled={disabled || !url.trim() || row.loading}
                  className="btn-secondary text-sm whitespace-nowrap flex items-center gap-1"
                >
                  {row.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Preview
                </button>
                {figmaUrls.length > 1 && (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      syncFigma(figmaUrls.filter((_, i) => i !== index))
                    }}
                    className="btn-secondary text-sm px-2"
                    title="Remove link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {row.error && (
                <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{row.error}</span>
                </div>
              )}
              {row.preview && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
                    <CheckCircle className="w-4 h-4" />
                    {row.preview.title}
                    {row.preview.images?.length
                      ? ` · ${row.preview.images.length} screenshot(s)`
                      : ''}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
                    {row.preview.text.slice(0, 400)}
                    {row.preview.text.length > 400 ? '…' : ''}
                  </p>
                  {row.preview.images && row.preview.images.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {row.preview.images.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded border border-gray-200 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-900"
                        >
                          <img
                            src={src}
                            alt={`Figma preview ${i + 1}`}
                            className="w-full max-h-96 object-contain"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
