import config from '../config'

interface GradeRequest {
  imageBase64: string
  questionText?: string
  correctAnswer?: string
  maxPoints?: number
  ocrText?: string // Optional OCR text from MinerU/Frontend
}

interface GradeResult {
  score: number
  feedback: string
  studentAnswer: string
}

// Helper to call VLM (Moonshot/OpenAI Vision)
async function gradeWithVLM(req: GradeRequest): Promise<GradeResult | null> {
  if (!config.vlm.enabled || !config.vlm.apiKey) return null

  try {
    const { imageBase64, questionText, correctAnswer, maxPoints } = req
    
    // Moonshot / OpenAI Vision Format
    const messages = [
        {
            role: "system",
            content: "你是 Kimi，由 Moonshot AI 提供的人工智能助手。你也是一位专业的阅卷老师。请根据图片中的学生手写答案、题目描述和标准答案进行评分。"
        },
        {
            role: "user",
            content: [
                {
                    type: "image_url",
                    image_url: {
                        url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                    }
                },
                {
                    type: "text",
                    text: `题目: "${questionText || ''}"\n标准答案/评分标准: "${correctAnswer || ''}"\n满分: ${maxPoints}\n\n请分析图片中的手写内容，判断对错并打分。\n请只返回纯 JSON 格式：{ "studentAnswer": "提取的学生作答", "score": number, "feedback": "简短评语" }`
                }
            ]
        }
    ]

    const response = await fetch(`${config.vlm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.vlm.apiKey}`
        },
        body: JSON.stringify({
            model: config.vlm.model,
            messages: messages,
            temperature: 0.3,
            max_tokens: 1024,
            response_format: { type: "json_object" } // Moonshot supports JSON mode
        })
    })

    if (!response.ok) {
        console.warn('VLM API Error:', response.status, await response.text())
        return null
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    try {
        const result = JSON.parse(content)
        return {
            score: Number(result.score) || 0,
            feedback: result.feedback || 'VLM 评分完成',
            studentAnswer: result.studentAnswer || '(VLM Extracted)'
        }
    } catch {
        return {
            score: 0,
            feedback: content, // Fallback if not JSON
            studentAnswer: '(VLM Analysis)'
        }
    }

  } catch (e) {
    console.error('VLM Call Failed:', e)
    return null
  }
}

export async function gradeImage(req: GradeRequest): Promise<GradeResult> {
  const { imageBase64, questionText, correctAnswer, maxPoints = 5, ocrText } = req

  if (config.llm.provider === 'mock') {
    // ... (Mock Logic unchanged) ...
    const expected = (correctAnswer ?? '').toString().trim()
    if (expected) {
        const isCorrect = Math.random() > 0.2
        return {
            score: isCorrect ? maxPoints : 0,
            feedback: isCorrect ? '回答正确' : '答案错误（Mock）',
            studentAnswer: isCorrect ? expected : '（Mock）'
        }
    }
    return {
        score: Math.floor(Math.random() * (maxPoints + 1)),
        feedback: 'Mock feedback',
        studentAnswer: ocrText || 'Mock Answer'
    }
  }

  // --- Real Logic ---
  
  // 1. If OCR text is empty or very short, relying on Text LLM is risky. 
  //    Or if user explicitly wants VLM check.
  //    Let's try VLM first if enabled (it sees the original image which is better for handwriting).
  if (config.vlm.enabled) {
      console.log('Attempting VLM grading...')
      const vlmResult = await gradeWithVLM(req)
      if (vlmResult) {
          console.log('VLM Grading Success:', vlmResult)
          return vlmResult
      }
      console.warn('VLM failed or returned null, falling back to DeepSeek (Text)...')
  }

  // 2. Fallback to DeepSeek (Text-Only Reasoner) using OCR Text
  try {
    const systemPrompt = `You are an AI Grader...` // (Keep existing prompt logic)
    // ...
    // Using existing implementation for DeepSeek text call
    // ...
    // Copying the existing logic here for the 'else' path or reconstruction
    
    const messages: any[] = [
        { role: "system", content: `You are an AI Grader. Question: "${questionText}". Rubric: "${correctAnswer}". Max: ${maxPoints}. Student Text: "${ocrText}"` },
        { role: "user", content: "Grade this." }
    ]

    const payload = {
      model: config.llm.model,
      messages: messages,
      response_format: { type: "json_object" }
    }

    const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.llm.apiKey}`
        },
        body: JSON.stringify(payload)
    })
    
    // ... handle response ...
    const data = await response.json()
    const content = data.choices[0].message.content
    const result = JSON.parse(content)
    
    return {
        score: Number(result.score) || 0,
        feedback: result.feedback,
        studentAnswer: result.studentAnswer || ocrText || ''
    }

  } catch (error: any) {
    console.error('Grading error:', error)
    return {
        score: 0,
        feedback: 'AI 评分失败: ' + error.message,
        studentAnswer: ocrText || ''
    }
  }
}
