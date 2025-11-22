import { ThemeProvider } from './contexts/ThemeContext'
import { ApiKeyProvider } from './contexts/ApiKeyContext'
import { ToastProvider } from './contexts/ToastContext'
import Header from './components/Header'
import ApiKeySection from './components/ApiKeySection'
import TestCaseGenerator from './components/TestCaseGenerator'
import Toast from './components/Toast'

function App() {
  return (
    <ThemeProvider>
      <ApiKeyProvider>
        <ToastProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-300">
            <div className="container mx-auto px-4 py-6 max-w-4xl">
              <Header />
              
              <main className="space-y-6">
                <ApiKeySection />
                <TestCaseGenerator />
              </main>
            </div>
            
            <Toast />
          </div>
        </ToastProvider>
      </ApiKeyProvider>
    </ThemeProvider>
  )
}

export default App
