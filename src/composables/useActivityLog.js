import { db } from '@/firebase-service'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from '@/stores/auth'

export function useActivityLog() {
  const auth = useAuthStore()

  async function logActivity(projectId, action, details = {}) {
    if (!projectId || !auth.currentUser) return
    try {
      await addDoc(
        collection(db, 'projects', projectId, 'activity_log'),
        {
          action,
          details,
          performedBy: {
            uid:  auth.currentUser.uid,
            name: auth.currentUser.name,
          },
          timestamp: serverTimestamp(),
        }
      )
    } catch (error) {
      console.error('[ActivityLog] Failed to log:', error)
    }
  }

  return { logActivity }
}
