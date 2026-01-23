
import prisma from '../src/utils/prisma';

async function main() {
  console.log('Seeding teachers...');

  const tenantId = 'default';

  // 1. Math Teacher (Zhang) - Class 1 & 2
  const zhang = await prisma.user.upsert({
    where: { tenantId_username: { tenantId, username: 'teacher_zhang' } },
    update: {},
    create: {
      tenantId,
      username: 'teacher_zhang',
      password: 'password',
      name: '张老师 (数学)',
      role: 'TEACHER'
    }
  });

  await prisma.teacherProfile.upsert({
    where: { userId: zhang.id },
    update: {
      teachingAssignments: JSON.stringify([
        { class: '1', subject: '数学' },
        { class: '2', subject: '数学' }
      ])
    },
    create: {
      userId: zhang.id,
      teachingAssignments: JSON.stringify([
        { class: '1', subject: '数学' },
        { class: '2', subject: '数学' }
      ])
    }
  });
  console.log('Created 张老师 (Math)');

  // 2. Chinese Teacher (Wang) - Class 1
  const wang = await prisma.user.upsert({
    where: { tenantId_username: { tenantId, username: 'teacher_wang' } },
    update: {},
    create: {
      tenantId,
      username: 'teacher_wang',
      password: 'password',
      name: '王老师 (语文)',
      role: 'TEACHER'
    }
  });

  await prisma.teacherProfile.upsert({
    where: { userId: wang.id },
    update: {
      teachingAssignments: JSON.stringify([{ class: '1', subject: '语文' }])
    },
    create: {
      userId: wang.id,
      teachingAssignments: JSON.stringify([{ class: '1', subject: '语文' }])
    }
  });
  console.log('Created 王老师 (Chinese)');

  // 3. Homeroom Teacher (Li) - Class 1
  const li = await prisma.user.upsert({
    where: { tenantId_username: { tenantId, username: 'teacher_li' } },
    update: {},
    create: {
      tenantId,
      username: 'teacher_li',
      password: 'password',
      name: '李老师 (班主任)',
      role: 'TEACHER'
    }
  });

  await prisma.teacherProfile.upsert({
    where: { userId: li.id },
    update: {
      isHomeroom: true,
      homeroomClass: '1'
    },
    create: {
      userId: li.id,
      isHomeroom: true,
      homeroomClass: '1'
    }
  });
  console.log('Created 李老师 (Homeroom)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
