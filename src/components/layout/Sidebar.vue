<template>
  <nav class="sb">
    <!-- Identity block -->
    <div class="sb-identity sb-identity-border">
      <span class="sb-dot" />
      <div>
        <div class="sb-title">Project tracker</div>
        <div class="sb-subtitle">Web dev team</div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="sb-nav">
      <RouterLink class="nav-item" to="/" exact-active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>Dashboard</span>
      </RouterLink>

      <RouterLink class="nav-item" to="/projects" active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
        <span>Projects</span>
      </RouterLink>

      <RouterLink v-if="showFullNav" class="nav-item" to="/weekly-tracker" active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>Weekly tracker</span>
      </RouterLink>

      <RouterLink class="nav-item" to="/weekly-notes" active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>Weekly notes</span>
      </RouterLink>

      <RouterLink v-if="showReports" class="nav-item" to="/reports" active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span>Reports</span>
      </RouterLink>

      <RouterLink v-if="showSettings" class="nav-item" to="/settings" active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
        <span>Settings</span>
      </RouterLink>

      <RouterLink v-if="showTeamMembers" class="nav-item" to="/team-members" active-class="active">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
        <span>Team members</span>
      </RouterLink>

    </div>

    <!-- User footer + sign out -->
    <div class="sb-footer">
      <div class="sb-avatar">{{ currentUser?.initials || '' }}</div>
      <div class="sb-user-info">
        <div class="sb-user-name">{{ currentUser?.name || '' }}</div>
        <div class="sb-user-role">{{ currentUser?.role || '' }}</div>
      </div>
      <button class="sb-theme-btn" @click="toggleTheme" :title="isDark ? 'Light mode' : 'Dark mode'">
        <!-- Moon: shown in light mode to switch to dark -->
        <svg v-if="!isDark" class="sb-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
        <!-- Sun: shown in dark mode to switch to light -->
        <svg v-else class="sb-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      </button>
    </div>
    <button class="sb-signout-btn" @click="handleLogout">
      <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      <span>Sign out</span>
    </button>
  </nav>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore   = useAuthStore()
const currentUser = computed(() => authStore.currentUser)
const perms       = computed(() => authStore.currentUser?.permissions || {})

const showReports = computed(() =>
  perms.value.canAccessSettings === true ||
  perms.value.isAdmin === true ||
  authStore.isManager
)
const showSettings = computed(() =>
  perms.value.canAccessSettings === true || authStore.isManager
)
const showTeamMembers = computed(() =>
  perms.value.canManageTeam === true || authStore.isManager
)
const showFullNav = computed(() =>
  perms.value.canViewAllProjects === true || authStore.isManager
)

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
