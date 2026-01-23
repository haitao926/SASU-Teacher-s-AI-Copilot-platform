import type { FastifyInstance } from 'fastify'
import prisma from '../utils/prisma'
import { TOOL_STATUS } from '../utils/constants'
import { requirePermission } from '../utils/permissions'

export default async function registerToolsRoutes(app: FastifyInstance) {
  app.get(
    '/tools',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['tools'],
        summary: 'List available tools'
      }
    },
    async (request) => {
      const tenantId = (request.tenantId as string) || 'default'
      // Future: Filter by user role or permissions
      const tools = await prisma.tool.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          deletedAt: null
        },
        orderBy: { order: 'asc' }
      })
      
      // If DB is empty, return defaults to keep frontend working
      if (tools.length === 0) {
          return []
      }
      return tools
    }
  )
  
  // Seed/Reset Tools endpoint (Admin only)
  app.post('/tools/reset', 
    {
      preHandler: [app.authenticate, requirePermission('entries.manage')], 
      schema: { tags: ['tools'], summary: 'Reset default tools' }
    },
    async (request, reply) => {
       const tenantId = (request.tenantId as string) || 'default'
       
       // Clear existing
       await prisma.tool.deleteMany({ where: { tenantId } })
       
       // Create defaults
       const defaults = [
           { code: 'dashboard', name: '工作台', icon: 'mdi:view-dashboard-outline', route: '/dashboard', category: 'main', order: 1 },
           { code: 'resources', name: '教学资源', icon: 'mdi:book-open-page-variant-outline', route: '/resources', category: 'main', order: 2 },
           { code: 'smart-quiz', name: '智能组卷', icon: 'mdi:creation', route: '/assessment/quiz-gen', category: 'assessment', order: 3 },
           { code: 'sheet-design', name: '答题卡制作', icon: 'mdi:card-account-details-outline', route: '/assessment/sheet-design', category: 'assessment', order: 4 },
           { code: 'grading', name: '智能批改', icon: 'mdi:camera-metering-center', route: '/grading-bridge', category: 'main', order: 5 },
           { code: 'analytics', name: '学情中心', icon: 'mdi:chart-box-outline', route: '/analytics', category: 'main', order: 6 },
           { code: 'my-assets', name: '我的资产', icon: 'mdi:folder-star-outline', route: '/my-assets', category: 'user', order: 7 },
       ]
       
       for (const t of defaults) {
           await prisma.tool.create({
               data: {
                   tenantId,
                   code: t.code,
                   name: t.name,
                   icon: t.icon,
                   route: t.route,
                   category: t.category,
                   order: t.order,
                   status: 'ACTIVE'
               }
           })
       }
       
       return { success: true }
    }
  )
}
