
import prisma from '../../utils/prisma'
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'

// Font path detection for local dev on macOS
const FONT_PATH = '/System/Library/Fonts/STHeiti Light.ttc'
const FONT_FALLBACK = 'Helvetica' // Will break Chinese, but better than crash

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

export async function generateTranscriptPDF(tenantId: string, studentId: string, examId?: string) {
  // 1. Fetch Data
  const student = await prisma.student.findUnique({
    where: { id: studentId }
  })
  if (!student || student.tenantId !== tenantId) throw new Error('Student not found')

  // If examId is provided, filter by it. Else get all or latest.
  // For transcript, usually we want a specific exam or "All history".
  // Let's assume specific exam for now based on the request "transcript template".
  const whereScore: any = { tenantId, studentId }
  let examTitle = '学生成绩单'

  if (examId) {
    whereScore.examId = examId
    const exam = await prisma.exam.findUnique({ where: { id: examId } })
    if (exam) examTitle = exam.name + ' 成绩单'
  }

  const scores = await prisma.score.findMany({
    where: whereScore,
    include: { exam: true },
    orderBy: { subject: 'asc' }
  })

  // 2. Setup PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  
  // Try to load Chinese font
  let fontToUse = FONT_FALLBACK
  if (fs.existsSync('/System/Library/Fonts/STHeiti Medium.ttc')) {
    fontToUse = '/System/Library/Fonts/STHeiti Medium.ttc'
  } else if (fs.existsSync('/System/Library/Fonts/PingFang.ttc')) {
    fontToUse = '/System/Library/Fonts/PingFang.ttc'
  }

  // Helper to draw lines
  const drawLine = (y: number) => {
    doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(545, y).stroke()
  }

  // --- Header ---
  doc.font(fontToUse).fontSize(24).text('SASU 学校成绩单', { align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(16).text(examTitle, { align: 'center' })
  doc.moveDown(2)

  // --- Student Info Box ---
  const startY = doc.y
  doc.rect(50, startY, 495, 80).strokeColor('#333').stroke()
  
  doc.fontSize(12).text(`姓名: ${student.name}`, 70, startY + 20)
  doc.text(`学号: ${student.studentId}`, 300, startY + 20)
  doc.text(`班级: ${student.class}`, 70, startY + 50)
  doc.text(`打印日期: ${new Date().toLocaleDateString()}`, 300, startY + 50)
  
  doc.moveDown(4)

  // --- Scores Table ---
  const tableTop = doc.y + 20
  const colX = { subject: 50, score: 250, grade: 350, comment: 450 }
  
  // Table Header
  doc.fontSize(12).font(fontToUse)
  doc.text('科目', colX.subject, tableTop, { bold: true })
  doc.text('分数', colX.score, tableTop, { bold: true })
  doc.text('等级', colX.grade, tableTop, { bold: true })
  doc.text('备注', colX.comment, tableTop, { bold: true })
  
  drawLine(tableTop + 20)

  let rowY = tableTop + 35
  scores.forEach(score => {
    doc.text(score.subject, colX.subject, rowY)
    doc.text(String(score.value), colX.score, rowY)
    
    // Simple grading logic (demo)
    let grade = 'F'
    if (score.value >= 90) grade = 'A'
    else if (score.value >= 80) grade = 'B'
    else if (score.value >= 70) grade = 'C'
    else if (score.value >= 60) grade = 'D'
    doc.text(grade, colX.grade, rowY)
    
    doc.text('', colX.comment, rowY) // Placeholder for comment
    
    drawLine(rowY + 20)
    rowY += 30
  })

  // --- Summary ---
  const totalScore = scores.reduce((acc, s) => acc + s.value, 0)
  const avgScore = scores.length ? (totalScore / scores.length).toFixed(1) : '0.0'
  
  doc.moveDown(2)
  doc.text(`总分: ${totalScore}    平均分: ${avgScore}`, 50, rowY + 20)

  // --- Footer ---
  const footerY = 750
  doc.fontSize(10).text('校长/教务处签名:', 50, footerY)
  drawLine(footerY + 15) // Signature line
  doc.text('SASU AI Teaching Copilot 生成', 50, footerY + 30, { align: 'center', color: '#888' })

  doc.end()
  return doc
}
