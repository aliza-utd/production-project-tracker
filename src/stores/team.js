import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getTeamMembersFromFirestore,
  createTeamMember,
  updateTeamMember,
} from '@/firebase-service'

export const useTeamStore = defineStore('team', () => {
  const teamMembers = ref([])

  async function fetchTeamMembers() {
    teamMembers.value = await getTeamMembersFromFirestore()
  }

  async function addMember(data) {
    const created = await createTeamMember(data)
    teamMembers.value.push(created)
    return created
  }

  async function editMember(id, data) {
    await updateTeamMember(id, data)
    const idx = teamMembers.value.findIndex(m => m.id === id)
    if (idx !== -1) Object.assign(teamMembers.value[idx], data)
  }

  return { teamMembers, fetchTeamMembers, addMember, editMember }
})
