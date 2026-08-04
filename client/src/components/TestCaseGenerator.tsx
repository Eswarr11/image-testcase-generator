import { useCallback, useState } from 'react'
import { useCredentials } from '../contexts/CredentialsContext'
import { useToast } from '../contexts/ToastContext'
import { SourceFetchResult, UploadedFile } from '../types'
import {
  fetchConfluencePage,
  fetchFigmaDesign,
  generateTestCase as generateViaApi,
} from '../services/sourcesApi'
import GenerateButton from './GenerateButton'
import ImageUpload from './ImageUpload'
import PromptInput from './PromptInput'
import SourceInputs from './SourceInputs'
import TestCaseResult from './TestCaseResult'

export default function TestCaseGenerator() {
  const {
    isOpenAIConfigured,
    isAtlassianConfigured,
    isFigmaConfigured,
  } = useCredentials()
  const { showToast } = useToast()

  const [prompt, setPrompt] = useState('')
  const [confluenceUrls, setConfluenceUrls] = useState<string[]>([''])
  const [figmaUrls, setFigmaUrls] = useState<string[]>([''])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const resetFiles = useCallback(() => {
    setUploadedFiles([])
    showToast('All images cleared. Please re-upload to fix preview issues.', 'info')
  }, [showToast])

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  const filledConfluence = confluenceUrls.map((u) => u.trim()).filter(Boolean)
  const filledFigma = figmaUrls.map((u) => u.trim()).filter(Boolean)

  const previewConfluence = useCallback(
    async (url: string): Promise<SourceFetchResult> => {
      if (!isAtlassianConfigured) {
        throw new Error('Save Atlassian credentials in the Credentials panel first')
      }
      return fetchConfluencePage(url.trim())
    },
    [isAtlassianConfigured]
  )

  const previewFigma = useCallback(
    async (url: string): Promise<SourceFetchResult> => {
      if (!isFigmaConfigured) {
        throw new Error('Save a Figma token in the Credentials panel first')
      }
      return fetchFigmaDesign(url.trim())
    },
    [isFigmaConfigured]
  )

  const generateTestCase = useCallback(async () => {
    if (!isOpenAIConfigured) {
      showToast('Please save your OpenAI API key first', 'error')
      return
    }

    const confluenceList = confluenceUrls.map((u) => u.trim()).filter(Boolean)
    const figmaList = figmaUrls.map((u) => u.trim()).filter(Boolean)

    if (confluenceList.length === 0 && figmaList.length === 0 && uploadedFiles.length === 0) {
      showToast('Paste at least one Confluence or Figma link (or upload images)', 'warning')
      return
    }

    if (confluenceList.length > 0 && !isAtlassianConfigured) {
      showToast('Save Atlassian credentials to fetch Confluence pages', 'error')
      return
    }

    if (figmaList.length > 0 && !isFigmaConfigured) {
      showToast('Save a Figma token to fetch designs', 'error')
      return
    }

    setIsGenerating(true)
    setResult(null)

    try {
      const images =
        uploadedFiles.length > 0
          ? await Promise.all(uploadedFiles.map((f) => fileToBase64(f.file)))
          : []

      showToast('Generating test cases on the server…', 'info', 2500)
      const content = await generateViaApi({
        ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
        confluenceUrls: confluenceList,
        figmaUrls: figmaList,
        ...(images.length > 0 ? { images } : {}),
      })

      setResult(content)
      showToast('Test case generated successfully!', 'success')
    } catch (error) {
      console.error('Error generating test case:', error)
      showToast(`Error generating test case: ${(error as Error).message}`, 'error', 8000)
    } finally {
      setIsGenerating(false)
    }
  }, [
    prompt,
    confluenceUrls,
    figmaUrls,
    uploadedFiles,
    isOpenAIConfigured,
    isAtlassianConfigured,
    isFigmaConfigured,
    showToast,
    fileToBase64,
  ])

  const canGenerate =
    isOpenAIConfigured &&
    (filledConfluence.length > 0 || filledFigma.length > 0 || uploadedFiles.length > 0) &&
    !isGenerating

  return (
    <div className="space-y-6">
      <div className="card p-6 animate-slide-up">
        <h2 className="text-lg font-semibold mb-4">Generate Test Case</h2>

        <div className="space-y-6">
          <SourceInputs
            confluenceUrls={confluenceUrls}
            figmaUrls={figmaUrls}
            onConfluenceUrlsChange={setConfluenceUrls}
            onFigmaUrlsChange={setFigmaUrls}
            onPreviewConfluence={previewConfluence}
            onPreviewFigma={previewFigma}
            disabled={isGenerating}
          />

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

          {uploadedFiles.some((f) => f.preview.startsWith('blob:')) && (
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded border border-yellow-300 dark:border-yellow-700">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                Old blob URLs detected. Clear and re-upload images to fix preview issues.
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
            disabled={!canGenerate}
            isGenerating={isGenerating}
          />
        </div>
      </div>

      {(result || isGenerating) && (
        <TestCaseResult result={result} isGenerating={isGenerating} />
      )}
    </div>
  )
}
