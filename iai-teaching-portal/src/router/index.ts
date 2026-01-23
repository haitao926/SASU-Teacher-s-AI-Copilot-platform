import { createRouter, createWebHistory } from 'vue-router'

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function canAccessAdminFromStorage() {
  const token = localStorage.getItem('iai-token')
  if (!token) return { ok: false as const, redirect: '/login' }

  const user = safeParseJson<any>(localStorage.getItem('iai-user')) ?? {}
  const role = user?.role
  const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : []

  const isAdmin = role === 'ADMIN'
  const canAccessAdmin = isAdmin || permissions.includes('*') || permissions.includes('admin.access') || permissions.some((p) => p.endsWith('.manage') || p.endsWith('.view_all') || p.endsWith('.view'))

  return {
    ok: canAccessAdmin,
    role,
    permissions,
    redirect: canAccessAdmin ? null : '/'
  }
}

function hasPermissionFromStorage(permission: string) {
  const user = safeParseJson<any>(localStorage.getItem('iai-user')) ?? {}
  const role = user?.role
  const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : []
  if (role === 'ADMIN') return true
  if (permissions.includes('*')) return true
  return permissions.includes(permission)
}

const ADMIN_DEFAULT_ROUTES: Array<{ path: string; permission: string }> = [
  { path: '/admin/portal', permission: 'portal.manage' },
  { path: '/admin/entries', permission: 'entries.manage' },
  { path: '/admin/announcements', permission: 'announcements.manage' },
  { path: '/admin/resources', permission: 'assets.manage_all' },
  { path: '/admin/questions', permission: 'questions.manage_all' },
  { path: '/admin/students', permission: 'students.manage' },
  { path: '/admin/events', permission: 'events.view_all' },
  { path: '/admin/users', permission: 'users.manage' },
  { path: '/admin/groups', permission: 'entries.manage' },
  { path: '/admin/audit', permission: 'audit.view' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginPage.vue'),
      meta: { title: '管理员登录' }
    },
    {
      path: '/assets',
      name: 'my-assets',
      component: () => import('@/views/MyAssets.vue'),
      meta: { title: '我的资源库' }
    },
    // New Apps Routes
    {
      path: '/apps/smart-lens',
      name: 'app-smart-lens',
      component: () => import('../../../apps/smart-lens/src/index.vue'),
      meta: { title: '智能识图' }
    },
    {
      path: '/apps/doc-parser',
      name: 'app-doc-parser',
      component: () => import('../../../apps/doc-parser/src/index.vue'),
      meta: { title: '文档解析' }
    },
    {
      path: '/apps/image-gen',
      name: 'app-image-gen',
      component: () => import('../../../apps/image-gen/src/App.vue'),
      meta: { title: '图片生成' }
    },
    {
      path: '/apps/chat',
      name: 'app-chat',
      component: () => import('../../../apps/chat/src/App.vue'),
      meta: { title: 'AI 教学助手' }
    },
    {
      path: '/apps/interaction',
      name: 'app-interaction',
      component: () => import('../../../apps/interaction/src/App.vue'),
      meta: { title: '教学交互' }
    },
    {
      path: '/apps/ppt',
      name: 'app-ppt',
      component: () => import('../../../apps/ppt/src/App.vue'),
      meta: { title: 'PPT 设计' }
    },
    {
      path: '/apps/lesson-plan',
      name: 'app-lesson-plan',
      component: () => import('../../../apps/lesson-plan/src/App.vue'),
      meta: { title: '教案设计' }
    },
    {
      path: '/apps/assessment-data-manager',
      name: 'app-assessment-data-manager',
      component: () => import('../../../apps/assessment-data-manager/src/App.vue'),
      meta: { title: '测评数据管理' }
    },
    {
      path: '/apps/student-stats',
      name: 'app-student-stats',
      component: () => import('../../../apps/student-stats/src/Dashboard.vue'),
      meta: { title: '学生统计' }
    },
    {
      path: '/apps/transcript-generator',
      name: 'app-transcript-generator',
      component: () => import('../../../apps/transcript-generator/src/App.vue'),
      meta: { title: '成绩证明生成器' }
    },
    {
      path: '/apps/quiz-grading',
      name: 'app-quiz-grading',
      component: () => import('../../../apps/quiz-grading/src/Dashboard.vue'),
      meta: { title: '智能阅卷' }
    },
    {
      path: '/apps/quiz-builder',
      name: 'app-quiz-builder',
      component: () => import('../../../apps/quiz-builder/src/Dashboard.vue'),
      meta: { title: '智能组卷' }
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/admin/AdminLayout.vue'),
      redirect: '/admin/entries',
      children: [
        {
          path: 'portal',
          name: 'admin-portal',
          component: () => import('@/views/admin/PortalSettingsManage.vue'),
          meta: { title: '前台页面配置', permission: 'portal.manage' }
        },
        {
          path: 'entries',
          name: 'admin-entries',
          component: () => import('@/views/admin/EntriesManage.vue'),
          meta: { title: '入口管理', permission: 'entries.manage' }
        },
        {
          path: 'announcements',
          name: 'admin-announcements',
          component: () => import('@/views/admin/AnnouncementsManage.vue'),
          meta: { title: '公告管理', permission: 'announcements.manage' }
        },
        {
          path: 'groups',
          name: 'admin-groups',
          component: () => import('@/views/admin/GroupsManage.vue'),
          meta: { title: '分组管理', permission: 'entries.manage' }
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/UsersManage.vue'),
          meta: { title: '教职工账号', permission: 'users.manage' }
        },
        {
          path: 'resources',
          name: 'admin-resources',
          component: () => import('@/views/admin/ResourcesManage.vue'),
          meta: { title: '资源库管理', permission: 'assets.manage_all' }
        },
        {
          path: 'questions',
          name: 'admin-questions',
          component: () => import('@/views/admin/QuestionsManage.vue'),
          meta: { title: '题库管理', permission: 'questions.manage_all' }
        },
        {
          path: 'students',
          name: 'admin-students',
          component: () => import('@/views/admin/StudentsImport.vue'),
          meta: { title: '学生档案', permission: 'students.manage' }
        },
        {
          path: 'events',
          name: 'admin-events',
          component: () => import('@/views/admin/EventsDashboard.vue'),
          meta: { title: '学习数据看板', permission: 'events.view_all' }
        },
        {
          path: 'audit',
          name: 'admin-audit',
          component: () => import('@/views/admin/AuditLogsManage.vue'),
          meta: { title: '审计日志', permission: 'audit.view' }
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  if (!to.path.startsWith('/admin')) return true

  const access = canAccessAdminFromStorage()
  if (!access.ok) return { path: access.redirect || '/' }

  const required = (to.meta as any)?.permission as string | undefined
  if (required && !hasPermissionFromStorage(required)) {
    const fallback = ADMIN_DEFAULT_ROUTES.find((r) => hasPermissionFromStorage(r.permission))?.path
    return { path: fallback || '/' }
  }

  return true
})

export default router
