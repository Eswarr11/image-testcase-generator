import React from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useToast } from '../contexts/ToastContext'
import { ToastType } from '../types'

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  info: <Info className="w-5 h-5" />,
}

const toastStyles: Record<ToastType, string> = {
  success: 'bg-green-500 text-white',
  error: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-blue-500 text-white',
}

export default function Toast() {
  const { toasts, hideToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            ${toastStyles[toast.type]}
            min-w-[300px] max-w-[400px] px-4 py-3 rounded-lg shadow-lg
            flex items-start space-x-3
            animate-slide-up
            cursor-pointer hover:opacity-90 transition-opacity
          `}
          onClick={() => hideToast(toast.id)}
        >
          <div className="flex-shrink-0 mt-0.5">
            {toastIcons[toast.type]}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">
              {toast.message}
            </p>
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation()
              hideToast(toast.id)
            }}
            className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
