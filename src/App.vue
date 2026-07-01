<template>
  <!-- /join/:code is publicly accessible — show it regardless of auth state -->
  <RouterView v-if="isJoinRoute" />

  <!-- Auth screens (loading / login / denied / setup / error) -->
  <LoginPage v-else-if="authState !== 'authenticated'" />

  <!-- App shell — only rendered when fully authenticated -->
  <div v-else class="app-layout">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore }          from '@/stores/auth'
import { useProjectsStore }      from '@/stores/projects'
import { usePhasesStore }        from '@/stores/phases'
import { useTeamStore }          from '@/stores/team'
import { useRolesStore }         from '@/stores/roles'
import { useNotificationsStore } from '@/stores/notifications'
import { useStatusesStore }      from '@/stores/statuses'
import { useLinkTemplatesStore } from '@/stores/linkTemplates'
import { useStatusStyles }       from '@/composables/useStatusStyles'
import LoginPage         from '@/pages/LoginPage.vue'
import Sidebar           from '@/components/layout/Sidebar.vue'

const router        = useRouter()
const route         = useRoute()
const authStore          = useAuthStore()
const projectsStore      = useProjectsStore()
const phasesStore        = usePhasesStore()
const teamStore          = useTeamStore()
const rolesStore         = useRolesStore()
const notifStore         = useNotificationsStore()
const statusesStore      = useStatusesStore()
const linkTemplatesStore = useLinkTemplatesStore()

useStatusStyles()

const authState  = computed(() => authStore.authState)
const isJoinRoute = computed(() => route.path.startsWith('/join/'))

watch(authState, (state) => {
  if (state === 'authenticated') {
    if (router.currentRoute.value.path === '/login') router.push('/')
    const user       = authStore.currentUser
    const canViewAll = user?.permissions?.canViewAllProjects !== false
    const userFilter = canViewAll ? null : { uid: user.uid, memberId: user.memberId }
    projectsStore.fetchProjects(userFilter)
    phasesStore.fetchPhaseConfig()
    teamStore.fetchTeamMembers()
    rolesStore.fetchRoles()
    statusesStore.fetchStatuses()
    linkTemplatesStore.fetchTemplates()
    notifStore.fetchNotifications(user?.uid)
  } else if (state === 'login') {
    const cp = router.currentRoute.value.path
    if (cp !== '/login' && !cp.startsWith('/join/')) router.push('/login')
    projectsStore.stopListener()
    phasesStore.stopListener()
    rolesStore.stopListener()
    statusesStore.stopListener()
    notifStore.stopListener()
  }
}, { immediate: true })
</script>
