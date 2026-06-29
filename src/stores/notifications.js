import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/firebase-service'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications   = ref([])
  const loading         = ref(false)
  let   currentUserId   = null
  let   unsubscribe     = null

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )

  function fetchNotifications(userId) {
    console.log('[Notifications] fetchNotifications called — userId:', userId)
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
    if (!userId) {
      console.log('[Notifications] ABORT — userId is falsy, no listener started')
      return
    }
    currentUserId = userId
    loading.value = true
    console.log('[Notifications] Starting onSnapshot listener for userId:', userId)
    unsubscribe = subscribeToNotifications(
      userId,
      (snap) => {
        console.log('[Notifications] onSnapshot fired — docs:', snap.docs.length, '| fromCache:', snap.metadata.fromCache, '| hasPendingWrites:', snap.metadata.hasPendingWrites)
        notifications.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt || 0)
            const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt || 0)
            return tb - ta
          })
          .slice(0, 50)
        console.log('[Notifications] notifications.value updated — total:', notifications.value.length, '| unread:', notifications.value.filter(n => !n.read).length)
        loading.value = false
      },
      (err) => {
        console.error('[Notifications] onSnapshot error — listener is now DEAD:', err.code, err.message)
        loading.value = false
      }
    )
  }

  async function markAsRead(id) {
    const n = notifications.value.find(x => x.id === id)
    if (n) n.read = true
    await markNotificationRead(id)
  }

  async function markAllRead() {
    notifications.value.forEach(n => { n.read = true })
    await markAllNotificationsRead(currentUserId)
  }

  function stopListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
  }

  return {
    notifications, loading, unreadCount,
    fetchNotifications, markAsRead, markAllRead, stopListener,
  }
})
