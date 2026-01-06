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
