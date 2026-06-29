import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  initAuthPersistence, onAuthChange,
  signInWithGoogle, signOutUser,
  getTeamMembersFromFirestore, createTeamMemberWithUID,
  migrateTeamMemberToUID, updateMemberUID,
  getRoleById, seedDefaultRoles,
} from '@/firebase-service'

// authState values:
//   'loading'       — Firebase is resolving the persisted session
//   'login'         — No signed-in user; show Google sign-in button
//   'denied'        — Signed in but email not in team_members
//   'setup'         — Signed in, team_members is empty (first-time setup)
//   'error'         — Firestore unreachable during auth check
//   'authenticated' — Fully authenticated; app is ready

export const useAuthStore = defineStore('auth', () => {
  const currentUser    = ref(null)
  const authState      = ref('loading')
  const deniedEmail    = ref('')
  const setupDefaults  = ref({ name: '', email: '' })
  const pendingFbUser  = ref(null)

  const isManager = computed(() => {
    const p      = currentUser.value?.permissions
    const roleId = currentUser.value?.roleId
    // Primary: check loaded permissions
    if (p?.canAccessSettings === true) return true
    if (p?.isAdmin === true)           return true
    // Fallback: check roleId directly so the sidebar works even when
    // the role doc can't be fetched from Firestore (rules not yet deployed,
    // or auth happens before the roles collection is seeded).
    if (roleId === 'admin' || roleId === 'manager') return true
    // Legacy: role string set before the roleId system existed (also covers
    // 'Admin' in case seedDefaultRoles changed the role field before roleId resolved)
    const role = currentUser.value?.role
    return role === 'Manager' || role === 'Admin'
  })

  function initAuth() {
    return new Promise(async (resolve) => {
      let settled = false

      const settle = () => {
        if (!settled) { settled = true; resolve() }
      }

      try { await initAuthPersistence() } catch (_) {}

      onAuthChange(async (fbUser) => {
        if (!fbUser) {
          currentUser.value = null
          authState.value   = 'login'
          settle()
          return
        }

        authState.value = 'loading'

        try {
          const members = await getTeamMembersFromFirestore()

          if (members.length === 0) {
            pendingFbUser.value = fbUser
            setupDefaults.value = {
              name:  fbUser.displayName || '',
              email: fbUser.email       || '',
            }
            authState.value = 'setup'
            settle()
            return
          }

          const member = members.find(
            m => (m.email || '').toLowerCase() === (fbUser.email || '').toLowerCase()
          )

          if (!member) {
            deniedEmail.value = fbUser.email
            authState.value   = 'denied'
            settle()
            return
          }

          if (member.id !== fbUser.uid) {
            try {
              const migrated = await migrateTeamMemberToUID(member.id, fbUser.uid, member)
              Object.assign(member, migrated)
            } catch (migErr) {
              console.error('[Auth] Migration failed, falling back to uid field update:', migErr)
              try { await updateMemberUID(member.id, fbUser.uid) } catch (_) {}
            }
          }

          // Load permissions from role document if roleId is present
          let permissions = {}
          if (member.roleId) {
            try {
              const roleDoc = await getRoleById(member.roleId)
              if (roleDoc) permissions = roleDoc.permissions || {}
            } catch (_) {}
          }

          currentUser.value = {
            uid:         fbUser.uid,
            name:        member.name        || fbUser.displayName || '',
            email:       fbUser.email,
            role:        member.role        || '',
            roleId:      member.roleId      || null,
            permissions,
            department:  member.department  || '',
            avatarColor: member.avatarColor || '#6366f1',
            initials:    member.initials    || member.avatarInitials || '',
            memberId:    member.id,
          }
          authState.value = 'authenticated'
          settle()

        } catch (err) {
          console.error('Auth Firestore error:', err)
          authState.value = 'error'
          settle()
        }
      })
    })
  }

  async function signIn() {
    return signInWithGoogle()
  }

  async function logout() {
    try { await signOutUser() } catch (_) {}
  }

  async function firstRunSetup(name) {
    const fbUser = pendingFbUser.value
    if (!fbUser) throw new Error('No pending Firebase user')

    // Seed default roles on first run
    try { await seedDefaultRoles() } catch (_) {}

    const trimmed  = name.trim()
    const initials = trimmed.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)

    const memberData = {
      name:        trimmed,
      email:       fbUser.email,
      initials,
      avatarColor: '#6366f1',
      department:  'Manager',
      role:        'Manager',
      roleId:      'manager',
      active:      true,
      status:      'active',
      uid:         fbUser.uid,
      createdAt:   new Date().toISOString(),
    }

    const newMember = await createTeamMemberWithUID(fbUser.uid, memberData)

    currentUser.value = {
      uid:         fbUser.uid,
      name:        newMember.name,
      email:       fbUser.email,
      role:        'Manager',
      roleId:      'manager',
      permissions: {
        canViewAllProjects: true, canEditPhases: true, canManageTeam: true,
        canAccessSettings: true, canEditAllNotes: true, isReadOnly: false,
      },
      department:  'Manager',
      avatarColor: '#6366f1',
      initials:    newMember.initials,
      memberId:    newMember.id,
    }
    pendingFbUser.value = null
    authState.value     = 'authenticated'
  }

  return {
    currentUser, authState, isManager,
    deniedEmail, setupDefaults,
    initAuth, signIn, logout, firstRunSetup,
  }
})
