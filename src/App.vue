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
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import LoginPage from '@/pages/LoginPage.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const router    = useRouter()
const authStore = useAuthStore()
const notifStore = useNotificationsStore()
const authState = computed(() => authStore.authState)

watch(authState, (state) => {
  if (state === 'authenticated') {
    if (router.currentRoute.value.path === '/login') router.push('/')
    // Start real-time notification listener for this user
    notifStore.fetchNotifications(authStore.currentUser?.uid)
  } else if (state === 'login') {
    if (router.currentRoute.value.path !== '/login') router.push('/login')
    notifStore.stopListener()
  }
})
</script>
