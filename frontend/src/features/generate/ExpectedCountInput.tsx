import { Hash } from 'lucide-react'

interface ExpectedCountInputProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  min?: number
  max?: number
}

export default function ExpectedCountInput({
  value,
  onChange,
  disabled,
  min = 1,
  max = 40,
}: ExpectedCountInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="expected-count" className="flex items-center space-x-2 text-sm font-medium">
        <Hash className="w-4 h-4 text-primary-600" />
        <span>Expected test cases</span>
      </label>

      <input
        id="expected-count"
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const raw = Number(e.target.value)
          if (!Number.isFinite(raw)) return
          onChange(Math.min(max, Math.max(min, Math.round(raw))))
        }}
        className="input-field w-full max-w-[140px]"
      />

      <p className="text-xs text-gray-600 dark:text-gray-400">
        Generation will return exactly this many test cases ({min}–{max}).
      </p>
    </div>
  )
}
