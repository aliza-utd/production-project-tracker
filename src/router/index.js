import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Dashboard     from '@/pages/Dashboard.vue'
import Projects      from '@/pages/Projects.vue'
import ProjectDetail from '@/pages/ProjectDetail.vue'
import WeeklyTracker from '@/pages/WeeklyTracker.vue'
import WeeklyNotes   from '@/pages/WeeklyNotes.vue'
import Reports       from '@/pages/Reports.vue'
import Archived      from '@/pages/Archived.vue'
import Settings      from '@/pages/Settings.vue'
import TeamMembers   from '@/pages/TeamMembers.vue'
import PhaseSettings from '@/pages/PhaseSettings.vue'
import JoinPage      from '@/pages/JoinPage.vue'

const routes = [
  {
    path: '/login',
    component: { template: '<div></div>' },
    meta: { public: true },
  },
  {
    path: '/join/:code',
    component: JoinPage,
    meta: { public: true },
  },
  {
    path: '/',
    component: Dashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/projects',
    component: Projects,
    meta: { requiresAuth: true },
  },
  {
    path: '/projects/:id',
    component: ProjectDetail,
    meta: { requiresAuth: true },
  },
  {
    path: '/weekly-tracker',
    component: WeeklyTracker,
    meta: { requiresAuth: true },
  },
  {
    path: '/weekly-notes',
    component: WeeklyNotes,
    meta: { requiresAuth: true },
  },
  {
    path: '/reports',
    component: Reports,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/archived',
    component: Archived,
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    component: Settings,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/team-members',
    component: TeamMembers,
    meta: { requiresAuth: true, requiresManager: true },
  },
  {
    path: '/phase-settings',
    component: PhaseSettings,
    meta: { requiresAuth: true, requiresManager: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  const authenticated = auth.authState === 'authenticated'

  if (auth.authState === 'loading') return true
  if (to.meta.requiresAuth && !authenticated) return '/login'
  if (to.path === '/login' && authenticated) return '/'
  if (to.meta.requiresManager && !auth.isManager) return '/'
})

export default router
