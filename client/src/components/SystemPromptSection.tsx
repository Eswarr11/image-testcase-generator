import { useState } from 'react'
import { Bot, ChevronDown, ChevronUp } from 'lucide-react'
import { SYSTEM_PROMPT } from '../constants/systemPrompt'

export default function SystemPromptSection() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="card p-6 animate-slide-up">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-primary-600" />
          <div>
            <h2 className="text-lg font-semibold">System Prompt</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ThriveSparrow module context and Jira test case format instructions
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          <textarea
            readOnly
            value={SYSTEM_PROMPT}
            className="input-field min-h-[400px] resize-y font-mono text-xs leading-relaxed"
            rows={20}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            This prompt is sent to the AI as system instructions when generating test cases.
          </p>
        </div>
      )}
    </div>
  )
}
