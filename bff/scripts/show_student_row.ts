
import prisma from '../src/utils/prisma';

async function main() {
  const targetId = '2014010111'; // Li Zhangsheng
  const student = await prisma.student.findUnique({
      where: { tenantId_studentId: { tenantId: 'default', studentId: targetId } },
      include: { 
          scores: { 
              include: { exam: true }
          } 
      }
  });

  if (!student) {
      console.log('Student not found');
      return;
  }

  // Define the headers as requested
  const headers = ['学号', '姓名', '6总', '6排', '3排', '语文', '数学', '英语', '3总', '物理', '化学', '生物', '历史', '地理', '政治', '6总调'];
  
  console.log(headers.join('\t'));

  // Group scores by exam
  const exams = new Map<string, Record<string, any>>();
  
  student.scores.forEach(s => {
      if (!exams.has(s.exam.name)) {
          exams.set(s.exam.name, {});
      }
      const examData = exams.get(s.exam.name)!;
      examData[s.subject] = s.value;
      
      // Extract ranks from details if available
      if (s.details) {
          try {
              const details = JSON.parse(s.details);
              if (s.subject === '6总' && details.rank) examData['6排'] = details.rank;
              if (s.subject === '3总' && details.rank) examData['3排'] = details.rank;
          } catch (e) {}
      }
  });

  // Print a row for each exam
  exams.forEach((data, examName) => {
      const row = [
          student.studentId,
          student.name,
          data['6总'] || '-',
          data['6排'] || '-',
          data['3排'] || '-',
          data['语文'] || '-',
          data['数学'] || '-',
          data['英语'] || '-',
          data['3总'] || '-',
          data['物理'] || '-',
          data['化学'] || '-',
          data['生物'] || '-',
          data['历史'] || '-',
          data['地理'] || '-',
          data['政治'] || '-',
          data['6总调'] || '-'
      ];
      console.log(`\n--- ${examName} ---`);
      console.log(row.join('\t'));
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
