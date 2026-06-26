<template>
  <!-- Auth screens (loading / login / denied / setup / error) -->
  <LoginPage v-if="authState !== 'authenticated'" />

  <!-- App shell — only rendered when fully authenticated -->
  <div v-else class="app-layout">
    <Sidebar />
    <main class="main-content">
      <RouterView />
    </main>
    <NotificationBell />
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore }         from '@/stores/auth'
import { useProjectsStore }     from '@/stores/projects'
import { usePhasesStore }       from '@/stores/phases'
import { useTeamStore }         from '@/stores/team'
import { useNotificationsStore } from '@/stores/notifications'
import LoginPage from '@/pages/LoginPage.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const router        = useRouter()
const authStore     = useAuthStore()
const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const teamStore     = useTeamStore()
const notifStore    = useNotificationsStore()
const authState     = computed(() => authStore.authState)

// immediate: true is required — when a logged-in user refreshes the page,
// authState is already 'authenticated' when this watcher is registered,
// so without immediate the callbacks would never fire.
watch(authState, (state) => {
  if (state === 'authenticated') {
    if (router.currentRoute.value.path === '/login') router.push('/')
    console.log('[Auth] User loaded, initialising app data')
    // Start all real-time listeners now that auth is confirmed
    projectsStore.fetchProjects()
    phasesStore.fetchPhaseConfig()
    teamStore.fetchTeamMembers()
    notifStore.fetchNotifications(authStore.currentUser?.uid)
  } else if (state === 'login') {
    if (router.currentRoute.value.path !== '/login') router.push('/login')
    // Tear down all listeners on logout
    projectsStore.stopListener()
    phasesStore.stopListener()
    notifStore.stopListener()
  }
}, { immediate: true })
</script>
