import { CredentialsProvider } from './contexts/CredentialsContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import MainApp from './components/MainApp'
import Toast from './components/Toast'

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <CredentialsProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-300">
            <MainApp />
            <Toast />
          </div>
        </CredentialsProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
