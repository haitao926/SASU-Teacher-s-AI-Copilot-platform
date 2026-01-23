
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import prisma from '../src/utils/prisma';

// 1. Load Master Map
interface StudentInfo {
    id: string;
    classNum: string;
}

function loadMasterMap(filePath: string): Map<string, StudentInfo> {
    console.log(`Loading Master List: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    const map = new Map<string, StudentInfo>();
    // Skip header (row 0)
    data.slice(1).forEach(row => {
        const id = String(row[0]); // ID at index 0
        const classNum = String(row[3]); // Class at index 3
        const name = row[4];       // Name at index 4
        if (name && id) {
            map.set(name, { id, classNum });
        }
    });
    console.log(`Loaded ${map.size} students from Master List.`);
    return map;
}

// Helper to extract exam name from filename
function parseFilename(filename: string) {
    const basename = path.basename(filename, '.xlsx');
    const match = basename.match(/^(\d+)-(.*?)\s+优化版/);
    if (match) {
        return { examName: match[2].trim() };
    }
    return { examName: basename };
}

// Standard Map (Files 5, 6, 7)
const STANDARD_MAP: Record<number, string> = {
    2: '6总',
    5: '语文',
    6: '数学',
    7: '英语',
    8: '3总',
    9: '物理',
    10: '化学',
    11: '生物',
    12: '历史',
    13: '地理',
    14: '政治',
    15: '6总调'
};

// File 8 Map (Data is shifted: Index 5 contains 3-Total)
const FILE_8_MAP: Record<number, string> = {
    2: '6总',
    5: '3总',
    6: '语文',
    7: '数学',
    8: '英语',
    9: '物理',
    10: '化学',
    11: '生物',
    12: '历史',
    13: '地理',
    14: '政治',
    15: '6总调'
};

async function importFile(filePath: string, nameToInfo: Map<string, StudentInfo>) {
    console.log(`\nProcessing file: ${filePath}`);
    const { examName } = parseFilename(filePath);
    console.log(`Exam: ${examName}`);

    // Determine correct map
    const filename = path.basename(filePath);
    const COLUMN_MAP = filename.startsWith('8-') ? FILE_8_MAP : STANDARD_MAP;
    console.log(filename.startsWith('8-') ? 'Using File 8 Map (Shifted)' : 'Using Standard Map');

    // Ensure Exam Exists
    const exam = await prisma.exam.upsert({
        where: { tenantId_name: { tenantId: 'default', name: examName } },
        update: {},
        create: { tenantId: 'default', name: examName, date: new Date(), type: 'Exam' }
    });

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const rows = data.slice(2);

    let count = 0;
    for (const row of rows) {
        if (!row || row.length === 0) continue;
        const name = String(row[1]);
        if (!name || name === 'undefined') continue;

        // Lookup Real Info
        const info = nameToInfo.get(name);
        if (!info) {
            console.warn(`WARNING: Could not find Info for student '${name}' in Master List! Skipping.`);
            continue;
        }

        const { id: realId, classNum } = info;

        // Upsert User
        await prisma.user.upsert({
            where: { tenantId_username: { tenantId: 'default', username: realId } },
            update: { name },
            create: { username: realId, name, password: realId, role: 'STUDENT', tenantId: 'default' }
        });

        // Upsert Student (Use Class from Master List)
        const student = await prisma.student.upsert({
            where: { tenantId_studentId: { tenantId: 'default', studentId: realId } },
            update: { class: classNum, name },
            create: { tenantId: 'default', studentId: realId, name, class: classNum }
        });

        // Upsert Scores
        const rank6 = row[3];
        const rank3 = row[4];

        for (const [colIdxStr, subject] of Object.entries(COLUMN_MAP)) {
            const colIdx = parseInt(colIdxStr);
            const val = row[colIdx];
            if (val === undefined || val === null || val === '') continue;
            
            const scoreValue = parseFloat(String(val));
            if (isNaN(scoreValue)) continue;

            let details: any = {};
            if (subject === '6总' && rank6 !== undefined) details.rank = rank6;
            if (subject === '3总' && rank3 !== undefined) details.rank = rank3;

            const existingScore = await prisma.score.findFirst({
                where: { tenantId: 'default', studentId: student.id, examId: exam.id, subject }
            });

            if (existingScore) {
                await prisma.score.update({
                    where: { id: existingScore.id },
                    data: { value: scoreValue, details: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined, updatedBy: 'system-reimport' }
                });
            } else {
                await prisma.score.create({
                    data: {
                        tenantId: 'default', studentId: student.id, examId: exam.id, subject, value: scoreValue,
                        updatedBy: 'system-reimport', details: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined
                    }
                });
            }
        }
        count++;
        if (count % 50 === 0) process.stdout.write('.');
    }
    console.log(`\nProcessed ${count} students.`);
}

async function main() {
    const masterPath = '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/StudentsToExcel2026-1-6.xlsx';
    const examFiles = [
        '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/8-2026届高中  高二下 期末 优化版-3排.xlsx',
        '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/7-2026届高中  高二下 期中 优化版-3排.xlsx',
        '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/5-2026届高中  高二上 期中 优化版-3排.xlsx',
        '/Users/apple/Documents/GitHub/SASU-Teacher-s-AI-Copilot-platform/asset/6-2026届高中  高二上 期末 优化版-3排.xlsx'
    ];

    const nameToInfo = loadMasterMap(masterPath);

    for (const fp of examFiles) {
        if (fs.existsSync(fp)) await importFile(fp, nameToInfo);
    }

    console.log('Done.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
