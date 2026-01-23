// src/utils/coordinate-mapping.ts

/**
 * 坐标映射工具
 * 用于将 MinerU/OCR 返回的带坐标文本块 (spans/blocks) 归属到 预设的题目区域 (ROI) 中。
 */

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

// MinerU / OCR 返回的单个文本块结构
export interface OcrSpan {
  id?: string | number
  content: string
  bbox: [number, number, number, number] // [x, y, w, h] 或 [x1, y1, x2, y2] - 需标准化，这里假设为 [x, y, w, h]
  type?: 'text' | 'handwriting' | 'formula'
}

export interface OcrPageResult {
  width: number
  height: number
  spans: OcrSpan[]
}

// 题目区域配置 (来自 Dashboard.vue 的 QuestionRegion)
export interface QuestionRoi {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
  // 可选：排除区域 (例如题干部分不需要识别，只看作答区)
  exclude?: BBox[] 
}

// 归属结果
export interface MappedResult {
  questionId: string
  label: string
  extractedText: string
  segments: OcrSpan[] // 归属到该题的所有片段
  confidence: number // 简单的置信度，例如覆盖率
}

/**
 * 判断两个矩形是否相交 (IOU 预判)
 */
function isIntersecting(r1: BBox, r2: BBox): boolean {
  return !(r2.x > r1.x + r1.w || 
           r2.x + r2.w < r1.x || 
           r2.y > r1.y + r1.h || 
           r2.y + r2.h < r1.y);
}

/**
 * 计算矩形中心点
 */
function getCenter(bbox: BBox) {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2
  }
}

/**
 * 核心映射函数
 * @param ocrResult 整页 OCR 结果
 * @param questions 题目区域列表
 * @param options 配置项
 *    - useCenterPoint: 是否仅通过中心点判断归属 (简单模式)
 *    - tolerance: 容差 (像素)，允许文字稍微超出框一点点
 */
export function mapTextToQuestions(
  ocrResult: OcrPageResult, 
  questions: QuestionRoi[],
  options: { useCenterPoint?: boolean, tolerance?: number } = { useCenterPoint: true, tolerance: 5 }
): MappedResult[] {
  
  const results: Map<string, MappedResult> = new Map()

  // 初始化结果集
  questions.forEach(q => {
    results.set(q.id, {
      questionId: q.id,
      label: q.label,
      extractedText: '',
      segments: [],
      confidence: 1.0
    })
  })

  // 遍历所有 OCR 文本块
  ocrResult.spans.forEach(span => {
    const spanBox: BBox = {
      x: span.bbox[0],
      y: span.bbox[1],
      w: span.bbox[2],
      h: span.bbox[3]
    }

    const spanCenter = getCenter(spanBox)
    let bestMatchId: string | null = null
    
    // 简单模式：看中心点落在哪个 Question ROI 里
    // 进阶模式：可以计算 IoU 或包含面积
    
    for (const q of questions) {
      // 考虑容差
      const roi: BBox = {
        x: q.x - (options.tolerance || 0),
        y: q.y - (options.tolerance || 0),
        w: q.w + (options.tolerance || 0) * 2,
        h: q.h + (options.tolerance || 0) * 2
      }

      if (options.useCenterPoint) {
        if (
          spanCenter.x >= roi.x && 
          spanCenter.x <= roi.x + roi.w &&
          spanCenter.y >= roi.y && 
          spanCenter.y <= roi.y + roi.h
        ) {
          bestMatchId = q.id
          break // 找到即止 (假设题目不重叠)
        }
      } else {
        // 全包含检测
        if (
          spanBox.x >= roi.x && 
          spanBox.x + spanBox.w <= roi.x + roi.w &&
          spanBox.y >= roi.y && 
          spanBox.y + spanBox.h <= roi.y + roi.h
        ) {
          bestMatchId = q.id
          break
        }
      }
    }

    if (bestMatchId) {
      const match = results.get(bestMatchId)
      if (match) {
        match.segments.push(span)
      }
    }
  })

  // 后处理：对每个题目内的文本块进行排序并合并
  const finalOutput: MappedResult[] = []
  
  results.forEach(item => {
    if (item.segments.length > 0) {
      // 排序策略：先按 Y 轴 (行)，再按 X 轴 (列)
      // 简单的行判定：如果 Y 差值小于行高的一半，视为同一行
      item.segments.sort((a, b) => {
        const aY = a.bbox[1]
        const bY = b.bbox[1]
        const aH = a.bbox[3]
        
        // 允许 50% 行高的误差视为同一行
        if (Math.abs(aY - bY) < aH * 0.5) {
          return a.bbox[0] - b.bbox[0] // 同行按 X 排序
        }
        return aY - bY // 不同行按 Y 排序
      })

      // 合并文本
      item.extractedText = item.segments.map(s => s.content).join(' ') // 可以根据距离决定是否加空格
    }
    finalOutput.push(item)
  })

  return finalOutput
}
