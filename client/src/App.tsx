import { useState } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginForm from './components/LoginForm'
import AuthenticatedApp from './components/AuthenticatedApp'
import Toast from './components/Toast'

function App() {
  const [isRegisterMode, setIsRegisterMode] = useState(false)

  const handleToggleMode = () => {
    setIsRegisterMode(!isRegisterMode)
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-300">
            <ProtectedRoute
              fallback={
                <LoginForm 
                  onToggleMode={handleToggleMode}
                  isRegisterMode={isRegisterMode}
                />
              }
            >
              <AuthenticatedApp />
            </ProtectedRoute>
            
            <Toast />
          </div>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

export default App
