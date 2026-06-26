import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeToProjects,
  createProjectInFirestore,
  updateProjectInFirestore,
  archiveProjectInFirestore,
  getArchivedProjects,
} from '@/firebase-service'

export const useProjectsStore = defineStore('projects', () => {
  const projects  = ref([])
  const loading   = ref(false)
  let   unsubscribe = null

  function fetchProjects() {
    console.log('[Projects] fetchProjects called')
    loading.value = true
    if (unsubscribe) unsubscribe()
    unsubscribe = subscribeToProjects(
      (snapshot) => {
        console.log('[Projects] Snapshot received, docs:', snapshot.docs.length)
        if (snapshot.docs.length) console.log('[Projects] First doc:', snapshot.docs[0].data())
        projects.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        loading.value  = false
      },
      (err) => {
        console.error('[Projects] Snapshot error:', err.code, err.message)
        loading.value = false
      }
    )
  }

  async function createProject(data) {
    console.log('[Projects] Creating:', data.name)
    try {
      const result = await createProjectInFirestore(data)
      console.log('[Projects] Created with ID:', result.id)
      return result
    } catch (err) {
      console.error('[Projects] Create error:', err.code, err.message)
      throw err
    }
  }

  async function updateProject(id, data) {
    return updateProjectInFirestore(id, data)
  }

  async function archiveProject(id, by, at) {
    return archiveProjectInFirestore(id, by, at)
  }

  async function fetchArchived() {
    return getArchivedProjects()
  }

  function stopListener() {
    if (unsubscribe) { unsubscribe(); unsubscribe = null }
  }

  return {
    projects, loading,
    fetchProjects, createProject, updateProject, archiveProject, fetchArchived, stopListener,
  }
})
