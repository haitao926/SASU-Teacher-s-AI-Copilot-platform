import dotenv from 'dotenv'
import prisma from './utils/prisma'
import { hashPassword } from './utils/password'

dotenv.config()

async function main() {
  const tenantId = 'default'

  // --- Admin Account ---
  let admin = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashPassword('admin123'),
        name: '系统管理员',
        role: 'ADMIN'
      }
    })
    console.log('Created admin account (admin/admin123)')
  } else if (!admin.password.startsWith('scrypt:')) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashPassword('admin123') }
    })
    console.log('Updated admin password to hashed format')
  }

  // --- Seed Teacher Accounts ---
  const teachers = [
    { username: 'teacher1', name: '张老师', subject: 'Math', password: 'password123' },
    { username: 'teacher2', name: '李老师', subject: 'English', password: 'password123' },
    { username: 'teacher3', name: '王老师', subject: 'Physics', password: 'password123' }
  ]

  for (const t of teachers) {
    const exists = await prisma.user.findUnique({ where: { username: t.username } })
    if (!exists) {
      await prisma.user.create({
        data: {
          username: t.username,
          password: hashPassword(t.password),
          name: t.name,
          role: 'TEACHER'
        }
      })
      console.log(`Created teacher: ${t.username} (${t.name})`)
    } else if (!exists.password.startsWith('scrypt:')) {
      await prisma.user.update({
        where: { id: exists.id },
        data: { password: hashPassword(t.password) }
      })
      console.log(`Updated teacher password to hashed format: ${t.username}`)
    }
  }

  // --- Seed Mock OCR Tasks for Teachers ---
  // Teacher 1 (Math)
  const teacher1 = await prisma.user.findUnique({ where: { username: 'teacher1' } })
  if (teacher1) {
    const ocrCount = await prisma.ocrTask.count({ where: { userId: teacher1.id } })
    if (ocrCount === 0) {
      await prisma.ocrTask.createMany({
        data: [
          {
            id: 'mock-task-1',
            userId: teacher1.id,
            fileName: '初二数学期末试卷.pdf',
            status: 'done',
            source: 'mock',
            result: '# 初二数学期末试卷\n\n## 一、选择题\n1. 已知 $y=kx+b$ ...',
            createdAt: new Date(Date.now() - 86400000) // 1 day ago
          },
          {
            id: 'mock-task-2',
            userId: teacher1.id,
            fileName: '几何辅助线专题.png',
            status: 'processing',
            source: 'mock',
            createdAt: new Date(Date.now() - 3600000) // 1 hour ago
          }
        ]
      })
      console.log('Seeded OCR tasks for teacher1')
    }
  }

  // Teacher 3 (Physics) - Smart Lens History
  const teacher3 = await prisma.user.findUnique({ where: { username: 'teacher3' } })
  if (teacher3) {
    // Note: Smart Lens history is currently stored in LocalStorage on frontend, 
    // but if we move it to DB later, we would seed it here.
    // For now, we seed a Doc Parser task.
    const ocrCount = await prisma.ocrTask.count({ where: { userId: teacher3.id } })
    if (ocrCount === 0) {
      await prisma.ocrTask.create({
        data: {
          id: 'mock-task-3',
          userId: teacher3.id,
          fileName: '八年级物理力学教案.docx',
          status: 'error',
          source: 'mock',
          createdAt: new Date()
        }
      })
      console.log('Seeded OCR tasks for teacher3')
    }
  }

  // Seed Announcements
  const count = await prisma.announcement.count()
  if (count === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          title: 'Welcome to IAI Copilot',
          content: 'This is the first announcement from the new database!',
          tag: 'System',
          tagType: 'success',
          pinned: true
        }
      ]
    })
    console.log('Sample announcements created')
  }

  // Seed Tools
  const tools = [
    {
      code: 'ocr',
      name: '智能 OCR',
      description: '提取图片文字并结构化输出',
      icon: 'mdi:ocr',
      route: '/apps/ocr',
      category: 'content',
      tags: JSON.stringify(['ocr', 'image']),
      status: 'ACTIVE',
      isEnabled: true,
      order: 10
    },
    {
      code: 'chat',
      name: '教研对话',
      description: '备课/教研场景对话助手',
      icon: 'mdi:chat-processing',
      route: '/apps/chat',
      category: 'content',
      tags: JSON.stringify(['chat', 'qa']),
      status: 'ACTIVE',
      isEnabled: true,
      order: 20
    },
    {
      code: 'ai-flowchart',
      name: 'AI 流程图助手',
      description: '输入自然语言生成 Mermaid 流程图',
      icon: 'mdi:graph',
      route: '/apps/flowchart',
      category: 'efficiency',
      tags: JSON.stringify(['mermaid', 'flowchart']),
      status: 'ACTIVE',
      isEnabled: true,
      order: 30
    },
    {
      code: 'quiz-grading',
      name: '智能阅卷',
      description: '上传答案与试卷，自动判分导出成绩',
      icon: 'mdi:checkbox-marked-outline',
      route: '/apps/quiz-grading',
      category: 'assessment',
      tags: JSON.stringify(['grading', 'exam']),
      status: 'ACTIVE',
      isEnabled: true,
      order: 40
    },
    {
      code: 'quiz-builder',
      name: '智能组卷',
      description: '按知识点/难度生成试卷并导出',
      icon: 'mdi:file-document-edit',
      route: '/apps/quiz-builder',
      category: 'assessment',
      tags: JSON.stringify(['quiz', 'exam', 'builder']),
      status: 'ACTIVE',
      isEnabled: true,
      order: 50
    }
  ]

  for (const tool of tools) {
    await prisma.tool.upsert({
      where: { tenantId_code: { tenantId, code: tool.code } },
      update: {
        name: tool.name,
        description: tool.description,
        icon: tool.icon,
        route: tool.route,
        category: tool.category,
        tags: tool.tags,
        status: tool.status,
        isEnabled: tool.isEnabled,
        order: tool.order
      },
      create: { tenantId, ...tool }
    })
  }
  console.log('Tools upserted')

  // Seed Groups & Entries
  const groupCount = await prisma.group.count()
  if (groupCount === 0) {
    const aiGroup = await prisma.group.create({
      data: { name: 'AI 创意工坊', icon: 'mdi:robot', order: 1 }
    })
    const teachGroup = await prisma.group.create({
      data: { name: '教学管理', icon: 'mdi:school', order: 2 }
    })

    await prisma.entry.createMany({
      data: [
        {
          name: '智能 OCR',
          description: '提取图片中的文字',
          icon: 'gradient-blue',
          url: '/apps/ocr',
          status: 'available',
          groupId: aiGroup.id,
          tags: 'AI,工具',
          featured: true,
          order: 1
        },
        {
          name: '教案设计',
          description: 'AI 辅助生成教案',
          icon: 'gradient-green',
          url: '/apps/lesson-plan',
          status: 'available',
          groupId: teachGroup.id,
          tags: '教学,备课',
          featured: true,
          order: 1
        }
      ]
    })
    console.log('Sample groups and entries created')
  }

  // Seed Assets
  const assetsCount = await prisma.asset.count()
  if (assetsCount === 0 && admin) {
    const flowchartTool = await prisma.tool.findUnique({
      where: { tenantId_code: { tenantId, code: 'ai-flowchart' } }
    })

    await prisma.asset.create({
      data: {
        tenantId,
        title: '冒泡排序流程图示例',
        summary: '七年级算法示例，演示冒泡排序步骤',
        content: 'graph TD;\n  A[开始] --> B{是否有序};\n  B -- 否 --> C[遍历数组比较相邻元素];\n  C --> D[若逆序则交换];\n  D --> E[遍历结束];\n  E --> B;\n  B -- 是 --> F[结束];',
        metadata: JSON.stringify({ subject: 'CS', grade: '7', size: 180 }),
        type: 'mermaid',
        tags: JSON.stringify(['algorithm', 'flowchart', 'bubble-sort']),
        version: 1,
        authorId: admin.id,
        toolId: flowchartTool?.id,
        visibility: 'INTERNAL'
      }
    })
    console.log('Sample asset created')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
