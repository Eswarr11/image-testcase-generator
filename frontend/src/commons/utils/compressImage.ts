/** Vercel Functions hard-cap request bodies at 4.5MB; leave headroom for JSON/prompt. */
const TOTAL_BUDGET_CHARS = Math.floor(3.2 * 1024 * 1024)
const PER_IMAGE_BUDGET_CHARS = Math.floor(700 * 1024)
const MAX_EDGE_PX = 1600
const MIN_EDGE_PX = 800
const QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42]

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image ${file.name}`))
    }
    img.src = url
  })
}

function scaledSize(width: number, height: number, maxEdge: number): { w: number; h: number } {
  const long = Math.max(width, height)
  if (long <= maxEdge) return { w: width, h: height }
  const scale = maxEdge / long
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  }
}

function canvasToJpegDataUrl(
  img: HTMLImageElement,
  maxEdge: number,
  quality: number
): string {
  const { w, h } = scaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  // Flatten transparency onto white for JPEG
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

/** Compress a single image to a JPEG data URL under `budgetChars`. */
export async function compressImageToDataUrl(
  file: File,
  budgetChars = PER_IMAGE_BUDGET_CHARS
): Promise<string> {
  const img = await loadImage(file)
  let maxEdge = MAX_EDGE_PX
  let best = ''

  while (maxEdge >= MIN_EDGE_PX) {
    for (const quality of QUALITIES) {
      await yieldToMain()
      const dataUrl = canvasToJpegDataUrl(img, maxEdge, quality)
      best = dataUrl
      if (dataUrl.length <= budgetChars) return dataUrl
    }
    maxEdge = Math.floor(maxEdge * 0.75)
  }

  return best
}

/**
 * Compress files so combined base64 data-URL length stays under the Vercel body budget.
 * Per-image budget shrinks when many files are attached.
 */
export async function compressImagesForGenerate(files: File[]): Promise<string[]> {
  if (files.length === 0) return []

  const perImageBudget = Math.min(
    PER_IMAGE_BUDGET_CHARS,
    Math.floor(TOTAL_BUDGET_CHARS / files.length)
  )

  const results: string[] = []
  let used = 0

  for (const file of files) {
    const remaining = TOTAL_BUDGET_CHARS - used
    const budget = Math.min(perImageBudget, remaining)
    if (budget < 50_000) {
      throw new Error(
        'Too many or too large images for hosting limits. Try fewer images.'
      )
    }
    const dataUrl = await compressImageToDataUrl(file, budget)
    results.push(dataUrl)
    used += dataUrl.length
  }

  return results
}
