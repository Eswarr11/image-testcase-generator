import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { UploadedFile } from '../types'
import { useToast } from '../contexts/ToastContext'

interface ImageUploadProps {
  uploadedFiles: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  disabled?: boolean
}

const MAX_FILES = 9
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function ImageUpload({ uploadedFiles, onFilesChange, disabled }: ImageUploadProps) {
  const { showToast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const createImagePreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string)
        } else {
          reject(new Error('Failed to read file'))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (isProcessing) return
    
    setIsProcessing(true)
    const newFiles: UploadedFile[] = []
    
    try {
      for (const file of acceptedFiles) {
        if (uploadedFiles.length + newFiles.length >= MAX_FILES) {
          showToast(`Maximum ${MAX_FILES} images allowed`, 'warning')
          break
        }

        if (file.size > MAX_FILE_SIZE) {
          showToast(`File ${file.name} is too large. Maximum size is 10MB.`, 'error')
          continue
        }

        try {
          const id = Math.random().toString(36).substring(2, 9)
          const preview = await createImagePreview(file)
          
          newFiles.push({ file, preview, id })
        } catch (error) {
          console.error('Error creating preview for file:', file.name, error)
          showToast(`Failed to create preview for ${file.name}`, 'error')
        }
      }

      if (newFiles.length > 0) {
        onFilesChange([...uploadedFiles, ...newFiles])
        showToast(`${newFiles.length} image(s) uploaded successfully`, 'success')
      }
    } finally {
      setIsProcessing(false)
    }
  }, [uploadedFiles, onFilesChange, showToast, isProcessing])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    disabled: (disabled ?? false) || isProcessing,
    multiple: true,
  })

  const removeFile = (id: string) => {
    onFilesChange(uploadedFiles.filter(f => f.id !== id))
  }

  const clearAllFiles = () => {
    onFilesChange([])
    showToast('All images cleared', 'info')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 text-sm font-medium">
          <ImageIcon className="w-4 h-4 text-primary-600" />
          <span>Images (Optional)</span>
        </label>
        
        <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
          <span>{uploadedFiles.length}/{MAX_FILES} images</span>
          {uploadedFiles.length > 0 && (
            <button
              onClick={clearAllFiles}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {isProcessing ? (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary-600 animate-spin" />
            <p className="text-primary-600 font-medium">Processing images...</p>
          </>
        ) : (
          <>
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-primary-600' : 'text-gray-400'}`} />
            
            {isDragActive ? (
              <p className="text-primary-600 font-medium">Drop the images here...</p>
            ) : (
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">
                  Drag & drop images here, or click to browse
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  PNG, JPG, JPEG, GIF, WebP • Max {MAX_FILES} files • Max 10MB each
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="relative">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                <img
                  src={file.preview}
                  alt={file.file.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent && !parent.querySelector('.fallback-icon')) {
                      const fallback = document.createElement('div')
                      fallback.className = 'fallback-icon w-full h-full flex items-center justify-center text-gray-400'
                      fallback.innerHTML = '🖼️'
                      parent.appendChild(fallback)
                    }
                  }}
                  loading="lazy"
                />
              </div>
              
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors duration-200"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
              
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate" title={file.file.name}>
                {file.file.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
