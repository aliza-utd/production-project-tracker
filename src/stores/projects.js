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

  // userFilter: null → all projects; { uid, memberId } → only projects where
  // assignedMembers contains an entry matching the user's uid or memberId.
  function fetchProjects(userFilter = null) {
    loading.value = true
    if (unsubscribe) unsubscribe()
    unsubscribe = subscribeToProjects(
      (snapshot) => {
        let docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        if (userFilter) {
          const { uid, memberId } = userFilter
          docs = docs.filter(p =>
            (p.assignedMembers || []).some(m => m.id === uid || (memberId && m.id === memberId))
          )
        }
        projects.value = docs
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
