<template>
  <!-- Bell button (positioned in topbar via App.vue slot or fixed top-right) -->
  <div class="notif-wrap" @click.stop>
    <button class="notif-btn" @click="showPanel = !showPanel" title="Notifications">
      🔔
      <span v-if="unreadCount > 0" class="notif-badge">
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>
  </div>

  <!-- Panel — Teleported so z-index isn't clipped by any stacking context -->
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
          You're all caught up! No notifications.
        </div>

        <div v-else class="notif-list">
          <div
            v-for="n in notifications"
            :key="n.id"
            class="notif-item"
            :class="{ unread: !n.read }"
            @click="handleNotifClick(n)"
          >
            <span class="notif-icon">
              {{
                n.type === 'deadline_overdue' ? '🚨'
                : n.type === 'deadline_warning' ? '⏰'
                : n.type === 'comment' ? '💬'
                : '🔔'
              }}
            </span>
            <div class="notif-body">
              <div class="notif-msg">{{ n.message }}</div>
              <div class="notif-time">{{ fmtDateTime(n.createdAt) }}</div>
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
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '@/stores/notifications'

const router    = useRouter()
const notifStore = useNotificationsStore()

const showPanel   = ref(false)
const notifications = computed(() => notifStore.notifications)
const unreadCount   = computed(() => notifStore.unreadCount)
const loading       = computed(() => notifStore.loading)

function fmtDateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch {
    return iso
  }
}

async function handleMarkAllRead() {
  await notifStore.markAllRead()
}

async function handleNotifClick(n) {
  showPanel.value = false
  if (!n.read) await notifStore.markAsRead(n.id)
  if (n.projectId) router.push(`/projects/${n.projectId}`)
}
</script>

<style scoped>
/* Fixed position in top-right corner of the app shell */
.notif-wrap {
  position: fixed;
  top: 12px;
  right: 16px;
  z-index: 60;
}
</style>
