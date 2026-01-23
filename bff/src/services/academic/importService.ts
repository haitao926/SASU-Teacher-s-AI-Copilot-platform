import prisma from '../../utils/prisma'
import * as XLSX from 'xlsx'
import AdmZip from 'adm-zip'
import path from 'path'

interface ImportResult {
  createdStudents: number
  updatedStudents: number
  createdScores: number
  errors: string[]
}

const KEY_MAP: Record<string, string> = {
  '学号': 'studentId',
  'Student ID': 'studentId',
  'ID': 'studentId',
  '姓名': 'name',
  'Name': 'name',
  '班级': 'class',
  'Class': 'class',
  // Fix for common Mojibake (UTF-8 interpreted as Latin-1)
  'å­¦å\x8F·': 'studentId', // 学号
  'å§\x93å\x90\x8D': 'name', // 姓名
  'å¹´çº§': 'grade', // 年级
  'ç\x8F­çº§': 'class' // 班级
}

async function processWorkbook(
  workbook: XLSX.WorkBook,
  tenantId: string,
  examId: string,
  result: ImportResult,
  filename: string
) {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    
    // Smart Header Detection
    // 1. Read first 10 rows as arrays
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: '' }) as any[][]
    let headerRowIndex = 0
    let foundHeader = false

    // Known keywords (Normal + Mojibake)
    const indicators = ['姓名', 'Name', 'å§\x93å\x90\x8D', '学号', 'Student ID', 'å­¦å\x8F·']

    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const rowStr = JSON.stringify(rawRows[r])
      // Check if any indicator exists in this row
      if (indicators.some(k => rowStr.includes(k))) {
        headerRowIndex = r
        foundHeader = true
        break
      }
    }

    if (!foundHeader) {
      // Fallback: if no header found, maybe it's row 0 or maybe it's invalid.
      // We'll proceed with row 0 but logging might show errors.
      // console.warn(`[Import] No header row identified in ${sheetName}, using default.`)
    }

    // 2. Read again using the identified header row
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, range: headerRowIndex })
    
    if (rows.length < 2) continue // Only header, no data

    // Parse Header Row to map indexes
    const headerRow = rows[0] as string[]
    const colMap: Record<string, number> = {} // 'name' -> 0, 'studentId' -> 1, 'Chinese' -> 5...
    const subjectCols: number[] = []

    headerRow.forEach((colName, idx) => {
      const cleanName = String(colName).trim()
      if (!cleanName) return

      // Check standard fields
      if (['姓名', 'Name', 'å§\x93å\x90\x8D'].includes(cleanName)) {
        colMap['name'] = idx
      } else if (['学号', 'Student ID', 'å­¦å\x8F·', 'ID'].includes(cleanName)) {
        colMap['studentId'] = idx
      } else if (['班级', 'Class', 'ç\x8F­çº§'].includes(cleanName)) {
        colMap['class'] = idx
      } else {
        // Assume everything else is a subject/score column
        // Filter out non-subject cols if needed (e.g. "Total")
        if (!['总分', 'Rank'].includes(cleanName)) {
           colMap[cleanName] = idx
           subjectCols.push(idx)
        }
      }
    })

    if (colMap['name'] === undefined) {
      result.errors.push(`[${filename} - ${sheetName}] 无法识别"姓名"列，跳过此Sheet`)
      continue
    }

    // Process Data Rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as any[]
      if (!row || row.length === 0) continue

      let name = row[colMap['name']]
      if (!name) continue // Skip empty rows

      name = String(name).trim()
      let studentId = colMap['studentId'] !== undefined ? String(row[colMap['studentId']]).trim() : ''
      let className = colMap['class'] !== undefined ? String(row[colMap['class']]).trim() : ''

      // Fallback ID
      if (!studentId) {
        // Generate a pseudo-ID if missing. 
        // WARNING: This assumes names are unique within the import batch or system.
        // Format: GEN_{Name}
        studentId = `GEN_${name}`
      }

      const scores: Record<string, number> = {}
      const metadata: Record<string, any> = {}
      
      subjectCols.forEach(colIdx => {
        const subjectName = headerRow[colIdx]
        const val = row[colIdx]
        const scoreVal = parseFloat(String(val))
        if (!isNaN(scoreVal)) {
          scores[subjectName] = scoreVal
        }
        
        // Capture Ranks/Totals for metadata
        if (subjectName.includes('排') || subjectName.includes('总')) {
           metadata[subjectName] = scoreVal
        }
      })

      // Database Upsert
      try {
        const student = await prisma.student.upsert({
          where: { tenantId_studentId: { tenantId, studentId } },
          update: {
             name,
             class: className || undefined
          },
          create: {
            tenantId,
            studentId,
            name,
            class: className || 'Unknown'
          }
        })
        result.updatedStudents++

        for (const [subject, value] of Object.entries(scores)) {
          await prisma.score.deleteMany({
            where: {
              tenantId,
              examId: examId,
              studentId: student.id,
              subject
            }
          })

          // Store metadata only on "总分" or similar summary subjects to avoid duplication
          // OR store on all? Storing on '总分' is cleaner.
          // If subject is '总分' or '6总调', we attach relevant ranks.
          
          let details = null
          if (subject === '总分' || subject === '6总调' || subject === '3总调') {
             details = JSON.stringify(metadata)
          }

          await prisma.score.create({
            data: {
              tenantId,
              examId: examId,
              studentId: student.id,
              subject,
              value,
              details
            }
          })
          result.createdScores++
        }
      } catch (e: any) {
         result.errors.push(`[${filename}] Row ${i + headerRowIndex + 1}: ${e.message}`)
      }
    }
  }
}

// Helper to parse filename
function parseExamInfo(filename: string, defaultName: string): { name: string, date: Date } {
  // Regex to capture key parts: 
  // Year (20xx), Grade (高x), Semester (上/下), Type (期x/月考)
  const regex = /(20\d{2})?(?:届)?.*(高[一二三]).*([上下]).*(期[中末]|月考)/
  const match = filename.match(regex)
  
  if (match) {
    const year = match[1] || new Date().getFullYear() // 2026
    const grade = match[2] // 高二
    const sem = match[3] // 下
    const type = match[4] // 期末
    
    // Construct Standardized Name: "2026届 高二下 期末"
    const name = `${year}届 ${grade}${sem} ${type}`
    return { name, date: new Date() }
  }
  
  return { name: defaultName, date: new Date() }
}

export async function importExamScores(
  tenantId: string,
  defaultExamName: string,
  defaultDate: Date,
  fileBuffer: Buffer,
  filename: string
): Promise<ImportResult> {
  const result: ImportResult = {
    createdStudents: 0,
    updatedStudents: 0,
    createdScores: 0,
    errors: []
  }

  // 2. Check File Type
  const ext = filename ? path.extname(filename).toLowerCase() : ''
  
  if (ext === '.zip') {
    try {
      const zip = new AdmZip(fileBuffer)
      const zipEntries = zip.getEntries()

      for (const entry of zipEntries) {
        if (entry.isDirectory || entry.name.startsWith('._')) continue
        const entryExt = path.extname(entry.name).toLowerCase()
        
        if (entryExt === '.xlsx' || entryExt === '.xls') {
          // Parse Exam Name from Entry Filename
          const { name: examName } = parseExamInfo(entry.name, defaultExamName)
          
          try {
            // Create/Get Exam for THIS file
            const exam = await prisma.exam.upsert({
              where: { tenantId_name: { tenantId, name: examName } },
              update: {}, // Don't overwrite date if exists
              create: {
                tenantId,
                name: examName,
                date: defaultDate,
                type: 'Exam'
              }
            })
            
            const workbook = XLSX.read(entry.getData(), { type: 'buffer' })
            await processWorkbook(workbook, tenantId, exam.id, result, entry.name)
          } catch (e: any) {
            result.errors.push(`处理文件 ${entry.name} 失败: ${e.message}`)
          }
        }
      }
    } catch (e: any) {
      throw new Error(`无法读取 ZIP 文件: ${e.message}`)
    }
  } else if (ext === '.xlsx' || ext === '.xls') {
    // Single File
    const { name: examName } = parseExamInfo(filename, defaultExamName)
    
    const exam = await prisma.exam.upsert({
      where: { tenantId_name: { tenantId, name: examName } },
      update: {},
      create: {
        tenantId,
        name: examName,
        date: defaultDate,
        type: 'Exam'
      }
    })
    
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    await processWorkbook(workbook, tenantId, exam.id, result, filename)
  }

  return result
}
