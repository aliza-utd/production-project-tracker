import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeToChecklistTemplates,
  saveChecklistTemplate,
  deleteChecklistTemplate,
} from '@/firebase-service'

export const useChecklistTemplatesStore = defineStore('checklistTemplates', () => {
  const templates  = ref({})  // { phaseId: { id, phaseId, items: [{id, name, order}] } }
  const loading    = ref(false)
  let   unsubscribe   = null
  let   _readyPromise = null

  function fetchTemplates() {
    if (unsubscribe) return _readyPromise   // already listening — return existing promise
    loading.value = true
    _readyPromise = new Promise((resolve) => {
      unsubscribe = subscribeToChecklistTemplates(
        (snap) => {
          const map = {}
          snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } })
          templates.value = map
          loading.value   = false
          resolve()
        },
        (err) => {
          console.error('[ChecklistTemplates] snapshot error:', err)
          loading.value = false
          resolve()   // resolve even on error so callers don't hang
        }
      )
    })
    return _readyPromise
  }

  async function saveTemplate(phaseId, items) {
    await saveChecklistTemplate(phaseId, items)
  }

  async function removeTemplate(phaseId) {
    await deleteChecklistTemplate(phaseId)
    delete templates.value[phaseId]
  }

  function getTemplateItems(phaseId) {
    return templates.value[phaseId]?.items || []
  }

  function stopListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
  }

  return {
    templates, loading,
    fetchTemplates, saveTemplate, removeTemplate, getTemplateItems, stopListener,
  }
})
