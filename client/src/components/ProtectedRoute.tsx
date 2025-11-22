import { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

export default function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading your session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
