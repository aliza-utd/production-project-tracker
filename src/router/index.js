import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    // LoginPage is statically imported by App.vue; this route exists only for
    // URL management (guard redirects + watcher). The component is never
    // rendered via RouterView because App.vue uses v-if before <RouterView>.
    component: { template: '<div></div>' },
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/pages/Dashboard.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/projects',
    component: () => import('@/pages/Projects.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/projects/:id',
    component: () => import('@/pages/ProjectDetail.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/weekly-tracker',
    component: () => import('@/pages/WeeklyTracker.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/weekly-notes',
    component: () => import('@/pages/WeeklyNotes.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/reports',
    component: () => import('@/pages/Reports.vue'),
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/archived',
    component: () => import('@/pages/Archived.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    component: () => import('@/pages/Settings.vue'),
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/team-members',
    component: () => import('@/pages/TeamMembers.vue'),
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/phase-settings',
    component: () => import('@/pages/PhaseSettings.vue'),
    meta: { requiresAuth: true, requiresManager: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// By the time this guard runs, initAuth() has already resolved in main.js,
// so authState is never 'loading' on initial navigation.
router.beforeEach((to) => {
  const auth = useAuthStore()
  const authenticated = auth.authState === 'authenticated'

  // Auth still settling (sign-in / sign-out in flight) — let App.vue handle it
  if (auth.authState === 'loading') return true

  // Non-public route but not authenticated → go to login
  if (to.meta.requiresAuth && !authenticated) {
    return '/login'
  }

  // Already authenticated, trying to hit /login → go home
  if (to.path === '/login' && authenticated) {
    return '/'
  }

  // Manager-only route but user is not a Manager → go home
  if (to.meta.requiresManager && !auth.isManager) {
    return '/'
  }
})

export default router
