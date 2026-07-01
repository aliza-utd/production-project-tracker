import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  subscribeToWeeklyNotesFields,
  setWeeklyNotesField,
  createWeeklyNotesField,
  deleteWeeklyNotesField,
  seedDefaultWeeklyNotesFields,
} from '@/firebase-service'

const FALLBACK_FIELDS = [
  { id: 'ongoingTasks',    name: 'Ongoing Tasks',      order: 1, isDefault: true },
  { id: 'blockers',        name: 'Blockers / Issues',  order: 2, isDefault: true },
  { id: 'endOfWeekUpdate', name: 'End of Week Update', order: 3, isDefault: true },
]

export const useWeeklyNotesFieldsStore = defineStore('weeklyNotesFields', () => {
  const _raw   = ref([])
  const loaded = ref(false)
  let   unsub  = null
  let   _ready = null

  const fields = computed(() =>
    _raw.value.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  )

  function fetchFields() {
    if (unsub) return _ready

    _ready = new Promise((resolve) => {
      let resolved = false
      const done = () => { if (!resolved) { resolved = true; resolve() } }

      unsub = subscribeToWeeklyNotesFields(
        async (snap) => {
          if (snap.empty) {
            try {
              await seedDefaultWeeklyNotesFields()
              // Next snapshot will fire with the seeded docs
            } catch (e) {
              console.warn('[WeeklyNotesFields] seed failed:', e.message)
              _raw.value   = [...FALLBACK_FIELDS]
              loaded.value = true
              done()
            }
            return
          }
          _raw.value   = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          loaded.value = true
          done()
        },
        (err) => {
          console.error('[WeeklyNotesFields] read error:', err)
          _raw.value   = [...FALLBACK_FIELDS]
          loaded.value = true
          done()
        }
      )
    })

    return _ready
  }

  function stopListener() {
    if (unsub) { unsub(); unsub = null }
    loaded.value = false
    _ready       = null
  }

  async function addField(name) {
    const maxOrder = _raw.value.reduce((m, f) => Math.max(m, f.order ?? 0), 0)
    await createWeeklyNotesField({ name, order: maxOrder + 1, isDefault: false })
  }

  async function updateField(id, patch) {
    const existing = _raw.value.find(f => f.id === id)
    if (!existing) return
    await setWeeklyNotesField(id, { ...existing, ...patch })
  }

  async function removeField(id) {
    await deleteWeeklyNotesField(id)
  }

  return { fields, loaded, fetchFields, stopListener, addField, updateField, removeField }
})
