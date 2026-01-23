
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import prisma from '../src/utils/prisma';

// Helper to extract exam name and class from filename
function parseFilename(filename: string) {
  // Example: "8-2026届高中  高二下 期末 优化版-3排.xlsx"
  // Class: 8
  // Exam: 2026届高中  高二下 期末
  
  const basename = path.basename(filename, '.xlsx');
  const match = basename.match(/^(\d+)-(.*?)\s+优化版/);
  
  if (match) {
    return {
      classNum: match[1],
      examName: match[2].trim()
    };
  }
  
  // Fallback if pattern doesn't match perfectly
  return {
    classNum: 'Unknown',
    examName: basename
  };
}

// Map column index to Subject Key
const COLUMN_MAP: Record<number, string> = {
  2: '6总',
  5: '3总', // Shifted
  6: '语文', // Shifted
  7: '数学', // Shifted
  8: '英语', // Shifted
  9: '物理',
  10: '化学',
  11: '生物',
  12: '历史',
  13: '地理',
  14: '政治',
  15: '6总调'
};

async function importFile(filePath: string) {
  console.log(`\nProcessing file: ${filePath}`);
  
  const { classNum, examName } = parseFilename(filePath);
  console.log(`Class: ${classNum}, Exam: ${examName}`);

  // 1. Ensure Exam Exists
  const exam = await prisma.exam.upsert({
    where: {
      tenantId_name: {
        tenantId: 'default',
        name: examName
      }
    },
    update: {},
    create: {
      tenantId: 'default',
      name: examName,
      date: new Date(), // Default to now, can't parse easily from filename
      type: 'Exam'
    }
  });
  console.log(`Exam ID: ${exam.id}`);

  // 2. Read Excel
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Skip title (row 0) and header (row 1), start from row 2
  const rows = data.slice(2);
  console.log(`Found ${rows.length} student records.`);

  let importedCount = 0;

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    const originalId = String(row[0]);
    const name = String(row[1]);
    
    if (!originalId || !name || originalId === 'undefined') continue;

    // Make Student ID unique by prefixing Class
    const studentId = `${classNum}-${originalId}`;

    // 3. Upsert User (Student Account)
    await prisma.user.upsert({
      where: {
        tenantId_username: {
          tenantId: 'default',
          username: studentId
        }
      },
      update: { name },
      create: {
        username: studentId,
        name,
        password: studentId, // Default password
        role: 'STUDENT',
        tenantId: 'default'
      }
    });

    // 4. Upsert Student Profile
    const student = await prisma.student.upsert({
      where: {
        tenantId_studentId: {
          tenantId: 'default',
          studentId
        }
      },
      update: {
        class: classNum,
        name
      },
      create: {
        tenantId: 'default',
        studentId,
        name,
        class: classNum
      }
    });

    // 5. Upsert Scores
    // Extract Ranks
    const rank6 = row[3];
    const rank3 = row[4];

    for (const [colIdxStr, subject] of Object.entries(COLUMN_MAP)) {
      const colIdx = parseInt(colIdxStr);
      const val = row[colIdx];

      // Skip if value is empty/null
      if (val === undefined || val === null || val === '') continue;

      const scoreValue = parseFloat(String(val));
      if (isNaN(scoreValue)) continue;

      // Prepare details JSON for Totals
      let details: any = {};
      if (subject === '6总' && rank6 !== undefined) details.rank = rank6;
      if (subject === '3总' && rank3 !== undefined) details.rank = rank3;

      // Check if score exists
      const existingScore = await prisma.score.findFirst({
        where: {
          tenantId: 'default',
          studentId: student.id,
          examId: exam.id,
          subject
        }
      });

      if (existingScore) {
        await prisma.score.update({
          where: { id: existingScore.id },
          data: {
            value: scoreValue,
            details: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
            updatedBy: 'system-import'
          }
        });
      } else {
        await prisma.score.create({
          data: {
            tenantId: 'default',
            studentId: student.id,
            examId: exam.id,
            subject,
            value: scoreValue,
            updatedBy: 'system-import',
            details: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined
          }
        });
      }
    }
    importedCount++;
    if (importedCount % 50 === 0) process.stdout.write('.');
  }
  console.log(`\nImported ${importedCount} students from ${path.basename(filePath)}`);
}

async function main() {
  // Cleanup bad import if exists
  try {
    const badStudent = await prisma.student.findUnique({
        where: { tenantId_studentId: { tenantId: 'default', studentId: '2014010101' } }
    });
    if (badStudent) {
        console.log('Cleaning up incorrect merged student 2014010101...');
        await prisma.score.deleteMany({ where: { studentId: badStudent.id } });
        await prisma.student.delete({ where: { id: badStudent.id } });
        await prisma.user.deleteMany({ where: { username: '2014010101' } });
        console.log('Cleanup complete.');
    }
  } catch (e) {
    console.warn('Cleanup failed (non-fatal):', e);
  }

  const filePaths = [
    '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/8-2026届高中  高二下 期末 优化版-3排.xlsx',
    '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/5-2026届高中  高二上 期中 优化版-3排.xlsx',
    '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/6-2026届高中  高二上 期末 优化版-3排.xlsx'
  ];

  for (const fp of filePaths) {
    if (fs.existsSync(fp)) {
      await importFile(fp);
    } else {
      console.warn(`File not found: ${fp}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
