import { defineStore } from 'pinia'
import { ref } from 'vue'
import { subscribeToPhaseConfig, savePhaseConfigToFirestore } from '@/firebase-service'

export const DEFAULT_PHASE_CONFIG = [
  {
    id: 'kickstart', name: 'Kickstart', color: '#6366f1', bg: '#eef2ff',
    subPhases: [],
  },
  {
    id: 'setup', name: 'Setup', color: '#8b5cf6', bg: '#f5f3ff',
    subPhases: [],
  },
  {
    id: 'production', name: 'Production', color: '#f59e0b', bg: '#fffbeb',
    subPhases: [
      { id: 'multimedia',      name: 'Multimedia' },
      { id: 'development',     name: 'Development' },
      { id: 'design_approval', name: 'Design Approval' },
      { id: 'web_services',    name: 'Web Services' },
    ],
  },
  {
    id: 'qa', name: 'QA', color: '#ec4899', bg: '#fdf2f8',
    subPhases: [
      { id: 'qa_initial',       name: 'Initial' },
      { id: 'qa_golive',        name: 'Go-Live' },
      { id: 'qa_live_checking', name: 'Live Checking' },
    ],
  },
  {
    id: 'golive', name: 'Go-Live', color: '#10b981', bg: '#ecfdf5',
    subPhases: [],
  },
  {
    id: 'activation', name: 'Activation', color: '#3b82f6', bg: '#eff6ff',
    subPhases: [],
  },
]

export const usePhasesStore = defineStore('phases', () => {
  const phaseConfig = ref([...DEFAULT_PHASE_CONFIG])
  const loading     = ref(false)
  let   unsubscribe = null

  function fetchPhaseConfig() {
    if (unsubscribe) unsubscribe()
    unsubscribe = subscribeToPhaseConfig(
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          if (data?.phases?.length) phaseConfig.value = data.phases
        }
      },
      (err) => console.error('Phase config listener error:', err)
    )
  }

  async function saveConfig(phases, updatedBy) {
    await savePhaseConfigToFirestore(phases, updatedBy)
    phaseConfig.value = phases
  }

  function stopListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
  }

  return { phaseConfig, loading, fetchPhaseConfig, saveConfig, stopListener }
})
