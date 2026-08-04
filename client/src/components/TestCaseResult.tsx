import { Check, Copy, Download, FileText, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import type { StructuredTestCase } from '../types'
import {
  downloadBlob,
  structuredCasesToCsv,
  structuredCasesToSpreadsheetMl,
} from '../utils/exportCases'

interface TestCaseResultProps {
  testCases: StructuredTestCase[] | null
  markdown: string | null
  isGenerating: boolean
  onTestCasesChange: (cases: StructuredTestCase[]) => void
}

type ViewMode = 'edit' | 'markdown'

function listToText(items: string[]): string {
  return items.join('\n')
}

function textToList(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function TestCaseResult({
  testCases,
  markdown,
  isGenerating,
  onTestCasesChange,
}: TestCaseResultProps) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<ViewMode>('edit')
  const [localCases, setLocalCases] = useState<StructuredTestCase[]>([])

  useEffect(() => {
    setLocalCases(testCases || [])
  }, [testCases])

  const updateCase = (index: number, patch: Partial<StructuredTestCase>) => {
    const next = localCases.map((tc, i) => (i === index ? { ...tc, ...patch } : tc))
    setLocalCases(next)
    onTestCasesChange(next)
  }

  const removeCase = (index: number) => {
    const next = localCases.filter((_, i) => i !== index)
    setLocalCases(next)
    onTestCasesChange(next)
  }

  const copyMarkdown = async () => {
    const text = markdown || ''
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      showToast('Markdown copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Failed to copy', 'error')
    }
  }

  const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)

  const exportCsv = () => {
    if (!localCases.length) {
      showToast('No test cases to export', 'warning')
      return
    }
    const csv = structuredCasesToCsv(localCases)
    downloadBlob(csv, `test_cases_${timestamp()}.csv`, 'text/csv;charset=utf-8')
    showToast(`${localCases.length} cases exported as CSV`, 'success')
  }

  const exportXlsx = () => {
    if (!localCases.length) {
      showToast('No test cases to export', 'warning')
      return
    }
    const xml = structuredCasesToSpreadsheetMl(localCases)
    downloadBlob(xml, `test_cases_${timestamp()}.xls`, 'application/vnd.ms-excel')
    showToast(`${localCases.length} cases exported as Excel`, 'success')
  }

  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold">Generated Test Cases</h3>
          {localCases.length > 0 && (
            <span className="text-xs text-gray-500">{localCases.length} cases</span>
          )}
        </div>

        {localCases.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm ${view === 'edit' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                onClick={() => setView('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm ${view === 'markdown' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                onClick={() => setView('markdown')}
              >
                Markdown
              </button>
            </div>
            <button type="button" onClick={copyMarkdown} className="btn-secondary flex items-center space-x-2 text-sm">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy MD'}</span>
            </button>
            <button type="button" onClick={exportCsv} className="btn-secondary flex items-center space-x-2 text-sm">
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button type="button" onClick={exportXlsx} className="btn-secondary flex items-center space-x-2 text-sm">
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-[200px]">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <p className="text-gray-600 dark:text-gray-400">
              Generating structured test cases…
            </p>
          </div>
        ) : localCases.length > 0 ? (
          view === 'markdown' ? (
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {markdown}
            </pre>
          ) : (
            <div className="space-y-4">
              {localCases.map((tc, index) => (
                <div
                  key={`${tc.id}-${index}`}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                      <input
                        className="input-field text-sm"
                        value={tc.id}
                        onChange={(e) => updateCase(index, { id: e.target.value })}
                        placeholder="TC-001"
                      />
                      <input
                        className="input-field text-sm sm:col-span-2"
                        value={tc.title}
                        onChange={(e) => updateCase(index, { title: e.target.value })}
                        placeholder="Title"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-secondary p-2"
                      title="Delete case"
                      onClick={() => removeCase(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <textarea
                    className="input-field text-sm min-h-[60px]"
                    value={tc.description}
                    onChange={(e) => updateCase(index, { description: e.target.value })}
                    placeholder="Description"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs space-y-1">
                      <span className="font-medium">Priority</span>
                      <select
                        className="input-field text-sm"
                        value={tc.priority}
                        onChange={(e) => updateCase(index, { priority: e.target.value })}
                      >
                        {['Critical', 'High', 'Medium', 'Low'].map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs space-y-1">
                      <span className="font-medium">Regression</span>
                      <select
                        className="input-field text-sm"
                        value={tc.regression}
                        onChange={(e) => updateCase(index, { regression: e.target.value })}
                      >
                        <option value="YES">YES</option>
                        <option value="NO">NO</option>
                      </select>
                    </label>
                  </div>

                  {(
                    [
                      ['preconditions', 'Preconditions (one per line)'],
                      ['steps', 'Steps (one per line)'],
                      ['expected', 'Expected results (one per line)'],
                      ['testData', 'Test data (one per line)'],
                      ['postconditions', 'Post-conditions (one per line)'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block text-xs space-y-1">
                      <span className="font-medium">{label}</span>
                      <textarea
                        className="input-field text-sm min-h-[72px] font-mono"
                        value={listToText(tc[key])}
                        onChange={(e) =>
                          updateCase(index, { [key]: textToList(e.target.value) })
                        }
                      />
                    </label>
                  ))}

                  {tc.coversRequirements && tc.coversRequirements.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Covers: {tc.coversRequirements.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              Your generated test cases will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
