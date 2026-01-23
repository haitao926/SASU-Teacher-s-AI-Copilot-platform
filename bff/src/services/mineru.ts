import { randomUUID } from 'crypto'
import config from '../config'

export interface MineruTaskState {
  taskId: string
  status: 'processing' | 'done' | 'error'
  state?: string
  progress?: number
  fullZipUrl?: string
  error?: string
  traceId?: string
}

const base = () => config.mineru.baseUrl.replace(/\/$/, '')

const headers = () => ({
  'content-type': 'application/json',
  Authorization: `Bearer ${config.mineru.apiKey}`
})

export const mineruEnabled = () =>
  !config.mineru.mock && !!config.mineru.apiKey && !!config.mineru.baseUrl

export async function applyUploadUrl(fileName: string, dataId: string) {
  const response = await fetch(`${base()}/file-urls/batch`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      files: [{ name: fileName, data_id: dataId }],
      model_version: 'vlm'
    })
  } as RequestInit)

  if (!response.ok) {
    throw new Error(`申请上传链接失败 (${response.status})`)
  }

  const json = await response.json() as any
  if (json?.code !== 0 || !json?.data?.file_urls?.length) {
    throw new Error(json?.msg ?? '申请上传链接失败')
  }

  return {
    uploadUrl: json.data.file_urls[0] as string,
    batchId: json.data.batch_id as string,
    traceId: json.trace_id as string
  }
}

export function toBuffer(contentBase64: string) {
  const cleaned = contentBase64.replace(/^data:.*;base64,/, '')
  return Buffer.from(cleaned, 'base64')
}

export async function uploadToSignedUrl(uploadUrl: string, buffer: Buffer, mimeType?: string) {
  console.log(`[MinerU] Uploading ${buffer.length} bytes to: ${uploadUrl.substring(0, 50)}...`)
  
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: buffer,
    headers: {
      // Explicitly set Content-Length
      'Content-Length': buffer.length.toString(),
      // Do NOT set Content-Type unless we are sure. S3 often rejects mismatches.
      // If MinerU requires it, we can uncomment next line, but 'SignatureDoesNotMatch' suggests otherwise.
      // 'Content-Type': mimeType || 'application/octet-stream' 
    }
  } as RequestInit)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`上传到 MinerU 存储失败 (${res.status}): ${text}`)
  }
  console.log(`[MinerU] Upload success: ${res.status}`)
}

// Remove createTask completely as it is not needed in V4 batch flow.

export async function getTaskState(batchId: string): Promise<MineruTaskState> {
  // Use the batch result endpoint
  const res = await fetch(`${base()}/extract-results/batch/${batchId}`, {
    method: 'GET',
    headers: headers()
  } as RequestInit)

  if (!res.ok) {
    throw new Error(`查询任务失败 (${res.status})`)
  }

  const json = await res.json() as any
  if (json?.code !== 0) {
    throw new Error(json?.msg ?? '查询失败')
  }

  // Parse batch result structure
  // Response example: { data: { extract_result: [ { state: 'done', full_zip_url: '...', ... } ] } }
  const result = json.data?.extract_result?.[0]
  if (!result) {
    return {
      taskId: batchId,
      status: 'processing', // Assume processing if list is empty or pending
      progress: 10
    }
  }

  const state = result.state as string
  const status: MineruTaskState['status'] =
    state === 'done' ? 'done' : state === 'failed' ? 'error' : 'processing'

  // Estimate progress based on state if detailed progress is missing
  let progress = 0
  if (status === 'done') progress = 100
  else if (status === 'error') progress = 0
  else progress = 50 // Pending/Processing

  return {
    taskId: batchId,
    status,
    state,
    progress,
    fullZipUrl: result.full_zip_url,
    error: result.err_msg,
    traceId: json.trace_id
  }
}

export function generateDataId() {
  return randomUUID()
}

/**
 * Mocks the output of MinerU for a given image, returning a structured JSON
 * with text spans and their bounding boxes.
 * In a real scenario, this would involve the full async upload/poll/download flow.
 */
export async function processImageWithMineru(imageBase64: string): Promise<any> {
  if (config.mineru.mock) {
    console.log('[MinerU] Using mock processing.')
    // This mock data is designed to align with `asset/grading-config.json`
    // It simulates that the student selected B for Q1, C for Q2, and wrote text for Q31.
    return Promise.resolve({
      page_size: { width: 1024, height: 1448 }, // A4-like aspect ratio
      page_idx: 0,
      spans: [
        // --- Mock data for Objective Questions ---
        // Q1: Correct is B, student fills B
        { content: 'B', bbox: [198, 348, 240, 368] },
        // Q2: Correct is C, student fills C
        { content: 'C', bbox: [261, 348, 303, 368] },
        // Q3: Correct is B, student fills A
        { content: 'A', bbox: [324, 348, 366, 368] },
        // Q21: Correct is T, student fills T
        { content: 'T', bbox: [198, 564, 240, 584] },
        // Q22: Correct is T, student fills F
        { content: 'F', bbox: [261, 564, 303, 584] },

        // --- Mock data for Subjective Questions ---
        // Q31: Some handwritten text
        { content: '言之有理', bbox: [130, 740, 300, 760] },
        { content: '即可得分', bbox: [130, 765, 300, 785] },
      ]
    })
  }

  // --- Real MinerU Flow ---
  if (!mineruEnabled()) {
    throw new Error('MinerU service is not configured.')
  }

  // 1. Get upload URL
  const dataId = generateDataId()
  const { uploadUrl, batchId } = await applyUploadUrl(`paper-${dataId}.jpg`, dataId)

  // 2. Upload image
  const buffer = toBuffer(imageBase64)
  await uploadToSignedUrl(uploadUrl, buffer, 'image/jpeg')

  // 3. Poll for result
  let state = await getTaskState(batchId)
  const maxRetries = 30 // 30 retries * 2s = 60s timeout
  let retries = 0
  while (state.status === 'processing' && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 2000))
    state = await getTaskState(batchId)
    retries++
  }

  if (state.status !== 'done' || !state.fullZipUrl) {
    throw new Error(`MinerU task failed or timed out. Status: ${state.status}, Error: ${state.error}`)
  }

  // 4. Download and extract result from zip
  // In a real implementation, we would download the zip, find the JSON file, and parse it.
  // For now, this part is left as an exercise.
  console.log(`[MinerU] Task done. Result zip at: ${state.fullZipUrl}`)
  throw new Error('Real MinerU zip download and parsing not implemented yet.')
}
