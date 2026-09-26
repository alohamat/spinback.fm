import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '@/views/Dashboard.vue'
import LibraryView from '@/views/LibraryView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'turntable',
      component: Dashboard,
    },
    {
      path: '/library',
      name: 'library',
      component: LibraryView,
    },
  ],
})

export default router
