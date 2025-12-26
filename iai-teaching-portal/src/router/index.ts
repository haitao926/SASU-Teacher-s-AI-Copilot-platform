import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomePage.vue')
    },
    // New Apps Routes
    {
      path: '/apps/ocr',
      name: 'app-ocr',
      component: () => import('@/views/apps/OCRTool.vue'),
      meta: { title: '智能 OCR' }
    },
    {
      path: '/apps/image-gen',
      name: 'app-image-gen',
      component: () => import('@/views/apps/ImageGenTool.vue'),
      meta: { title: '图片生成' }
    },
    {
      path: '/apps/chat',
      name: 'app-chat',
      component: () => import('@/views/apps/ChatTool.vue'),
      meta: { title: 'AI 教学助手' }
    },
    {
      path: '/apps/interaction',
      name: 'app-interaction',
      component: () => import('@/views/apps/TeachingInteraction.vue'),
      meta: { title: '教学交互' }
    },
    {
      path: '/apps/ppt',
      name: 'app-ppt',
      component: () => import('@/views/apps/TeachingPPT.vue'),
      meta: { title: 'PPT 设计' }
    },
    {
      path: '/apps/lesson-plan',
      name: 'app-lesson-plan',
      component: () => import('@/views/apps/LessonPlan.vue'),
      meta: { title: '教案设计' }
    },
    {
      path: '/apps/student-stats',
      name: 'app-student-stats',
      component: () => import('@/views/apps/StudentStats.vue'),
      meta: { title: '学生统计' }
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
        }
      ]
    }
  ]
})

export default router
