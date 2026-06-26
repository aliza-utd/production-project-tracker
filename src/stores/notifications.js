import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/firebase-service'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([])
  const loading       = ref(false)
  let   unsubscribe   = null

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read).length
  )

  function fetchNotifications(userId) {
    if (unsubscribe) unsubscribe()
    loading.value = true
    unsubscribe = subscribeToNotifications(
      userId,
      (snap) => {
        notifications.value = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt || 0)
            const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt || 0)
            return tb - ta
          })
        loading.value = false
      },
      (err) => {
        console.error('Notifications listener error:', err)
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
    const unread = notifications.value.filter(n => !n.read)
    unread.forEach(n => { n.read = true })
    await markAllNotificationsRead(unread.map(n => n.id))
  }

  function stopListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
  }

  return {
    notifications, loading, unreadCount,
    fetchNotifications, markAsRead, markAllRead, stopListener,
  }
})
