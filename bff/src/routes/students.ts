import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { requirePermission } from '../utils/permissions'

interface StudentBody {
  studentId: string
  name: string
  class?: string
  grade?: string
  entryYear?: string
  gender?: string
  address?: string
  phone?: string
  parentName?: string
  homeroomTeacher?: string
}

export default async function registerStudentRoutes(app: FastifyInstance) {
  const adminOnly = requirePermission('students.manage')
  const getTenant = (request: any) => (request.tenantId as string) || 'default'

  // Admin list students
  app.get(
    '/admin/students',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['students'],
        summary: 'List students (admin)',
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            pageSize: { type: 'string' },
            keyword: { type: 'string' },
            className: { type: 'string' }
          }
        }
    }
  },
    async (request) => {
      const tenantId = getTenant(request)
      const { page = '1', pageSize = '20', keyword = '', className } = request.query as any
      const pageNum = Math.max(parseInt(page, 10) || 1, 1)
      const sizeNum = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 200)
      const where: any = { tenantId }
      if (keyword) {
        where.OR = [
          { studentId: { contains: keyword } },
          { name: { contains: keyword } },
          { class: { contains: keyword } }
        ]
      }
      if (className) where.class = className

      const [total, items] = await prisma.$transaction([
        prisma.student.count({ where }),
        prisma.student.findMany({
          where,
          orderBy: [{ class: 'asc' }, { name: 'asc' }],
          skip: (pageNum - 1) * sizeNum,
          take: sizeNum
        })
      ])
      return { items, total, page: pageNum, pageSize: sizeNum }
    }
  )

  // Admin import students
  app.post<{ Body: { students: StudentBody[] } }>(
    '/admin/students/import',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['students'],
        summary: 'Import students (upsert by studentId)',
        body: {
          type: 'object',
          required: ['students'],
          properties: {
            students: { type: 'array' }
          }
        }
      }
  },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const list = request.body?.students
      if (!Array.isArray(list) || list.length === 0) {
        return reply.code(400).send({ message: 'students is required' })
      }
      let created = 0
      let updated = 0

      for (const s of list) {
        if (!s.studentId || !s.name) continue
        const existing = await prisma.student.findUnique({
          where: { tenantId_studentId: { tenantId, studentId: s.studentId } }
        })
        if (!existing) {
          await prisma.student.create({
            data: {
              tenantId,
              studentId: s.studentId,
              name: s.name,
              class: s.class || ''
            }
          })
          created++
        } else {
          await prisma.student.update({
            where: { id: existing.id },
            data: {
              name: s.name,
              class: s.class || existing.class
            }
          })
          updated++
        }
      }
      return { success: true, created, updated }
    }
  )

  // Admin export students CSV
  app.get(
    '/admin/students/export',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['students'],
        summary: 'Export students as CSV'
      }
  },
    async (_request, reply) => {
      const tenantId = getTenant(_request)
      const rows = await prisma.student.findMany({
        where: { tenantId },
        orderBy: [{ class: 'asc' }, { name: 'asc' }]
      })
      const header = 'studentId,name,class\n'
      const body = rows.map(r => `${r.studentId},${r.name},${r.class ?? ''}`).join('\n')
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.send(header + body)
    }
  )

  // Admin Update Student
  app.put<{ Params: { id: string }; Body: Partial<StudentBody> }>(
    '/admin/students/:id',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['students'],
        summary: 'Update student info'
      }
    },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { id } = request.params
      const { name, class: className } = request.body

      try {
        const updated = await prisma.student.update({
          where: { id },
          data: { name, class: className }
        })
        
        // Also update User name if exists
        await prisma.user.updateMany({
          where: { tenantId, username: updated.studentId },
          data: { name }
        })

        return updated
      } catch (e: any) {
        if (e.code === 'P2025') return reply.code(404).send({ message: 'Student not found' })
        throw e
      }
    }
  )

  // Admin Delete Student
  app.delete<{ Params: { id: string } }>(
    '/admin/students/:id',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['students'],
        summary: 'Delete student and all related data'
      }
    },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { id } = request.params

      const student = await prisma.student.findUnique({ where: { id } })
      if (!student) return reply.code(404).send({ message: 'Student not found' })

      await prisma.$transaction(async (tx) => {
        // 1. Delete Scores
        await tx.score.deleteMany({ where: { studentId: id } })
        // 2. Delete Submissions
        await tx.submission.deleteMany({ where: { studentId: id } })
        // 3. Delete Student Profile
        await tx.student.delete({ where: { id } })
        // 4. Delete User Account
        await tx.user.deleteMany({ where: { tenantId, username: student.studentId } })
      })

      return { success: true }
    }
  )

  // Admin Reset Password
  app.post<{ Params: { id: string } }>(
    '/admin/students/:id/reset-password',
    {
      preHandler: [app.authenticate, adminOnly],
      schema: {
        tags: ['students'],
        summary: 'Reset student password to studentId'
      }
    },
    async (request, reply) => {
      const tenantId = getTenant(request)
      const { id } = request.params

      const student = await prisma.student.findUnique({ where: { id } })
      if (!student) return reply.code(404).send({ message: 'Student not found' })

      const result = await prisma.user.updateMany({
        where: { tenantId, username: student.studentId },
        data: { password: student.studentId } // Default reset logic
      })

      if (result.count === 0) {
        // If user doesn't exist (e.g. only student profile exists), create it
        await prisma.user.create({
          data: {
            tenantId,
            username: student.studentId,
            name: student.name,
            password: student.studentId,
            role: 'STUDENT'
          }
        })
      }

      return { success: true, message: `Password reset to ${student.studentId}` }
    }
  )
}
