import { useState, useEffect } from 'react'
import { Key, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function ApiKeySection() {
  const { user, updateApiKey, getApiKey } = useAuth()
  const { showToast } = useToast()
  const [showInput, setShowInput] = useState(!user?.hasApiKey)
  const [inputValue, setInputValue] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null)

  useEffect(() => {
    if (user?.hasApiKey) {
      loadCurrentApiKey()
    }
  }, [user?.hasApiKey])

  const loadCurrentApiKey = async () => {
    const apiKey = await getApiKey()
    setCurrentApiKey(apiKey)
  }

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
        const success = await updateApiKey(trimmedKey)
        if (success) {
          setInputValue('')
          setShowInput(false)
          setCurrentApiKey(trimmedKey)
        }
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

  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-center space-x-2 mb-4">
        <Key className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold">OpenAI API Configuration</h2>
      </div>

      {user?.hasApiKey && !showInput ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              API Key configured
            </span>
          </div>
          
          {currentApiKey && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current API Key:</p>
              <div className="font-mono text-sm text-gray-800 dark:text-gray-200">
                {showKey ? currentApiKey : `${currentApiKey.substring(0, 7)}...${currentApiKey.substring(currentApiKey.length - 4)}`}
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="ml-2 text-primary-600 hover:text-primary-700"
                >
                  {showKey ? <EyeOff className="w-4 h-4 inline" /> : <Eye className="w-4 h-4 inline" />}
                </button>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleChangeApiKey}
              className="btn-secondary text-sm"
            >
              Change API Key
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
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 flex items-center space-x-2"
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
              
              {user?.hasApiKey && (
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
            <p>Your API key is stored securely in your account and never shared with others. All requests go directly from your browser to OpenAI's API.</p>
          </div>
        </div>
      )}
    </div>
  )
}