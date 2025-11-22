import { Check, Copy, Download, FileText, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'

interface TestCaseResultProps {
  result: string | null
  isGenerating: boolean
}

export default function TestCaseResult({ result, isGenerating }: TestCaseResultProps) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    if (!result) return

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(result)
        setCopied(true)
        showToast('Test case copied to clipboard!', 'success')
        setTimeout(() => setCopied(false), 2000)
      } else {
        // Fallback for older browsers or non-HTTPS
        const textArea = document.createElement('textarea')
        textArea.value = result
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (copied) {
          setCopied(true)
          showToast('Test case copied to clipboard!', 'success')
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('Copy command failed')
        }
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      showToast('Failed to copy to clipboard', 'error')
    }
  }

  const parseTestCaseContent = (content: string) => {
    const testCases: Array<{
      id: string
      summary: string
      priority: string
      description: string
      tags: string
      precondition: string
      testSteps: string
      expectedResult: string
    }> = []

    // Split content by test case sections (markdown headers or separators)
    const sections = content.split(/(?:---|\n##|\n# Test Case)/);
    
    sections.forEach((section, index) => {
      if (!section.trim() || section.includes('# Test Cases for')) return

      // Extract fields using regex patterns
      const extractField = (pattern: RegExp): string => {
        const match = section.match(pattern)
        return match && match[1] ? match[1].trim().replace(/"/g, '""') : ''
      }

      const id = extractField(/\*\*Test Case ID:\*\*\s*(.+?)(?:\s*\*\*|\n|$)/i) || `TC-${String(index).padStart(3, '0')}`
      const summary = extractField(/\*\*Test Case Title:\*\*\s*(.+?)(?:\s*\*\*|\n|$)/i)
      const priority = extractField(/\*\*Priority Level:\*\*\s*(.+?)(?:\s*\*\*|\n|$)/i) || 'Medium'
      const description = extractField(/\*\*Description:\*\*\s*(.+?)(?:\s*\*\*|\n\n)/is)
      
      // Extract pre-conditions (handle both bullet points and plain text)
      let precondition = ''
      const preMatch = section.match(/\*\*Pre-conditions:\*\*\s*([\s\S]*?)(?:\*\*|$)/i)
      if (preMatch && preMatch[1]) {
        precondition = preMatch[1]
          .replace(/^[\s-•]+/gm, '')
          .replace(/\n+/g, '; ')
          .trim()
          .replace(/"/g, '""')
      }

      // Extract test steps (handle numbered lists)
      let testSteps = ''
      const stepsMatch = section.match(/\*\*Test Steps:\*\*\s*([\s\S]*?)(?:\*\*|$)/i)
      if (stepsMatch && stepsMatch[1]) {
        testSteps = stepsMatch[1]
          .replace(/^\d+\.\s*/gm, '')
          .replace(/^[\s-•]+/gm, '')
          .replace(/\n+/g, '; ')
          .trim()
          .replace(/"/g, '""')
      }

      // Extract expected results (handle bullet points)
      let expectedResult = ''
      const resultsMatch = section.match(/\*\*Expected Results?:\*\*\s*([\s\S]*?)(?:\*\*|$)/i)
      if (resultsMatch && resultsMatch[1]) {
        expectedResult = resultsMatch[1]
          .replace(/^[\s-•]+/gm, '')
          .replace(/\n+/g, '; ')
          .trim()
          .replace(/"/g, '""')
      }

      // Only add if we have meaningful content
      if (summary || description || testSteps || expectedResult) {
        testCases.push({
          id,
          summary,
          priority,
          description,
          tags: '', // Can be enhanced later if needed
          precondition,
          testSteps,
          expectedResult
        })
      }
    })

    return testCases
  }

  const exportToCSV = () => {
    if (!result) return

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const filename = `test_cases_${timestamp}.csv`

      // Parse the test case content
      const testCases = parseTestCaseContent(result)

      if (testCases.length === 0) {
        showToast('No test cases found to export', 'warning')
        return
      }

      // Create CSV header matching the original format
      const csvHeader = 'Existing Testcase ID,Summary,Priority,Description,Tags,Precondition,Test Steps,Expected Result\n'
      
      // Create CSV rows
      const csvRows = testCases.map(tc => 
        `"${tc.id}","${tc.summary}","${tc.priority}","${tc.description}","${tc.tags}","${tc.precondition}","${tc.testSteps}","${tc.expectedResult}"`
      ).join('\n')

      const csvContent = csvHeader + csvRows

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast(`${testCases.length} test cases exported as ${filename}`, 'success')
    } catch (error) {
      console.error('Error exporting CSV:', error)
      showToast('Error exporting CSV: ' + (error as Error).message, 'error')
    }
  }

  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-primary-600" />
          <h3 className="text-lg font-semibold">Generated Test Case</h3>
        </div>
        
        {result && (
          <div className="flex space-x-2">
            <button
              onClick={copyToClipboard}
              className="btn-secondary flex items-center space-x-2 text-sm"
              title="Copy to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy</span>
                </>
              )}
            </button>
            
            <button
              onClick={exportToCSV}
              className="btn-secondary flex items-center space-x-2 text-sm"
              title="Export as CSV"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 min-h-[200px]">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <p className="text-gray-600 dark:text-gray-400">
              Generating your test case... This may take a few moments.
            </p>
          </div>
        ) : result ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {result}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              Your generated test case will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
