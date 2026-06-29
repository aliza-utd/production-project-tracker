import { db } from '@/firebase-service'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from '@/stores/auth'

export function useActivityLog() {
  const auth = useAuthStore()

  function sanitizeDetails(obj) {
    const clean = {}
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) clean[key] = obj[key] ?? null
    }
    return clean
  }

  async function logActivity(projectId, action, details = {}) {
    if (!projectId || !auth.currentUser) return
    const payload = {
      action,
      details: sanitizeDetails(details),
      performedBy: {
        uid:  auth.currentUser.uid,
        name: auth.currentUser.name,
      },
      timestamp: serverTimestamp(),
    }
    console.log('=== FIRESTORE WRITE ATTEMPT ===')
    console.log(`Document path: projects/${projectId}/activity_log/<new>`)
    console.log('User UID:', auth.currentUser.uid)
    console.log('Action:', action)
    try {
      await addDoc(collection(db, 'projects', projectId, 'activity_log'), payload)
      console.log('=== WRITE SUCCESS === activity_log')
    } catch (error) {
      console.error('=== WRITE FAILED === activity_log')
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      console.error('User UID:', auth.currentUser?.uid)
    }
  }

  return { logActivity }
}
