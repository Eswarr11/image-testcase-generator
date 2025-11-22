import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import ApiKeySection from './ApiKeySection'
import TestCaseGenerator from './TestCaseGenerator'

export default function AuthenticatedApp() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-300">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Header />
        
        <main className="space-y-6">
          {user && !user.hasApiKey && <ApiKeySection />}
          <TestCaseGenerator />
        </main>
      </div>
    </div>
  )
}
