<template>
  <div class="notif-wrap" @click.stop>
    <button class="notif-btn" @click="showPanel = !showPanel" title="Notifications">
      🔔
      <span v-if="unreadCount > 0" class="notif-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>
  </div>

  <Teleport to="body">
    <template v-if="showPanel">
      <!-- Backdrop -->
      <div
        style="position:fixed;inset:0;z-index:149"
        @click="showPanel = false"
      ></div>

      <!-- Panel -->
      <div class="notif-panel">
        <div class="notif-panel-hdr">
          <span class="notif-panel-title">🔔 Notifications</span>
          <button
            v-if="unreadCount > 0"
            class="btn btn-ghost btn-xs"
            @click="handleMarkAllRead"
          >
            Mark all read
          </button>
        </div>

        <div
          v-if="loading"
          style="padding:24px;text-align:center;color:var(--muted);font-size:13px"
        >
          <span style="display:inline-block;animation:spin 1s linear infinite">⏳</span>
          Loading…
        </div>

        <div v-else-if="notifications.length === 0" class="notif-empty">
          You're all caught up! No new notifications.
        </div>

        <div v-else class="notif-list">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-item"
            :class="{ unread: !n.read }"
            @click="handleNotifClick(n)"
          >
            <!-- Icon -->
            <span class="notif-icon">{{ notifIcon(n.type) }}</span>

            <!-- Body -->
            <div class="notif-body">
              <div class="notif-msg">{{ n.message }}</div>
              <!-- Comment preview -->
              <div v-if="n.commentPreview" class="notif-preview">
                "{{ n.commentPreview }}{{ n.commentPreview.length >= 80 ? '…' : '' }}"
              </div>
              <div class="notif-time-row">
                <span class="notif-time">{{ fmtTs(n.createdAt) }}</span>
                <span v-if="n.projectId" class="notif-goto">→ View project</span>
              </div>
            </div>

            <div v-if="!n.read" class="notif-dot"></div>
          </div>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'

const router     = useRouter()
const notifStore = useNotificationsStore()
const showPanel  = ref(false)

// storeToRefs extracts the store's reactive refs directly — no intermediate
// computed wrapper — so Vue tracks notifications.value as a first-class dep.
const { notifications, loading } = storeToRefs(notifStore)
const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

function notifIcon(type) {
  if (type === 'mention')          return '👤'
  if (type === 'new_comment')      return '💬'
  if (type === 'comment')          return '💬'
  if (type === 'phase_status')     return '🔄'
  if (type === 'phase_started')    return '▶️'
  if (type === 'assignment')       return '📋'
  if (type === 'deadline_overdue') return '🚨'
  if (type === 'deadline_warning') return '⏰'
  return '🔔'
}

function fmtTs(value) {
  if (!value) return ''
  let date
  if (value && typeof value.toDate === 'function') {
    date = value.toDate()
  } else if (value?.seconds) {
    date = new Date(value.seconds * 1000)
  } else {
    date = new Date(value)
  }
  if (isNaN(date.getTime())) return ''
  const diff  = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  if (days < 7)   return `${days}d ago`
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

async function handleMarkAllRead() {
  await notifStore.markAllRead()
}

async function handleNotifClick(n) {
  showPanel.value = false
  if (!n.read) await notifStore.markAsRead(n.id)
  if (n.projectId) {
    const isCommentType = n.type === 'mention' || n.type === 'new_comment' || n.type === 'comment'
    const isPhaseType   = n.type === 'phase_status' || n.type === 'phase_started'
    const tab = isCommentType ? '?tab=comments' : isPhaseType ? '?tab=phases' : ''
    router.push(`/projects/${n.projectId}${tab}`)
  }
}
</script>

<style scoped>
.notif-wrap {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 60;
}
</style>
