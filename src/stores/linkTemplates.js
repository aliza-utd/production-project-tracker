import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeLinkTemplates,
  seedLinkTemplates,
  addLinkTemplate,
  updateLinkTemplate,
  deleteLinkTemplate,
} from '@/firebase-service'

export const useLinkTemplatesStore = defineStore('linkTemplates', () => {
  const templates    = ref([])  // sorted array of { id, name, order }
  const loaded       = ref(false)
  let   unsubscribe  = null
  let   seedAttempted = false

  function fetchTemplates() {
    if (unsubscribe) return
    unsubscribe = subscribeLinkTemplates(
      async (snap) => {
        if (!snap.empty) {
          templates.value = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.order || 0) - (b.order || 0))
          loaded.value = true
          return
        }
        if (!seedAttempted) {
          seedAttempted = true
          try { await seedLinkTemplates() } catch (e) { console.warn('[LinkTemplates] Seed failed:', e) }
        }
        loaded.value = true
      },
      (err) => {
        console.error('[LinkTemplates] snapshot error:', err)
        loaded.value = true
      }
    )
  }

  async function addTemplate(name) {
    const maxOrder = templates.value.reduce((m, t) => Math.max(m, t.order || 0), 0)
    return addLinkTemplate({ name, order: maxOrder + 1 })
  }

  async function renameTemplate(id, name) {
    return updateLinkTemplate(id, { name })
  }

  async function moveTemplate(idx, dir) {
    const arr  = [...templates.value]
    const dest = idx + dir
    if (dest < 0 || dest >= arr.length) return
    const a = arr[idx]
    const b = arr[dest]
    await Promise.all([
      updateLinkTemplate(a.id, { order: b.order }),
      updateLinkTemplate(b.id, { order: a.order }),
    ])
  }

  async function removeTemplate(id) {
    return deleteLinkTemplate(id)
  }

  function stopListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
    loaded.value = false
  }

  return { templates, loaded, fetchTemplates, addTemplate, renameTemplate, moveTemplate, removeTemplate, stopListener }
})
