import { CheckCircle2, Circle, ListChecks, Loader2 } from 'lucide-react'
import type { CoverageItem } from '../types'

interface CoveragePanelProps {
  coverage: CoverageItem[]
  isGeneratingMissing: boolean
  onGenerateMissing: () => void
}

export default function CoveragePanel({
  coverage,
  isGeneratingMissing,
  onGenerateMissing,
}: CoveragePanelProps) {
  if (!coverage.length) return null

  const uncovered = coverage.filter((c) => c.status === 'uncovered')
  const covered = coverage.filter((c) => c.status === 'covered')

  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center space-x-2">
          <ListChecks className="w-5 h-5 text-primary-600" />
          <div>
            <h3 className="text-lg font-semibold">Requirements coverage</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {covered.length} covered · {uncovered.length} uncovered of {coverage.length}
            </p>
          </div>
        </div>
        {uncovered.length > 0 && (
          <button
            type="button"
            className="btn-primary text-sm flex items-center gap-2"
            disabled={isGeneratingMissing}
            onClick={onGenerateMissing}
          >
            {isGeneratingMissing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Generate missing cases
          </button>
        )}
      </div>

      <ul className="space-y-2 max-h-80 overflow-y-auto">
        {coverage.map((item) => (
          <li
            key={item.requirementId}
            className="flex items-start gap-2 text-sm p-2 rounded border border-gray-200 dark:border-gray-700"
          >
            {item.status === 'covered' ? (
              <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {item.requirementId}
                {item.coveredBy.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    → {item.coveredBy.join(', ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
                {item.requirementText}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
