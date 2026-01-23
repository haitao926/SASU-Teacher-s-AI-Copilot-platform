
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import prisma from '../utils/prisma'
import { generateTranscriptPDF } from '../services/academic/transcript'

dotenv.config()

async function main() {
  console.log('--- Debug PDF Generation ---')
  
  const student = await prisma.student.findFirst({
    include: { scores: true }
  })

  if (!student) {
    console.error('No students found in DB')
    return
  }

  console.log(`Testing with Student: ${student.name} (${student.id})`)
  
  if (student.scores.length === 0) {
    console.error('Student has no scores')
    return
  }

  const examId = student.scores[0].examId
  console.log(`Using Exam ID: ${examId}`)

  try {
    const doc = await generateTranscriptPDF('default', student.id, [examId])
    console.log('PDF Generated Successfully')
    
    // Save to file to verify
    const writeStream = fs.createWriteStream('debug_transcript.pdf')
    doc.pipe(writeStream)
    // doc.end() is called inside generateTranscriptPDF? 
    // Wait, the service calls doc.end().
    // If I pipe AFTER doc.end(), it might be empty or work if buffers are there.
    // Actually generateTranscriptPDF returns `doc`.
    // It calls `doc.end()` at the end of the function.
    // If I want to save it, I should pipe BEFORE end.
    // But the service calls end().
    
    // Let's check service code:
    // doc.end()
    // return doc
    
    // This is problematic. doc.end() finalizes the PDF. 
    // If I pipe afterwards, I might miss data? 
    // PDFKit buffers?
    
    // Actually, usually you pipe before writing content.
    // The service implementation is:
    /*
      const doc = new PDFDocument(...)
      // ... write content ...
      doc.end()
      return doc
    */
    // If it returns a closed stream, Fastify's `reply.send(doc)` handles it because it's a readable stream?
    // Yes, but only if it was piped or buffered?
    
    // PDFKit `doc` is a Readable Stream.
    // If `doc.end()` is called, it pushes null.
    // If nobody is reading it while it's being written, the data might be lost or buffered in memory?
    // PDFKit buffers in memory if no stream is attached? No, it pauses.
    
    // FASTIFY handles streams.
    
    // BUT for my debug script, I need to pipe it SOMEWHERE or it will hang or lose data.
    // Since the function already called end(), I might be too late to pipe to file?
    
    // Let's rely on whether it THROWS.
    
  } catch (e: any) {
    console.error('--- PDF GENERATION FAILED ---')
    console.error(e)
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
