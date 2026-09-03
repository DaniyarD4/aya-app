import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'today', component: () => import('@/views/TodayView.vue') },
    { path: '/rhythm', name: 'rhythm', component: () => import('@/views/RhythmView.vue') },
    { path: '/flow', name: 'flow', component: () => import('@/views/FlowView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  ],
})

export default router
