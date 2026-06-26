<template>
  <nav class="sb">
    <!-- Logo -->
    <div class="sb-logo">
      <h1>🚀 Project Tracker</h1>
      <p>Web Dev Team</p>
    </div>

    <!-- Navigation -->
    <div class="sb-nav">
      <RouterLink class="nav-item" to="/" active-class="" exact-active-class="active">
        <span class="ico">🏠</span><span>Dashboard</span>
      </RouterLink>
      <RouterLink class="nav-item" to="/projects" active-class="active">
        <span class="ico">📋</span><span>Projects</span>
      </RouterLink>
      <RouterLink class="nav-item" to="/weekly-tracker" active-class="active">
        <span class="ico">📅</span><span>Weekly Tracker</span>
      </RouterLink>
      <RouterLink class="nav-item" to="/weekly-notes" active-class="active">
        <span class="ico">📝</span><span>Weekly Notes</span>
      </RouterLink>
      <RouterLink v-if="isManager" class="nav-item" to="/reports" active-class="active">
        <span class="ico">📊</span><span>Reports</span>
      </RouterLink>
      <RouterLink class="nav-item" to="/archived" active-class="active">
        <span class="ico">🗄️</span><span>Archived</span>
      </RouterLink>
      <RouterLink class="nav-item" to="/settings" active-class="active">
        <span class="ico">⚙️</span><span>Settings</span>
      </RouterLink>
      <RouterLink v-if="isManager" class="nav-item" to="/team-members" active-class="active">
        <span class="ico">👥</span><span>Team Members</span>
      </RouterLink>
      <RouterLink v-if="isManager" class="nav-item" to="/phase-settings" active-class="active">
        <span class="ico">🔧</span><span>Phase Settings</span>
      </RouterLink>
      <button class="nav-item" @click="handleLogout">
        <span class="ico">🚪</span><span>Sign Out</span>
      </button>
    </div>

    <!-- Bottom: user info + dark mode toggle -->
    <div class="sb-bottom">
      <div class="sb-user">
        <div
          class="avatar avatar-sm"
          :style="{ background: currentUser?.avatarColor || '#6366f1' }"
        >
          {{ currentUser?.initials || '' }}
        </div>
        <div class="sb-user-info">
          <div class="sb-user-name">{{ currentUser?.name || '' }}</div>
          <div class="sb-user-role">{{ currentUser?.role || '' }}</div>
        </div>
      </div>
      <button
        class="btn btn-secondary btn-sm"
        style="width:100%;margin-bottom:6px;justify-content:center"
        @click="toggleTheme"
      >
        <span>{{ isDark ? '☀️' : '🌙' }}</span>
        <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
      </button>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore   = useAuthStore()
const currentUser = computed(() => authStore.currentUser)
const isManager   = computed(() => authStore.isManager)

const isDark = ref(localStorage.getItem('pt_theme') === 'dark')

function toggleTheme() {
  isDark.value = !isDark.value
  document.body.classList.toggle('dark', isDark.value)
  localStorage.setItem('pt_theme', isDark.value ? 'dark' : 'light')
}

async function handleLogout() {
  await authStore.logout()
}
</script>
