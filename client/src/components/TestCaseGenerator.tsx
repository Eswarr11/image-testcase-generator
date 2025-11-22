import { useCallback, useEffect, useState } from 'react'
import { useApiKey } from '../contexts/ApiKeyContext'
import { useToast } from '../contexts/ToastContext'
import { OpenAIRequest, OpenAIResponse, UploadedFile } from '../types'
import GenerateButton from './GenerateButton'
import ImageUpload from './ImageUpload'
import PromptInput from './PromptInput'
import TestCaseResult from './TestCaseResult'

export default function TestCaseGenerator() {
  const { apiKey, isConfigured } = useApiKey()
  const { showToast } = useToast()
  
  const [prompt, setPrompt] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // Force reset uploaded files to clear any blob URLs
  const resetFiles = useCallback(() => {
    setUploadedFiles([])
    showToast('All images cleared. Please re-upload to fix preview issues.', 'info')
  }, [showToast])

  // Debug: Log file preview URLs
  useEffect(() => {
    if (uploadedFiles.length > 0) {
      console.log('Current file preview URLs:', uploadedFiles.map(f => ({
        name: f.file.name,
        preview: f.preview,
        isBlob: f.preview.startsWith('blob:'),
        isData: f.preview.startsWith('data:')
      })));
    }
  }, [uploadedFiles])

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  const generateTestCase = useCallback(async () => {
    if (!prompt.trim()) {
      showToast('Please enter a prompt', 'warning')
      return
    }

    if (!isConfigured || !apiKey) {
      showToast('Please configure your OpenAI API key first', 'error')
      return
    }

    setIsGenerating(true)
    setResult(null)

    try {
      // Prepare the content array for the message
      const contentArray: Array<{
        type: 'text' | 'image_url'
        text?: string
        image_url?: { url: string; detail: 'high' }
      }> = [{ type: 'text', text: prompt }]

      // Add images if any
      if (uploadedFiles.length > 0) {
        const imagePromises = uploadedFiles.map(async (file) => ({
          type: 'image_url' as const,
          image_url: {
            url: await fileToBase64(file.file),
            detail: 'high' as const,
          },
        }))

        const imageContents = await Promise.all(imagePromises)
        contentArray.push(...imageContents)
      }

      const requestBody: OpenAIRequest = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a QA expert specializing in creating comprehensive Jira test cases. Generate detailed, professional test cases with the following EXACT structure for each test case:

## Test Case [Number]: [Clear Title]

**Test Case Title:** [Clear, descriptive title]
**Test Case ID:** TC-[XXX] (use sequential numbers like TC-001, TC-002, etc.)
**Description:** [Brief description of what is being tested]
**Regression Candidate:** [YES/NO - Determine if this test case should be included in regression testing. Answer YES if: the test covers core functionality, critical user flows, previously failed areas, integration points, or features that are frequently modified. Answer NO for basic unit tests, one-time setup tests, or purely cosmetic validations.]
**Pre-conditions:**
- [Condition 1]
- [Condition 2]

**Test Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Results:**
- [Expected result 1]
- [Expected result 2]

**Priority Level:** [Critical/High/Medium/Low]
**Test Data:**
- [Data requirement 1]
- [Data requirement 2]

**Post-conditions:**
- [Post condition 1]
- [Post condition 2]

---

IMPORTANT: 
1. Use exactly this markdown format structure
2. For "Regression Candidate", carefully analyze each test case and determine if it should be part of regression testing
3. Include both positive and negative test scenarios, edge cases, and accessibility considerations where applicable
4. Generate multiple test cases covering different scenarios
5. Be thoughtful about regression candidate selection - focus on business-critical paths and areas prone to breaking`,
          },
          {
            role: 'user',
            content: contentArray,
          },
        ],
        max_tokens: 3000,
        temperature: 0.2,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`

        if (errorData.error) {
          errorMessage = errorData.error.message || errorMessage
        }

        throw new Error(errorMessage)
      }

      const data: OpenAIResponse = await response.json()

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response from OpenAI API')
      }

      const testCase = data.choices[0].message.content

      if (!testCase || testCase.trim() === '') {
        throw new Error('Empty response from OpenAI API')
      }

      setResult(testCase)
      showToast('Test case generated successfully!', 'success')
    } catch (error) {
      console.error('Error generating test case:', error)

      let errorMessage = (error as Error).message
      if ((error as Error).name === 'AbortError') {
        errorMessage = 'Request timeout. Please try again.'
      } else if (errorMessage.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.'
      }

      showToast(`Error generating test case: ${errorMessage}`, 'error', 8000)
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, uploadedFiles, isConfigured, apiKey, showToast, fileToBase64])

  return (
    <div className="space-y-6">
      <div className="card p-6 animate-slide-up">
        <h2 className="text-lg font-semibold mb-4">Generate Test Case</h2>
        
        <div className="space-y-6">
          <PromptInput 
            value={prompt}
            onChange={setPrompt}
            disabled={isGenerating}
          />
          
          <ImageUpload
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
            disabled={isGenerating}
          />
          
          {/* Debug: Force clear blob URLs */}
          {uploadedFiles.some(f => f.preview.startsWith('blob:')) && (
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded border border-yellow-300 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Old blob URLs detected. Clear and re-upload images to fix preview issues.
              </p>
              <button 
                onClick={resetFiles}
                className="text-sm px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
              >
                Clear All Images
              </button>
            </div>
          )}
          
          <GenerateButton
            onClick={generateTestCase}
            disabled={!isConfigured || !prompt.trim() || isGenerating}
            isGenerating={isGenerating}
          />
        </div>
      </div>

      {(result || isGenerating) && (
        <TestCaseResult
          result={result}
          isGenerating={isGenerating}
        />
      )}
    </div>
  )
}
