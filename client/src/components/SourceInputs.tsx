import { useEffect, useState } from 'react'
import { BookOpen, PenTool, Link2, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react'
import type { FigmaFrameInfo, SourceFetchResult } from '../types'

const MAX_LINKS = 10

interface LinkRowState {
  preview: SourceFetchResult | null
  error: string | null
  loading: boolean
  selectedFrameIds: string[]
}

interface SourceInputsProps {
  confluenceUrls: string[]
  figmaUrls: string[]
  onConfluenceUrlsChange: (urls: string[]) => void
  onFigmaUrlsChange: (urls: string[]) => void
  onFigmaFrameSelectionsChange?: (selections: Record<string, string[]>) => void
  onPreviewConfluence: (url: string) => Promise<SourceFetchResult>
  onPreviewFigma: (url: string, selectedFrameIds?: string[]) => Promise<SourceFetchResult>
  disabled?: boolean
}

function emptyRow(): LinkRowState {
  return { preview: null, error: null, loading: false, selectedFrameIds: [] }
}

export default function SourceInputs({
  confluenceUrls,
  figmaUrls,
  onConfluenceUrlsChange,
  onFigmaUrlsChange,
  onFigmaFrameSelectionsChange,
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

  const emitSelections = (urls: string[], rows: LinkRowState[]) => {
    if (!onFigmaFrameSelectionsChange) return
    const map: Record<string, string[]> = {}
    urls.forEach((url, i) => {
      const trimmed = url.trim()
      const ids = rows[i]?.selectedFrameIds
      if (trimmed && ids && ids.length > 0) map[trimmed] = ids
    })
    onFigmaFrameSelectionsChange(map)
  }

  useEffect(() => {
    emitSelections(figmaUrls, figmaRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figmaRows, figmaUrls])

  const syncConfluence = (urls: string[]) => {
    onConfluenceUrlsChange(urls)
    setConfluenceRows((prev) => urls.map((_, i) => prev[i] || emptyRow()))
  }

  const syncFigma = (urls: string[]) => {
    onFigmaUrlsChange(urls)
    setFigmaRows((prev) => {
      const next = urls.map((_, i) => prev[i] || emptyRow())
      emitSelections(urls, next)
      return next
    })
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
      emitSelections(next, rows)
      return rows
    })
  }

  const previewOneConfluence = async (index: number) => {
    const url = confluenceUrls[index]?.trim()
    if (!url) return
    setConfluenceRows((prev) => {
      const rows = [...prev]
      rows[index] = { ...emptyRow(), loading: true }
      return rows
    })
    try {
      const result = await onPreviewConfluence(url)
      setConfluenceRows((prev) => {
        const rows = [...prev]
        rows[index] = { preview: result, error: null, loading: false, selectedFrameIds: [] }
        return rows
      })
    } catch (err) {
      setConfluenceRows((prev) => {
        const rows = [...prev]
        rows[index] = { preview: null, error: (err as Error).message, loading: false, selectedFrameIds: [] }
        return rows
      })
    }
  }

  const previewOneFigma = async (index: number, withSelection = false) => {
    const url = figmaUrls[index]?.trim()
    if (!url) return
    const selected = withSelection ? figmaRows[index]?.selectedFrameIds : undefined
    setFigmaRows((prev) => {
      const rows = [...prev]
      rows[index] = { ...(rows[index] || emptyRow()), preview: null, error: null, loading: true }
      return rows
    })
    try {
      const result = await onPreviewFigma(url, selected)
      const frameIds =
        result.frames
          ?.filter((f) => f.selected !== false)
          .map((f) => f.id) ||
        result.frames?.map((f) => f.id) ||
        []
      setFigmaRows((prev) => {
        const rows = [...prev]
        rows[index] = {
          preview: result,
          error: null,
          loading: false,
          selectedFrameIds: withSelection && selected?.length ? selected : frameIds,
        }
        emitSelections(figmaUrls, rows)
        return rows
      })
    } catch (err) {
      setFigmaRows((prev) => {
        const rows = [...prev]
        rows[index] = {
          preview: null,
          error: (err as Error).message,
          loading: false,
          selectedFrameIds: prev[index]?.selectedFrameIds || [],
        }
        return rows
      })
    }
  }

  const toggleFrame = (index: number, frameId: string) => {
    setFigmaRows((prev) => {
      const rows = [...prev]
      const row = rows[index] || emptyRow()
      const set = new Set(row.selectedFrameIds)
      if (set.has(frameId)) set.delete(frameId)
      else set.add(frameId)
      rows[index] = { ...row, selectedFrameIds: [...set] }
      emitSelections(figmaUrls, rows)
      return rows
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center space-x-2 text-sm font-medium">
        <Link2 className="w-4 h-4 text-primary-600" />
        <span>Source links</span>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 -mt-3">
        Add Confluence and/or Figma links. After Figma Preview, pick which frames to include.
      </p>

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
                    onClick={() => syncConfluence(confluenceUrls.filter((_, i) => i !== index))}
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
          const frames: FigmaFrameInfo[] = row.preview?.frames || []
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
                  onClick={() => previewOneFigma(index, false)}
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
                    onClick={() => syncFigma(figmaUrls.filter((_, i) => i !== index))}
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
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
                      <CheckCircle className="w-4 h-4" />
                      {row.preview.title}
                      {row.selectedFrameIds.length
                        ? ` · ${row.selectedFrameIds.length} frame(s) selected`
                        : ''}
                    </div>
                    {frames.length > 0 && (
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={disabled || row.loading || row.selectedFrameIds.length === 0}
                        onClick={() => previewOneFigma(index, true)}
                      >
                        Refresh selected
                      </button>
                    )}
                  </div>

                  {frames.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Frames in this design — select screens to include:
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {frames.map((frame) => {
                          const checked = row.selectedFrameIds.includes(frame.id)
                          return (
                            <label
                              key={frame.id}
                              className={`flex items-start gap-2 p-2 rounded border text-xs cursor-pointer ${
                                checked
                                  ? 'border-primary-500 bg-white dark:bg-gray-900'
                                  : 'border-gray-200 dark:border-gray-600 bg-white/50 dark:bg-gray-900/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => toggleFrame(index, frame.id)}
                              />
                              <span className="min-w-0">
                                <span className="font-medium block truncate">{frame.name}</span>
                                <span className="text-gray-500">{frame.type}</span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap">
                    {row.preview.text.slice(0, 400)}
                    {row.preview.text.length > 400 ? '…' : ''}
                  </p>

                  {(() => {
                    const imgs =
                      frames
                        .filter((f) => row.selectedFrameIds.includes(f.id) && f.image)
                        .map((f) => f.image as string) ||
                      row.preview.images ||
                      []
                    const list = imgs.length > 0 ? imgs : row.preview.images || []
                    if (list.length === 0) return null
                    return (
                      <div className="flex flex-col gap-3">
                        {list.map((src, i) => (
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
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
