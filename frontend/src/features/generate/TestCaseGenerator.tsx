import { useCallback, useMemo, useState } from 'react'
import { useCredentials } from '@/commons/context/CredentialsContext'
import { useToast } from '@/commons/context/ToastContext'
import type {
  CoverageItem,
  SourceFetchResult,
  StructuredTestCase,
  UploadedFile,
} from '@/commons/types'
import {
  fetchConfluencePage,
  fetchFigmaDesign,
  generateTestCase as generateViaApi,
} from '@/commons/services/sourcesApi'
import { compressImagesForGenerate } from '@/commons/utils/compressImage'
import CoveragePanel from '@/features/results/CoveragePanel'
import ExpectedCountInput from './ExpectedCountInput'
import GenerateButton from './GenerateButton'
import ImageUpload from './ImageUpload'
import PromptInput from './PromptInput'
import SourceInputs from '@/features/sources/SourceInputs'
import TestCaseResult from '@/features/results/TestCaseResult'

const DEFAULT_EXPECTED_COUNT = 10

export default function TestCaseGenerator() {
  const {
    isOpenAIConfigured,
    isAtlassianConfigured,
    isFigmaConfigured,
  } = useCredentials()
  const { showToast } = useToast()

  const [prompt, setPrompt] = useState('')
  const [expectedCount, setExpectedCount] = useState(DEFAULT_EXPECTED_COUNT)
  const [confluenceUrls, setConfluenceUrls] = useState<string[]>([''])
  const [figmaUrls, setFigmaUrls] = useState<string[]>([''])
  const [figmaFrameSelections, setFigmaFrameSelections] = useState<Record<string, string[]>>({})
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingMissing, setIsGeneratingMissing] = useState(false)

  const [testCases, setTestCases] = useState<StructuredTestCase[] | null>(null)
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<CoverageItem[]>([])
  const [requirements, setRequirements] = useState<Array<{ id: string; text: string }>>([])

  const filledConfluence = useMemo(
    () => confluenceUrls.map((u) => u.trim()).filter(Boolean),
    [confluenceUrls]
  )
  const filledFigma = useMemo(
    () =>
      figmaUrls
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && /figma\.com\//i.test(u)),
    [figmaUrls]
  )

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
    async (url: string, selectedFrameIds?: string[]): Promise<SourceFetchResult> => {
      if (!isFigmaConfigured) {
        throw new Error('Save a Figma token in the Credentials panel first')
      }
      return fetchFigmaDesign(url.trim(), selectedFrameIds)
    },
    [isFigmaConfigured]
  )

  const runGenerate = useCallback(
    async (opts?: { uncoveredOnly?: boolean }) => {
      if (!isOpenAIConfigured) {
        showToast('Please save your OpenAI API key first', 'error')
        return
      }

      const confluenceList = confluenceUrls.map((u) => u.trim()).filter(Boolean)
      // Only treat real Figma URLs as sources — blank/partial text must not block generate
      const figmaList = figmaUrls
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && /figma\.com\//i.test(u))

      if (
        confluenceList.length === 0 &&
        figmaList.length === 0 &&
        uploadedFiles.length === 0 &&
        !prompt.trim()
      ) {
        showToast('Enter a prompt, paste a Confluence link, or upload images', 'warning')
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

      const uncoveredOnly = Boolean(opts?.uncoveredOnly)
      if (uncoveredOnly) setIsGeneratingMissing(true)
      else setIsGenerating(true)

      try {
        let images: string[] = []
        if (uploadedFiles.length > 0) {
          showToast('Optimizing images for upload…', 'info', 2000)
          images = await compressImagesForGenerate(uploadedFiles.map((f) => f.file))
        }

        const uncoveredIds = uncoveredOnly
          ? coverage.filter((c) => c.status === 'uncovered').map((c) => c.requirementId)
          : undefined

        if (uncoveredOnly && (!uncoveredIds || uncoveredIds.length === 0)) {
          showToast('No uncovered requirements', 'info')
          return
        }

        showToast(
          uncoveredOnly ? 'Generating cases for uncovered requirements…' : 'Generating structured test cases…',
          'info',
          2500
        )

        const data = await generateViaApi({
          ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          confluenceUrls: confluenceList,
          figmaUrls: figmaList,
          expectedCount,
          ...(images.length > 0 ? { images } : {}),
          ...(Object.keys(figmaFrameSelections).length > 0
            ? { figmaFrameSelections }
            : {}),
          ...(uncoveredIds ? { uncoveredRequirementIds: uncoveredIds } : {}),
          ...(uncoveredOnly && requirements.length > 0
            ? { existingRequirements: requirements }
            : {}),
        })

        if (uncoveredOnly) {
          setTestCases((prev) => [...(prev || []), ...data.testCases])
          setMarkdown((prev) => `${prev || ''}\n\n${data.markdown}`)
          setCoverage((prev) => {
            const byId = new Map(prev.map((item) => [item.requirementId, item]))
            for (const item of data.coverage) {
              const existing = byId.get(item.requirementId)
              if (!existing) {
                byId.set(item.requirementId, item)
              } else {
                const coveredBy = [...new Set([...existing.coveredBy, ...item.coveredBy])]
                byId.set(item.requirementId, {
                  ...item,
                  coveredBy,
                  status: coveredBy.length > 0 ? 'covered' : 'uncovered',
                })
              }
            }
            return [...byId.values()]
          })
        } else {
          setTestCases(data.testCases)
          setMarkdown(data.markdown)
          setCoverage(data.coverage)
          setRequirements(data.requirements)
        }

        showToast(
          uncoveredOnly
            ? `Added ${data.testCases.length} case(s) for uncovered requirements`
            : `Generated ${data.testCases.length} test case(s)`,
          'success'
        )
      } catch (error) {
        console.error('Error generating test case:', error)
        showToast(`Error generating test case: ${(error as Error).message}`, 'error', 8000)
      } finally {
        setIsGenerating(false)
        setIsGeneratingMissing(false)
      }
    },
    [
      prompt,
      expectedCount,
      confluenceUrls,
      figmaUrls,
      figmaFrameSelections,
      uploadedFiles,
      isOpenAIConfigured,
      isAtlassianConfigured,
      isFigmaConfigured,
      coverage,
      requirements,
      showToast,
    ]
  )

  const canGenerate =
    isOpenAIConfigured &&
    (prompt.trim().length > 0 ||
      filledConfluence.length > 0 ||
      filledFigma.length > 0 ||
      uploadedFiles.length > 0) &&
    !isGenerating &&
    !isGeneratingMissing

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
            onFigmaFrameSelectionsChange={setFigmaFrameSelections}
            onPreviewConfluence={previewConfluence}
            onPreviewFigma={previewFigma}
            disabled={isGenerating || isGeneratingMissing}
          />

          <PromptInput
            value={prompt}
            onChange={setPrompt}
            disabled={isGenerating || isGeneratingMissing}
          />

          <ExpectedCountInput
            value={expectedCount}
            onChange={setExpectedCount}
            disabled={isGenerating || isGeneratingMissing}
          />

          <ImageUpload
            uploadedFiles={uploadedFiles}
            onFilesChange={setUploadedFiles}
            disabled={isGenerating || isGeneratingMissing}
          />

          <GenerateButton
            onClick={() => runGenerate()}
            disabled={!canGenerate}
            isGenerating={isGenerating}
          />
        </div>
      </div>

      {(testCases || isGenerating) && (
        <TestCaseResult
          testCases={testCases}
          markdown={markdown}
          isGenerating={isGenerating}
          onTestCasesChange={setTestCases}
        />
      )}

      {coverage.length > 0 && (
        <CoveragePanel
          coverage={coverage}
          isGeneratingMissing={isGeneratingMissing}
          onGenerateMissing={() => runGenerate({ uncoveredOnly: true })}
        />
      )}
    </div>
  )
}
