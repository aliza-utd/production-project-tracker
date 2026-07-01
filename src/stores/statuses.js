import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeToStatuses,
  seedDefaultStatuses,
  createStatusInFirestore,
  updateStatusInFirestore,
  deleteStatusInFirestore,
} from '@/firebase-service'

// Exact approved badge colors for the 4 pre-seeded defaults.
// Used as in-memory fallback when Firestore is unreachable.
const FALLBACK_STATUSES = [
  {
    id: 'not-started', name: 'Not Started', baseColor: '#94a3b8',
    lightBg: '#F1EFE8', lightText: '#64748b',
    darkBg:  '#2C2C2A', darkText:  '#B4B2A9',
    order: 1, isComplete: false, isDefault: true,
  },
  {
    id: 'active', name: 'Active', baseColor: '#f59e0b',
    lightBg: '#FAEEDA', lightText: '#9a3412',
    darkBg:  '#412402', darkText:  '#FAC775',
    order: 2, isComplete: false, isDefault: true,
  },
  {
    id: 'blocked', name: 'Blocked', baseColor: '#ef4444',
    lightBg: '#FCEBEB', lightText: '#b91c1c',
    darkBg:  '#501313', darkText:  '#F09595',
    order: 3, isComplete: false, isDefault: true,
  },
  {
    id: 'done', name: 'Done', baseColor: '#22c55e',
    lightBg: '#EAF3DE', lightText: '#166534',
    darkBg:  '#173404', darkText:  '#97C459',
    order: 4, isComplete: true, isDefault: true,
  },
]

export { FALLBACK_STATUSES as DEFAULT_STATUSES }

export const useStatusesStore = defineStore('statuses', () => {
  const statuses    = ref([])
  const loaded      = ref(false)
  const unsubscribe = ref(null)

  function fetchStatuses() {
    stopListener()
    let seedAttempted = false

    unsubscribe.value = subscribeToStatuses(
      async (snap) => {
        if (!snap.empty) {
          statuses.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          loaded.value   = true
          return
        }
        if (!seedAttempted) {
          seedAttempted = true
          try {
            await seedDefaultStatuses()
            return
          } catch (err) {
            console.warn('[Statuses] Seed failed:', err.code || err.message)
          }
        }
        console.warn('[Statuses] Using in-memory fallback statuses')
        statuses.value = [...FALLBACK_STATUSES]
        loaded.value   = true
      },
      (err) => {
        console.error('[Statuses] Firestore read error:', err)
        statuses.value = [...FALLBACK_STATUSES]
        loaded.value   = true
      }
    )
  }

  function stopListener() {
    if (unsubscribe.value) { unsubscribe.value(); unsubscribe.value = null }
    loaded.value = false
  }

  function statusById(id) {
    return statuses.value.find(s => s.id === id) || null
  }

  // Returns true if the given status ID is marked isComplete.
  // Falls back to id === 'done' when the store isn't loaded yet.
  function isComplete(statusId) {
    if (!statusId) return false
    const s = statusById(statusId)
    if (s) return !!s.isComplete
    return statusId === 'done'
  }

  // Returns the ID of the first status that has isComplete === true.
  function completeStatusId() {
    const s = statuses.value.find(s => s.isComplete)
    return s?.id || 'done'
  }

  async function addStatus(data) {
    return createStatusInFirestore(data)
  }

  async function editStatus(id, data) {
    return updateStatusInFirestore(id, data)
  }

  async function removeStatus(id) {
    return deleteStatusInFirestore(id)
  }

  return {
    statuses, loaded,
    fetchStatuses, stopListener,
    statusById, isComplete, completeStatusId,
    addStatus, editStatus, removeStatus,
  }
})
