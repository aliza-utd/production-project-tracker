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
    loading.value = true
    if (unsubscribe) unsubscribe()
    unsubscribe = subscribeToProjects(
      (snapshot) => {
        projects.value = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        loading.value  = false
      },
      (err) => {
        console.error('Projects listener error:', err)
        loading.value = false
      }
    )
  }

  async function createProject(data) {
    return createProjectInFirestore(data)
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
