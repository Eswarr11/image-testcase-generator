import { useState } from 'react'
import { Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useApiKey } from '../contexts/ApiKeyContext'
import { useToast } from '../contexts/ToastContext'

export default function ApiKeySection() {
  const { setApiKey, isConfigured, clearApiKey } = useApiKey()
  const { showToast } = useToast()
  const [showInput, setShowInput] = useState(!isConfigured)
  const [inputValue, setInputValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const validateApiKey = (key: string): boolean => {
    return key.trim().startsWith('sk-') && key.trim().length > 20
  }

  const handleSaveApiKey = async () => {
    const trimmedKey = inputValue.trim()
    
    if (!trimmedKey) {
      showToast('Please enter an API key', 'warning')
      return
    }

    if (!validateApiKey(trimmedKey)) {
      showToast('Invalid API key format. OpenAI API keys start with "sk-"', 'error')
      return
    }

    setIsValidating(true)
    
    try {
      // Test the API key with a minimal request
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${trimmedKey}`,
        },
      })

      if (testResponse.ok) {
        setApiKey(trimmedKey)
        setInputValue('')
        setShowInput(false)
        showToast('API key saved and validated successfully!', 'success')
      } else {
        throw new Error('Invalid API key')
      }
    } catch (error) {
      showToast('Invalid API key. Please check your key and try again.', 'error')
    } finally {
      setIsValidating(false)
    }
  }

  const handleChangeApiKey = () => {
    setShowInput(true)
    setInputValue('')
  }

  const handleClearApiKey = () => {
    clearApiKey()
    setShowInput(true)
    showToast('API key removed', 'info')
  }

  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-center space-x-2 mb-4">
        <Key className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold">OpenAI API Configuration</h2>
      </div>

      {isConfigured && !showInput ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              API Key configured
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleChangeApiKey}
              className="btn-secondary text-sm"
            >
              Change API Key
            </button>
            <button
              onClick={handleClearApiKey}
              className="text-sm px-3 py-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            >
              Remove Key
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              Please configure your OpenAI API key to generate test cases
            </span>
          </div>

          <div className="space-y-3">
            <label htmlFor="apiKey" className="block text-sm font-medium">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="sk-..."
                className="input-field pr-12"
                disabled={isValidating}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleSaveApiKey}
                disabled={!inputValue.trim() || isValidating}
                className="btn-primary flex items-center space-x-2"
              >
                {isValidating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Validating...</span>
                  </>
                ) : (
                  <span>Save API Key</span>
                )}
              </button>
              
              {isConfigured && (
                <button
                  onClick={() => setShowInput(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <p className="font-medium mb-1">Security Note:</p>
            <p>Your API key is stored locally in your browser and never sent to our servers. All requests go directly from your browser to OpenAI's API.</p>
          </div>
        </div>
      )}
    </div>
  )
}
