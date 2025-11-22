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
        <span>Test Case Prompt</span>
      </label>
      
      <textarea
        id="prompt"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Describe the functionality you want to test... For example: 'Test the login functionality with valid and invalid credentials' or 'Test the shopping cart checkout process'"
        className="input-field min-h-[120px] resize-y"
        rows={4}
      />
      
      <div className="text-xs text-gray-600 dark:text-gray-400">
        <p>💡 <strong>Tip:</strong> Be specific about the functionality you want to test. Include details about user scenarios, edge cases, and any specific requirements.</p>
      </div>
    </div>
  )
}
