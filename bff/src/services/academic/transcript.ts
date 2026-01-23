import prisma from '../../utils/prisma'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'

// Font path detection for local dev on macOS
const FONT_FALLBACK = 'Helvetica'

interface TranscriptOptions {
  subjects?: string[]
  extraColumns?: string[]
  hideEmptyRows?: boolean
}

export async function searchStudents(tenantId: string, query: string) {
  if (!query) return []
  return prisma.student.findMany({
    where: {
      tenantId,
      OR: [
        { name: { contains: query } },
        { studentId: { contains: query } }
      ]
    },
    take: 10
  })
}

export async function getStudentScores(tenantId: string, studentId: string) {
  return prisma.score.findMany({
    where: { tenantId, studentId },
    include: { exam: true },
    orderBy: {
      exam: { date: 'desc' }
    }
  })
}

export async function listExams(tenantId: string) {
  const exams = await prisma.exam.findMany({
    where: { tenantId },
    include: {
      _count: {
        select: { scores: true }
      }
    },
    orderBy: { date: 'desc' }
  })
  
  return exams.map(e => ({
    id: e.id,
    name: e.name,
    date: e.date,
    type: e.type,
    scoreCount: e._count.scores
  }))
}

export async function deleteExam(tenantId: string, examId: string) {
  return prisma.$transaction(async (tx) => {
    const exam = await tx.exam.findUnique({ where: { id: examId } })
    if (!exam || exam.tenantId !== tenantId) throw new Error('Exam not found')
    await tx.score.deleteMany({ where: { examId } })
    return tx.exam.delete({ where: { id: examId } })
  })
}

// --- Shared Data Preparation ---
async function prepareTranscriptData(
  tenantId: string, 
  studentId: string, 
  examIds?: string[],
  options?: TranscriptOptions
) {
  // 1. Fetch Student
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student || student.tenantId !== tenantId) throw new Error('Student not found')

  const classCount = await prisma.student.count({
    where: { tenantId, class: student.class }
  })

  // 2. Fetch Scores
  const whereScore: any = { tenantId, studentId }
  if (examIds && examIds.length > 0) {
    whereScore.examId = { in: examIds }
  }

  const scores = await prisma.score.findMany({
    where: whereScore,
    include: { exam: true },
    orderBy: [
      { exam: { date: 'asc' } },
      { subject: 'asc' }
    ]
  })

  if (scores.length === 0) throw new Error('No scores found for the selected criteria')

  // 3. Columns
  const targetSubjects = options?.subjects || ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '技术']
  const extraCols = options?.extraColumns || ['总分', '名次']
  
  const columns = [
    { header: '考试名称', key: 'name' },
    ...targetSubjects.map(s => ({ header: s, key: s })),
    ...extraCols.map(c => ({ header: c, key: c }))
  ]

  // 4. Rows
  const examMap = new Map<string, any>()
  scores.forEach(s => {
    if (!examMap.has(s.examId)) {
      examMap.set(s.examId, { info: s.exam, scores: {} })
    }
    const entry = examMap.get(s.examId)
    entry.scores[s.subject] = s.value
    if (s.details) {
      try {
        const meta = JSON.parse(s.details)
        Object.assign(entry.scores, meta)
      } catch(e) {}
    }
  })

  const sortedExams = Array.from(examMap.values()).sort((a, b) => new Date(a.info.date).getTime() - new Date(b.info.date).getTime())

  // 5. Calculate Total Students per Exam (for Rank denominator)
  // We use Promise.all to fetch counts in parallel
  const examStudentCounts = new Map<string, number>()
  await Promise.all(sortedExams.map(async (item) => {
    // Count distinct students who have scores for this exam
    // Note: This counts 'participation', which is accurate for 'Total Students'.
    // However, if it's a Grade exam, it counts Grade. If Class exam, counts Class.
    const count = await prisma.score.groupBy({
      by: ['studentId'],
      where: { 
        tenantId, 
        examId: item.info.id 
      }
    })
    examStudentCounts.set(item.info.id, count.length)
  }))

  return { student, classCount, columns, sortedExams, examStudentCounts }
}

// --- Excel Generator ---
export async function generateTranscriptExcel(
  tenantId: string, 
  studentId: string, 
  examIds?: string[],
  options?: TranscriptOptions
): Promise<Buffer> {
  const { student, classCount, columns, sortedExams, examStudentCounts } = await prepareTranscriptData(tenantId, studentId, examIds, options)

  const aoa: any[][] = []
  
  // Header Info
  aoa.push(['上海科技大学附属学校（中学） 成绩单'])
  aoa.push([`姓名: ${student.name}`, `班级: ${student.class}`, `学号: ${student.studentId}`, `班级人数: ${classCount}`])
  aoa.push([]) 

  // Table Header
  aoa.push(columns.map(c => c.header))

  // Table Data
  sortedExams.forEach(item => {
    const totalCount = examStudentCounts.get(item.info.id) || 0
    const row = columns.map(col => {
      if (col.key === 'name') return item.info.name
      
      let val = item.scores[col.key] ?? ''
      // Fallback Logic
      if (!val && (col.key.includes('排名') || col.key.includes('名次') || col.key.includes('排'))) {
         if (col.key.includes('3')) val = item.scores['3排'] || item.scores['rank3']
         else if (col.key.includes('6')) val = item.scores['6排'] || item.scores['rank6']
         else if (col.key === '班级排名') val = item.scores['classRank'] || item.scores['班排'] || item.scores['rank']
         else if (col.key === '年级排名') val = item.scores['gradeRank'] || item.scores['年排']
         else if (col.key === '名次') val = item.scores['rank'] || item.scores['班排'] || item.scores['6排']
         
         // Format: Rank / Total
         if (val && totalCount > 0) {
           val = `${val} / ${totalCount}`
         }
      }
      if (!val && col.key.includes('总分') && col.key !== '总分') {
         if (col.key.includes('3')) val = item.scores['3总'] || item.scores['total3']
         if (col.key.includes('6')) val = item.scores['6总'] || item.scores['total6']
      }
      return val
    })
    aoa.push(row)
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }]
  ws['!cols'] = columns.map(() => ({ wch: 15 }))
  ws['!cols'][0] = { wch: 30 }

  XLSX.utils.book_append_sheet(wb, ws, '成绩单')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// --- PDF Generator ---
export async function generateTranscriptPDF(
  tenantId: string, 
  studentId: string, 
  examIds?: string[],
  options?: TranscriptOptions
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const { student, classCount, columns, sortedExams, examStudentCounts } = await prepareTranscriptData(tenantId, studentId, examIds, options)

      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const buffers: Buffer[] = []
      
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(buffers)))
      doc.on('error', (err) => reject(err))
      
      // Font loading
      let fontPath = ''
      const fonts = [
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/System/Library/Fonts/PingFang.ttc', 
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/System/Library/Fonts/SimHei.ttf'
      ]
      
      for (const f of fonts) {
        if (fs.existsSync(f)) {
          fontPath = f
          if (f.endsWith('.ttc')) {
             try {
               const fontkit = require('fontkit')
               const collection = fontkit.openSync(f)
               doc.registerFont('Chinese', collection.fonts[0])
             } catch(e) { doc.registerFont('Chinese', f) }
          } else {
             doc.registerFont('Chinese', f)
          }
          break
        }
      }
      doc.font(fontPath ? 'Chinese' : FONT_FALLBACK)

      // Helper: Draw Bold Text
      const drawBold = (text: string, x: number, y: number, width?: number, align: 'left'|'center'|'right' = 'left', strokeWidth = 0.4) => {
        doc.save()
        doc.lineWidth(strokeWidth)
        ;(doc as any).addContent('2 Tr') 
        const opts: any = { align }
        if (width) opts.width = width
        doc.text(text, x, y, opts)
        ;(doc as any).addContent('0 Tr') 
        doc.restore()
      }

      // Header
      const logoPath = path.resolve(process.cwd(), '../logo.png')
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 40, 40, { width: 50 })
      }
      
      // Title
      doc.fontSize(18)
      drawBold('上海科技大学附属学校（中学） 成绩单', 0, 50, 595, 'center', 0.8)
      
      // Info
      doc.fontSize(12)
      doc.text(`学生姓名：${student.name}`, 50, 90)
      doc.text(`班级：${student.class}`, 200, 90)
      doc.text(`学号：${student.studentId}`, 350, 90)
      doc.text(`班级人数：${classCount}`, 480, 90)

      // Layout
      const startY = 130
      let currentY = startY
      const dataRowHeight = 25
      const headerRowHeight = 35
      const tableWidth = 515 
      
      // Calc Widths
      const renderCols = columns.map(c => ({ ...c, width: 0 }))
      const fixedWidth = 100
      const dynamicCount = renderCols.length - 1
      const dynamicWidth = Math.floor((tableWidth - fixedWidth) / Math.max(1, dynamicCount))
      renderCols.slice(1).forEach(c => c.width = dynamicWidth)
      renderCols[0].width = fixedWidth

      const drawCell = (text: string, x: number, y: number, w: number, h: number, isHeader = false) => {
        doc.rect(x, y, w, h).stroke()
        if (text) {
           doc.fontSize(9)
           const padY = isHeader ? (text.length > 3 ? 6 : 12) : 8
           if (isHeader) {
             drawBold(text, x, y + padY, w, 'center', 0.3)
           } else {
             doc.text(text, x, y + padY, { width: w, align: 'center' })
           }
        }
      }

      // Header Row
      let currentX = 40
      renderCols.forEach(col => {
        drawCell(col.header, currentX, currentY, col.width, headerRowHeight, true)
        currentX += col.width
      })
      currentY += headerRowHeight

      // Data Rows
      sortedExams.forEach(item => {
        currentX = 40
        const totalCount = examStudentCounts.get(item.info.id) || 0
        
        renderCols.forEach(col => {
          let val = ''
          if (col.key === 'name') {
            val = item.info.name
          } else {
            val = item.scores[col.key] ?? ''
            if (!val && (col.key.includes('排名') || col.key.includes('名次') || col.key.includes('排'))) {
               if (col.key.includes('3')) val = item.scores['3排'] || item.scores['rank3']
               else if (col.key.includes('6')) val = item.scores['6排'] || item.scores['rank6']
               else if (col.key === '班级排名') val = item.scores['classRank'] || item.scores['班排'] || item.scores['rank']
               else if (col.key === '年级排名') val = item.scores['gradeRank'] || item.scores['年排']
               else if (col.key === '名次') val = item.scores['rank'] || item.scores['班排'] || item.scores['6排']
               
               // Append Total Count
               if (val && totalCount > 0) {
                 val = `${val} / ${totalCount}`
               }
            }
            if (!val && col.key.includes('总分') && col.key !== '总分') {
               if (col.key.includes('3')) val = item.scores['3总'] || item.scores['total3']
               if (col.key.includes('6')) val = item.scores['6总'] || item.scores['total6']
            }
          }
          
          drawCell(String(val || ''), currentX, currentY, col.width, dataRowHeight)
          currentX += col.width
        })

        currentY += dataRowHeight
        if (currentY > 750) {
          doc.addPage()
          currentY = 50
        }
      })

      // Footer
      currentY += 20
      // Notes removed as requested
      
      currentY += 40
      const sigY = currentY
      drawBold('学校相关部门（盖章）：', 50, sigY, undefined, 'left', 0.4)
      drawBold('经办人签字：', 350, sigY, undefined, 'left', 0.4)
      
      currentY += 40
      drawBold('经办人联系电话：', 350, currentY, undefined, 'left', 0.4)
      
      currentY += 30
      const now = new Date()
      const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
      doc.text(`日期：${dateStr}`, 350, currentY)

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}