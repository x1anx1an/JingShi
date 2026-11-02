import { createRouter, createWebHashHistory } from 'vue-router'
import MainLayout from '@renderer/layouts/MainLayout.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: MainLayout,
      children: [
        {
          path: '',
          name: 'today',
          component: () => import('@renderer/views/TodayView.vue'),
          meta: { title: '今日看板', kicker: 'TODAY' }
        },
        {
          path: 'week',
          name: 'week',
          component: () => import('@renderer/views/WeekView.vue'),
          meta: { title: '周视图', kicker: 'WEEK' }
        },
        {
          path: 'records',
          name: 'records',
          component: () => import('@renderer/views/RecordsView.vue'),
          meta: { title: '执行记录', kicker: 'RECORDS' }
        },
        {
          path: 'stats',
          name: 'stats',
          component: () => import('@renderer/views/StatsView.vue'),
          meta: { title: '统计', kicker: 'INSIGHTS' }
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@renderer/views/SettingsView.vue'),
          meta: { title: '设置', kicker: 'SETTINGS' }
        },
        {
          path: 'about',
          name: 'about',
          component: () => import('@renderer/views/AboutView.vue'),
          meta: { title: '关于静时', kicker: 'ABOUT' }
        }
      ]
    },
    {
      path: '/float',
      name: 'float',
      component: () => import('@renderer/views/FloatView.vue'),
      meta: { transparent: true }
    },
    {
      path: '/reminder',
      name: 'reminder',
      component: () => import('@renderer/views/ReminderView.vue'),
      meta: { transparent: true }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
