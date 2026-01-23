import * as pdfjsLib from 'pdfjs-dist'

// Use a static worker import or ensure the worker is set up correctly in the main entry
// We rely on the worker being set globally in App.vue or here.
// Re-setting it here to be safe and independent if possible, but usually global config is fine.
// Note: We won't import the worker here to avoid double-loading if App.vue does it.
// Instead, we assume App.vue or main.ts has set GlobalWorkerOptions.workerSrc

export interface PDFPageImage {
  dataUrl: string
  pageIndex: number
}

export async function pdfToImages(
  file: File, 
  onProgress: (current: number, total: number) => void
): Promise<PDFPageImage[]> {
  const arrayBuffer = await file.arrayBuffer()
  
  // Directly use the promise, keeping the object completely out of Vue's scope
  const loadingTask = pdfjsLib.getDocument(arrayBuffer)
  const pdf = await loadingTask.promise
  
  const totalPages = pdf.numPages
  const results: PDFPageImage[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress(i, totalPages)
    
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 }) // High res for OCR
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) continue
    
    canvas.width = viewport.width
    canvas.height = viewport.height
    
    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    
    results.push({
      dataUrl,
      pageIndex: i
    })
    
    // Cleanup
    // page.cleanup() // Optional, depending on memory
  }
  
  return results
}
