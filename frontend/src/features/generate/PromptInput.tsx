import { MessageSquare } from 'lucide-react'

interface PromptInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function PromptInput({ value, onChange, disabled }: PromptInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="prompt" className="flex items-center space-x-2 text-sm font-medium">
        <MessageSquare className="w-4 h-4 text-primary-600" />
        <span>Focus prompt (optional)</span>
      </label>
      
      <textarea
        id="prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Optional: narrow the scope — e.g. 'Focus on login validation and error states' or 'Cover mobile breakpoints only'"
        className="input-field min-h-[100px] resize-y"
        rows={3}
      />
      
      <div className="text-xs text-gray-600 dark:text-gray-400">
        <p>Tip: Use Confluence links as the main source. Figma links and this prompt are optional.</p>
      </div>
    </div>
  )
}
