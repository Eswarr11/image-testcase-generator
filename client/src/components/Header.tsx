import { Sun, Moon, Settings, Rocket, LogOut, User } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const { setTheme, isDark } = useTheme()
  const { user, logout } = useAuth()

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <header className="card p-6 mb-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
              Jira Test Case Generator
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI-powered test case generation with image analysis
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* User info */}
          {user && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                <User className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                {user.email}
              </span>
            </div>
          )}
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-blue-600" />
            )}
          </button>
          
          <button
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors duration-200"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 transition-colors duration-200"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>
    </header>
  )
}
