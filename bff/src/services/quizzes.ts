import { randomUUID } from 'crypto'

export interface QuizGenerateInput {
  topic: string
  knowledgePoints?: string
  difficulty?: string
}

export function generateQuizMarkdown(input: QuizGenerateInput) {
  const id = randomUUID()
  const topic = input.topic || '示例试卷'
  const kp = input.knowledgePoints || '通用知识点'
  const diff = input.difficulty || 'medium'
  const md = [
    `# ${topic}`,
    ``,
    `难度：${diff}`,
    `知识点：${kp}`,
    ``,
    `## 一、选择题`,
    `1. 题目示例（${kp}）`,
    `   - A. 选项A`,
    `   - B. 选项B`,
    `   - C. 选项C`,
    `   - D. 选项D`,
    ``,
    `## 二、填空题`,
    `1. 题目示例：__________________`,
    ``,
    `## 三、简答题`,
    `1. 请简要说明 ${kp} 的核心概念。`,
    `2. 结合实际，举例说明 ${topic} 的应用。`
  ].join('\n')

  return { id, markdown: md }
}
