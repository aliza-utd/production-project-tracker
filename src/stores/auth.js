import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  initAuthPersistence, onAuthChange,
  signInWithGoogle, signOutUser,
  getTeamMembersFromFirestore, createTeamMember, createTeamMemberWithUID,
  migrateTeamMemberToUID, updateMemberUID,
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

  const isManager = computed(() => currentUser.value?.role === 'Manager')

  // Returns a Promise that resolves once the first auth state is determined.
  // Subsequent onAuthChange calls (sign-in / sign-out) keep updating state reactively.
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

          // No team members at all → first-run setup
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

          // Email not in team_members → access denied
          if (!member) {
            deniedEmail.value = fbUser.email
            authState.value   = 'denied'
            settle()
            return
          }

          // Migrate doc to use Auth UID as document ID (required for Firestore rules).
          // This fixes docs that were created with addDoc (random ID) instead of setDoc.
          if (member.id !== fbUser.uid) {
            try {
              const migrated = await migrateTeamMemberToUID(member.id, fbUser.uid, member)
              // Patch member in place so the rest of the login flow uses the new ID
              Object.assign(member, migrated)
            } catch (migErr) {
              console.error('[Auth] Migration failed, falling back to uid field update:', migErr)
              try { await updateMemberUID(member.id, fbUser.uid) } catch (_) {}
            }
          }

          currentUser.value = {
            uid:        fbUser.uid,
            name:       member.name        || fbUser.displayName || '',
            email:      fbUser.email,
            role:       member.role        || '',
            department: member.department  || '',
            avatarColor:member.avatarColor || '#6366f1',
            initials:   member.initials    || member.avatarInitials || '',
            memberId:   member.id,
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
    // onAuthChange fires → sets authState = 'login' and currentUser = null
  }

  // Called from the first-run setup screen when team_members is empty.
  // Creates the first Manager account and transitions to 'authenticated'.
  async function firstRunSetup(name) {
    const fbUser = pendingFbUser.value
    if (!fbUser) throw new Error('No pending Firebase user')

    const trimmed  = name.trim()
    const initials = trimmed.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)

    const memberData = {
      name:        trimmed,
      email:       fbUser.email,
      initials,
      avatarColor: '#6366f1',
      department:  'Manager',
      role:        'Manager',
      active:      true,
      uid:         fbUser.uid,
      createdAt:   new Date().toISOString(),
    }

    const newMember = await createTeamMemberWithUID(fbUser.uid, memberData)

    currentUser.value = {
      uid:        fbUser.uid,
      name:       newMember.name,
      email:      fbUser.email,
      role:       'Manager',
      department: 'Manager',
      avatarColor:'#6366f1',
      initials:   newMember.initials,
      memberId:   newMember.id,
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
