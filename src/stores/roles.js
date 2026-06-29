import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  subscribeToRoles,
  seedDefaultRoles,
  createRoleInFirestore,
  updateRoleInFirestore,
  deleteRoleInFirestore,
} from '@/firebase-service'

// In-memory fallback — used when Firestore is unreachable or rules block the read.
// Keeps the UI functional even without a Firestore connection.
const FALLBACK_ROLES = [
  { id: 'admin',      name: 'Admin',      order: 1, permissions: { canViewAllProjects: true,  canEditPhases: true,  canManageTeam: true,  canAccessSettings: true,  canEditAllNotes: true,  isReadOnly: false, isAdmin: true  } },
  { id: 'manager',    name: 'Manager',    order: 2, permissions: { canViewAllProjects: true,  canEditPhases: true,  canManageTeam: true,  canAccessSettings: true,  canEditAllNotes: true,  isReadOnly: false, isAdmin: false } },
  { id: 'developer',  name: 'Developer',  order: 3, permissions: { canViewAllProjects: false, canEditPhases: true,  canManageTeam: false, canAccessSettings: false, canEditAllNotes: false, isReadOnly: false, isAdmin: false } },
  { id: 'multimedia', name: 'Multimedia', order: 4, permissions: { canViewAllProjects: true,  canEditPhases: true,  canManageTeam: false, canAccessSettings: false, canEditAllNotes: false, isReadOnly: false, isAdmin: false } },
  { id: 'qa',         name: 'QA',         order: 5, permissions: { canViewAllProjects: true,  canEditPhases: true,  canManageTeam: false, canAccessSettings: false, canEditAllNotes: false, isReadOnly: false, isAdmin: false } },
  { id: 'external',   name: 'External',   order: 6, permissions: { canViewAllProjects: false, canEditPhases: false, canManageTeam: false, canAccessSettings: false, canEditAllNotes: false, isReadOnly: true,  isAdmin: false } },
]

export const useRolesStore = defineStore('roles', () => {
  const roles       = ref([])
  const loaded      = ref(false)
  const unsubscribe = ref(null)

  async function fetchRoles() {
    stopListener()

    // seedAttempted is local to each fetchRoles() call so re-auth re-tries seeding.
    let seedAttempted = false

    console.log('[Roles] Attaching listener…')

    unsubscribe.value = subscribeToRoles(
      async (snap) => {
        console.log('[Roles] Snapshot received', snap.size, snap.docs)

        if (!snap.empty) {
          // Happy path — Firestore has role docs
          roles.value  = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          loaded.value = true

          // Background migration: if any roles are missing the `order` field,
          // seedDefaultRoles will patch them (it checks needsMigration per doc).
          const needsOrderFix = snap.docs.some(d => !('order' in d.data()))
          if (needsOrderFix && !seedAttempted) {
            seedAttempted = true
            console.log('[Roles] Some docs missing order field — running background migration…')
            seedDefaultRoles().catch(err => console.warn('[Roles] Order migration failed:', err.message))
          }

          return
        }

        // Snapshot is empty
        if (!seedAttempted) {
          // First empty snapshot — try to create the 5 default roles
          seedAttempted = true
          console.log('[Roles] Collection empty — seeding defaults…')
          try {
            await seedDefaultRoles()
            // If writes succeeded, onSnapshot fires again with the new docs.
            // Just return and wait for the next snapshot.
            return
          } catch (err) {
            console.warn('[Roles] Seed failed:', err.code || err.message)
          }
        }

        // Still empty after seed attempt (writes were blocked or collection stayed empty).
        // Use in-memory defaults so the UI is functional.
        console.warn('[Roles] Using in-memory fallback roles')
        roles.value  = [...FALLBACK_ROLES]
        loaded.value = true
      },
      (err) => {
        // Firestore rules block the read on the `roles` collection.
        // loaded must still be set to true so the UI doesn't freeze.
        console.error('[Roles] Firestore read error:', err)
        roles.value  = [...FALLBACK_ROLES]
        loaded.value = true
      }
    )

    console.log('[Roles] Listener attached')
  }

  function stopListener() {
    if (unsubscribe.value) { unsubscribe.value(); unsubscribe.value = null }
    loaded.value = false
  }

  // onSnapshot handles roles.value updates — addRole / editRole / removeRole
  // do NOT manually mutate the array.

  async function addRole(data) {
    return createRoleInFirestore(data)
  }

  async function editRole(id, data) {
    return updateRoleInFirestore(id, data)
  }

  async function removeRole(id) {
    return deleteRoleInFirestore(id)
  }

  function getRoleById(id) {
    return roles.value.find(r => r.id === id) || null
  }

  return { roles, loaded, fetchRoles, stopListener, addRole, editRole, removeRole, getRoleById }
})
