import { createRouter, createWebHistory } from 'vue-router'

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
      component: () => import('../../../apps/image-gen/App.vue'),
      meta: { title: '图片生成' }
    },
    {
      path: '/apps/chat',
      name: 'app-chat',
      component: () => import('../../../apps/chat/App.vue'),
      meta: { title: 'AI 教学助手' }
    },
    {
      path: '/apps/interaction',
      name: 'app-interaction',
      component: () => import('../../../apps/interaction/App.vue'),
      meta: { title: '教学交互' }
    },
    {
      path: '/apps/ppt',
      name: 'app-ppt',
      component: () => import('../../../apps/ppt/App.vue'),
      meta: { title: 'PPT 设计' }
    },
    {
      path: '/apps/lesson-plan',
      name: 'app-lesson-plan',
      component: () => import('../../../apps/lesson-plan/App.vue'),
      meta: { title: '教案设计' }
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
      component: () => import('../../../apps/transcript-generator/App.vue'),
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
          path: 'entries',
          name: 'admin-entries',
          component: () => import('@/views/admin/EntriesManage.vue'),
          meta: { title: '入口管理' }
        },
        {
          path: 'announcements',
          name: 'admin-announcements',
          component: () => import('@/views/admin/AnnouncementsManage.vue'),
          meta: { title: '公告管理' }
        },
        {
          path: 'groups',
          name: 'admin-groups',
          component: () => import('@/views/admin/GroupsManage.vue'),
          meta: { title: '分组管理' }
        },
        {
          path: 'users',
          name: 'admin-users',
          component: () => import('@/views/admin/UsersManage.vue'),
          meta: { title: '用户管理' }
        }
      ]
    }
  ]
})

export default router
