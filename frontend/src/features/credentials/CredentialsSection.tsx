import { useEffect, useState } from 'react'
import { Key, Eye, EyeOff, CheckCircle, AlertCircle, ChevronDown, ChevronUp, PenTool, BookOpen } from 'lucide-react'
import { useCredentials } from '@/commons/context/CredentialsContext'
import { useToast } from '@/commons/context/ToastContext'

export default function CredentialsSection() {
  const {
    prefs,
    saveOpenAI,
    saveAtlassian,
    saveFigma,
    clearOpenAI,
    clearAtlassian,
    clearFigma,
    isOpenAIConfigured,
    isAtlassianConfigured,
    isFigmaConfigured,
  } = useCredentials()
  const { showToast } = useToast()

  const readyForCollapse = isOpenAIConfigured
  const [expanded, setExpanded] = useState(!readyForCollapse)

  const [openaiInput, setOpenaiInput] = useState('')
  const [showOpenai, setShowOpenai] = useState(false)
  const [editingOpenai, setEditingOpenai] = useState(!isOpenAIConfigured)
  const [validatingOpenai, setValidatingOpenai] = useState(false)

  const [siteUrl, setSiteUrl] = useState(prefs.siteUrl)
  const [email, setEmail] = useState(prefs.email)
  const [atlassianToken, setAtlassianToken] = useState('')
  const [showAtlassianToken, setShowAtlassianToken] = useState(false)
  const [editingAtlassian, setEditingAtlassian] = useState(!isAtlassianConfigured)
  const [validatingAtlassian, setValidatingAtlassian] = useState(false)

  const [figmaInput, setFigmaInput] = useState('')
  const [showFigma, setShowFigma] = useState(false)
  const [editingFigma, setEditingFigma] = useState(!isFigmaConfigured)
  const [validatingFigma, setValidatingFigma] = useState(false)

  useEffect(() => {
    if (prefs.siteUrl) setSiteUrl(prefs.siteUrl)
    if (prefs.email) setEmail(prefs.email)
  }, [prefs])

  useEffect(() => {
    if (isOpenAIConfigured) setEditingOpenai(false)
    if (isAtlassianConfigured) setEditingAtlassian(false)
    if (isFigmaConfigured) setEditingFigma(false)
    if (readyForCollapse) setExpanded(false)
  }, [isOpenAIConfigured, isAtlassianConfigured, isFigmaConfigured, readyForCollapse])

  const statusBadge = (ok: boolean, label: string, optional = false) => (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
        ok
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
          : optional
            ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
      }`}
    >
      {ok ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
      {ok ? label : optional ? `${label} optional` : label}
    </span>
  )

  const handleSaveOpenAI = async () => {
    const trimmed = openaiInput.trim()
    if (!trimmed) {
      showToast('Please enter an OpenAI API key', 'warning')
      return
    }
    if (!trimmed.startsWith('sk-') || trimmed.length <= 20) {
      showToast('Invalid API key format. OpenAI keys start with "sk-"', 'error')
      return
    }

    setValidatingOpenai(true)
    try {
      await saveOpenAI(trimmed)
      setOpenaiInput('')
      setEditingOpenai(false)
      showToast('OpenAI key saved to server session', 'success')
    } catch (err) {
      showToast((err as Error).message || 'Failed to save OpenAI key', 'error')
    } finally {
      setValidatingOpenai(false)
    }
  }

  const handleSaveAtlassian = async () => {
    let normalizedSite = siteUrl.trim().replace(/\/+$/, '')
    const payloadEmail = email.trim()
    const apiToken = atlassianToken.trim()

    if (!normalizedSite || !payloadEmail || !apiToken) {
      showToast('Please fill site URL, email, and API token', 'warning')
      return
    }
    if (!normalizedSite.startsWith('https://')) {
      showToast('Site URL must start with https://', 'warning')
      return
    }
    try {
      normalizedSite = new URL(normalizedSite).origin
    } catch {
      showToast('Invalid site URL', 'warning')
      return
    }

    setValidatingAtlassian(true)
    try {
      await saveAtlassian({
        siteUrl: normalizedSite,
        email: payloadEmail,
        apiToken,
      })
      setAtlassianToken('')
      setEditingAtlassian(false)
      showToast('Atlassian credentials saved to server session', 'success')
    } catch (err) {
      showToast((err as Error).message || 'Failed to save Atlassian credentials', 'error')
    } finally {
      setValidatingAtlassian(false)
    }
  }

  const handleSaveFigma = async () => {
    const token = figmaInput.trim()
    if (!token) {
      showToast('Please enter a Figma access token', 'warning')
      return
    }

    setValidatingFigma(true)
    try {
      await saveFigma({ accessToken: token })
      setFigmaInput('')
      setEditingFigma(false)
      showToast('Figma token saved to server session', 'success')
    } catch (err) {
      showToast((err as Error).message || 'Failed to save Figma token', 'error')
    } finally {
      setValidatingFigma(false)
    }
  }

  return (
    <div className="card p-6 animate-slide-up">
      <button
        type="button"
        className="w-full flex items-center justify-between text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold">Credentials</h2>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(isOpenAIConfigured, 'OpenAI')}
          {statusBadge(isAtlassianConfigured, 'Atlassian', true)}
          {statusBadge(isFigmaConfigured, 'Figma', true)}
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {expanded && (
        <div className="mt-6 space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Key className="w-4 h-4" /> OpenAI
            </h3>
            {isOpenAIConfigured && !editingOpenai ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    OpenAI key stored in server session (not in browser storage)
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setEditingOpenai(true)}>
                    Change
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={async () => {
                      await clearOpenAI()
                      setEditingOpenai(true)
                      showToast('OpenAI key removed from session', 'info')
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="openaiKey" className="block text-sm font-medium">API Key</label>
                <div className="relative">
                  <input
                    id="openaiKey"
                    type={showOpenai ? 'text' : 'password'}
                    value={openaiInput}
                    onChange={(e) => setOpenaiInput(e.target.value)}
                    placeholder="sk-..."
                    className="input-field pr-12"
                    disabled={validatingOpenai}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenai(!showOpenai)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showOpenai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveOpenAI}
                    disabled={!openaiInput.trim() || validatingOpenai}
                    className="btn-primary text-sm"
                  >
                    {validatingOpenai ? 'Saving...' : 'Save OpenAI Key'}
                  </button>
                  {isOpenAIConfigured && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditingOpenai(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Atlassian (Confluence)
            </h3>
            {isAtlassianConfigured && !editingAtlassian ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    Connected to {prefs.siteUrl || 'Atlassian'}
                  </span>
                </div>
                {prefs.email && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{prefs.email}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => {
                      setSiteUrl(prefs.siteUrl)
                      setEmail(prefs.email)
                      setEditingAtlassian(true)
                    }}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={async () => {
                      await clearAtlassian()
                      setAtlassianToken('')
                      setEditingAtlassian(true)
                      showToast('Atlassian credentials removed from session', 'info')
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor="siteUrl" className="block text-sm font-medium mb-1">Site URL</label>
                  <input
                    id="siteUrl"
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://your-site.atlassian.net"
                    className="input-field"
                    disabled={validatingAtlassian}
                  />
                </div>
                <div>
                  <label htmlFor="atlassianEmail" className="block text-sm font-medium mb-1">Email</label>
                  <input
                    id="atlassianEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input-field"
                    disabled={validatingAtlassian}
                  />
                </div>
                <div>
                  <label htmlFor="atlassianToken" className="block text-sm font-medium mb-1">API Token</label>
                  <div className="relative">
                    <input
                      id="atlassianToken"
                      type={showAtlassianToken ? 'text' : 'password'}
                      value={atlassianToken}
                      onChange={(e) => setAtlassianToken(e.target.value)}
                      placeholder="Atlassian API token"
                      className="input-field pr-12"
                      disabled={validatingAtlassian}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAtlassianToken(!showAtlassianToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                    >
                      {showAtlassianToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAtlassian}
                    disabled={validatingAtlassian}
                    className="btn-primary text-sm"
                  >
                    {validatingAtlassian ? 'Saving...' : 'Save Atlassian'}
                  </button>
                  {isAtlassianConfigured && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditingAtlassian(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PenTool className="w-4 h-4" /> Figma
              <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Only needed if you add Figma design links when generating. Skip this for Confluence-only runs.
            </p>
            {isFigmaConfigured && !editingFigma ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-green-800 dark:text-green-200">
                    Figma token stored in server session
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => setEditingFigma(true)}>
                    Change
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={async () => {
                      await clearFigma()
                      setFigmaInput('')
                      setEditingFigma(true)
                      showToast('Figma token removed from session', 'info')
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="figmaToken" className="block text-sm font-medium">Personal Access Token</label>
                <div className="relative">
                  <input
                    id="figmaToken"
                    type={showFigma ? 'text' : 'password'}
                    value={figmaInput}
                    onChange={(e) => setFigmaInput(e.target.value)}
                    placeholder="figd_..."
                    className="input-field pr-12"
                    disabled={validatingFigma}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFigma(!showFigma)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showFigma ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveFigma}
                    disabled={validatingFigma}
                    className="btn-primary text-sm"
                  >
                    {validatingFigma ? 'Saving...' : 'Save Figma Token'}
                  </button>
                  {isFigmaConfigured && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditingFigma(false)}>
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="font-medium mb-1">Security Note:</p>
            <p>
              Secrets are sent only when you click Save, then held in a server memory session
              (httpOnly cookie). Preview and Generate calls do not include API tokens in the
              request. Restarting the server clears the session — you will need to Save again.
              Site URL and email may be remembered locally for convenience; tokens are not.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
