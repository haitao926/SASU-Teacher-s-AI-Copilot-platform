
import dotenv from 'dotenv'
import prisma from '../utils/prisma'
import { generateTranscriptPDF } from '../services/academic/transcript'

dotenv.config()

async function main() {
  const studentId = '78256f4d-aef4-46b7-b87d-131a0bac18a6'
  const examId = '591b3a95-c583-46a4-ba9d-5d1af20bad8f'
  
  console.log(`Debug Export for Student: ${studentId}, Exam: ${examId}`)

  // 1. Check Student
  const student = await prisma.student.findUnique({ where: { id: studentId } })
  if (!student) {
    console.error('❌ Student NOT found in DB')
  } else {
    console.log('✅ Student Found:', student.name, student.studentId)
  }

  // 2. Check Score
  const count = await prisma.score.count({
    where: { studentId, examId }
  })
  console.log(`Scores found for this student+exam: ${count}`)

  if (count === 0) {
    console.error('❌ No scores found! This explains the 404.')
    return
  }

  // 3. Try Generate
  try {
    console.log('Attempting generateTranscriptPDF...')
    const buffer = await generateTranscriptPDF('default', studentId, [examId])
    console.log(`✅ Success! Generated PDF size: ${buffer.length} bytes`)
  } catch (e: any) {
    console.error('❌ Generation Failed with Error:')
    console.error(e)
  }
}

main()
  .finally(() => prisma.$disconnect())
