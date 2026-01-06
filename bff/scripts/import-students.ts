
import fs from 'fs';
import path from 'path';
import prisma from '../src/utils/prisma';

async function main() {
  const jsonPath = path.resolve(__dirname, '../../students_data.json');
  console.log(`Reading data from ${jsonPath}...`);
  
  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`Found ${data.length} students. Starting import...`);

  let count = 0;
  for (const item of data) {
    try {
      // 1. Upsert User
      // We use upsert to avoid errors if run multiple times
      await prisma.user.upsert({
        where: { username: item.studentId },
        update: {
          name: item.name,
          password: item.password,
          role: 'STUDENT'
        },
        create: {
          username: item.studentId,
          name: item.name,
          password: item.password,
          role: 'STUDENT'
        }
      });

      // 2. Upsert Student
      // TenantId defaults to "default"
      await prisma.student.upsert({
        where: {
          tenantId_studentId: {
            tenantId: 'default',
            studentId: item.studentId
          }
        },
        update: {
          name: item.name,
          class: item.class
        },
        create: {
          name: item.name,
          studentId: item.studentId,
          class: item.class
        }
      });

      count++;
      if (count % 100 === 0) {
        console.log(`Imported ${count} students...`);
      }
    } catch (error) {
      console.error(`Failed to import student ${item.studentId}:`, error);
    }
  }

  console.log(`Import finished. Successfully imported ${count} students.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
