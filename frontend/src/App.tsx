import { CredentialsProvider } from '@/commons/context/CredentialsContext'
import { ThemeProvider } from '@/commons/context/ThemeContext'
import { ToastProvider } from '@/commons/context/ToastContext'
import MainApp from '@/commons/components/MainApp'
import Toast from '@/commons/components/Toast'

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
