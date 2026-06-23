import { useApiKey } from '../contexts/ApiKeyContext'
import Header from './Header'
import ApiKeySection from './ApiKeySection'
import SystemPromptSection from './SystemPromptSection'
import TestCaseGenerator from './TestCaseGenerator'

export default function MainApp() {
  const { isConfigured } = useApiKey()

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Header />

      <main className="space-y-6">
        {!isConfigured && <ApiKeySection />}
        <SystemPromptSection />
        <TestCaseGenerator />
      </main>
    </div>
  )
}
