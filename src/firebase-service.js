import { initializeApp }                                      from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup,
         signOut, onAuthStateChanged,
         setPersistence, browserLocalPersistence,
         createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore,
         collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc,
         getDoc, setDoc, onSnapshot, orderBy, serverTimestamp, writeBatch }  from 'firebase/firestore'
import { firebaseConfig }                                    from './firebase-config.js'

const app      = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)

const googleProvider = new GoogleAuthProvider()

// ── Firestore write helpers (diagnostic wrappers) ─────────────────────────────

export function sanitizeForFirestore(obj) {
  if (obj === null || obj === undefined) return null
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore)
  const clean = {}
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    if (val === undefined)       continue  // Firestore rejects undefined
    if (typeof val === 'function') continue
    clean[key] = sanitizeForFirestore(val)
  }
  return clean
}

export async function safeUpdate(docRef, data) {
  const user = auth.currentUser
  console.log('=== FIRESTORE WRITE ATTEMPT ===')
  console.log('Document path:', docRef.path)
  console.log('User UID:', user?.uid  || null)
  console.log('User email:', user?.email || null)
  console.log('Data keys:', Object.keys(data))
  if (data.phaseData) {
    for (const [phId, ph] of Object.entries(data.phaseData)) {
      const subs = ph?.subPhases ? Object.keys(ph.subPhases) : []
      if (subs.length) console.log(`  phaseData.${phId}.subPhases:`, subs)
    }
  }
  try {
    await updateDoc(docRef, data)
    console.log('=== WRITE SUCCESS ===', docRef.path)
  } catch (error) {
    console.error('=== WRITE FAILED ===')
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('Document path:', docRef.path)
    console.error('User UID:', user?.uid || null)
    throw error
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function initAuthPersistence() {
  await setPersistence(auth, browserLocalPersistence)
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function signOutUser() {
  return signOut(auth)
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser() {
  return auth.currentUser
}

// ── Team Members (Firestore) ──────────────────────────────────────────────────

export async function getTeamMembersFromFirestore() {
  const snap = await getDocs(collection(db, 'team_members'))
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id:       d.id,
      ...data,
      initials: data.avatarInitials || data.initials || '',
    }
  })
}

export async function createTeamMember(data) {
  const firestoreData = {
    ...data,
    avatarInitials: data.initials || data.avatarInitials || '',
  }
  const ref = await addDoc(collection(db, 'team_members'), firestoreData)
  return { id: ref.id, ...firestoreData, initials: firestoreData.avatarInitials }
}

// Creates a team member doc using the Firebase Auth UID as the document ID.
// This is required for Firestore rules that look up team_members/{auth.uid}.
export async function createTeamMemberWithUID(uid, data) {
  const firestoreData = {
    ...data,
    uid,
    avatarInitials: data.initials || data.avatarInitials || '',
  }
  await setDoc(doc(db, 'team_members', uid), firestoreData)
  return { id: uid, ...firestoreData, initials: firestoreData.avatarInitials }
}

// Migrates an existing team_members doc to use the Auth UID as its document ID.
// Called on login when member.id !== fbUser.uid (doc was created with addDoc).
export async function migrateTeamMemberToUID(existingDocId, uid, existingData) {
  console.log('[Auth] Migrating team_members doc:', existingDocId, '→', uid)
  const targetRef  = doc(db, 'team_members', uid)
  const targetSnap = await getDoc(targetRef)
  if (targetSnap.exists()) {
    // activateInvitedMember already wrote the canonical doc — just clean up the old one
    await deleteDoc(doc(db, 'team_members', existingDocId))
    console.log('[Auth] Target already exists; removed old invite doc')
    return { id: uid, ...targetSnap.data() }
  }
  await setDoc(targetRef, { ...existingData, uid, migratedAt: new Date().toISOString() })
  await deleteDoc(doc(db, 'team_members', existingDocId))
  console.log('[Auth] Migration complete')
  return { id: uid, ...existingData, uid }
}

export async function updateTeamMember(id, data) {
  return safeUpdate(doc(db, 'team_members', id), data)
}

export async function updateMemberUID(id, uid) {
  return safeUpdate(doc(db, 'team_members', id), { uid })
}

export async function findMemberByEmail(email) {
  const q    = query(collection(db, 'team_members'), where('email', '==', email))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data(), initials: d.data().avatarInitials || d.data().initials || '' }
}

export async function migrateTeamMembersToFirestore(members) {
  const results = []
  for (const m of members) {
    const data = {
      name:          m.name          || '',
      email:         m.email         || '',
      role:          m.role          || '',
      department:    m.department    || '',
      avatarColor:   m.avatarColor   || '#6366f1',
      avatarInitials:m.initials      || m.avatarInitials || '',
      active:        m.active !== false,
      createdAt:     m.createdAt     || new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
      createdBy:     'migration',
    }
    const ref = await addDoc(collection(db, 'team_members'), data)
    results.push({ id: ref.id, ...data, initials: data.avatarInitials })
  }
  return results
}

// ── Phase Config (Firestore) ──────────────────────────────────────────────────

export async function getPhaseConfigFromFirestore() {
  const snap = await getDoc(doc(db, 'phase_config', 'default'))
  if (!snap.exists()) return null
  return snap.data()
}

export async function savePhaseConfigToFirestore(phases, updatedBy) {
  return setDoc(doc(db, 'phase_config', 'default'), {
    phases,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || '',
  })
}

export function subscribeToPhaseConfig(onNext, onError) {
  return onSnapshot(
    doc(db, 'phase_config', 'default'),
    onNext,
    onError || (err => console.error('Phase config snapshot error:', err))
  )
}

// ── Projects (Firestore) ──────────────────────────────────────────────────────

export function subscribeToProjects(onNext, onError) {
  const q = query(collection(db, 'projects'), where('archived', '==', false))
  return onSnapshot(q, onNext, onError || (err => console.error('Projects snapshot error:', err)))
}

export function subscribeToProject(id, onNext, onError) {
  return onSnapshot(
    doc(db, 'projects', id),
    onNext,
    onError || (err => console.error('Project snapshot error:', err))
  )
}

export async function createProjectInFirestore(data) {
  const ref = await addDoc(collection(db, 'projects'), data)
  return { id: ref.id, ...data }
}

export async function updateProjectInFirestore(id, data) {
  const cleanData = { ...data }
  if (cleanData.phaseData) cleanData.phaseData = sanitizeForFirestore(cleanData.phaseData)
  return safeUpdate(doc(db, 'projects', id), cleanData)
}

export async function getArchivedProjects() {
  const q    = query(collection(db, 'projects'), where('archived', '==', true))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function archiveProjectInFirestore(id, archivedBy, archivedAt) {
  return safeUpdate(doc(db, 'projects', id), {
    archived:   true,
    archivedAt: archivedAt || new Date().toISOString(),
    archivedBy: archivedBy || '',
    updatedAt:  new Date().toISOString(),
  })
}

export async function deleteProjectPermanently(id) {
  return deleteDoc(doc(db, 'projects', id))
}

// ── Project Comments subcollection ────────────────────────────────────────────

export async function getProjectComments(projectId) {
  const q    = query(collection(db, 'projects', projectId, 'comments'), orderBy('createdAt', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function addProjectComment(projectId, commentData) {
  const ref = await addDoc(collection(db, 'projects', projectId, 'comments'), commentData)
  return { id: ref.id, ...commentData }
}

export async function updateProjectComment(projectId, commentId, data) {
  return safeUpdate(doc(db, 'projects', projectId, 'comments', commentId), data)
}

export async function deleteProjectComment(projectId, commentId) {
  return deleteDoc(doc(db, 'projects', projectId, 'comments', commentId))
}

// ── Project Activity Log subcollection ───────────────────────────────────────

export async function getProjectActivityLog(projectId) {
  const q    = query(collection(db, 'projects', projectId, 'activity_log'), orderBy('timestamp', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export function subscribeToActivityLog(projectId, onNext, onError) {
  const q = query(collection(db, 'projects', projectId, 'activity_log'), orderBy('timestamp', 'desc'))
  return onSnapshot(q, onNext, onError || (err => console.error('Activity log snapshot error:', err)))
}

export async function addProjectActivityEntry(projectId, entry) {
  return addDoc(collection(db, 'projects', projectId, 'activity_log'), entry)
}

export async function logActivity(projectId, action, detail, user) {
  return addDoc(collection(db, 'projects', projectId, 'activity_log'), {
    action,
    detail,
    userName:    user?.name || 'System',
    userUid:     user?.uid  || '',
    performedBy: { uid: user?.uid || '', name: user?.name || '' },
    timestamp:   serverTimestamp(),
  })
}

// ── Notifications (Firestore) ────────────────────────────────────────────────

export function subscribeToNotifications(userId, onNext, onError) {
  console.log('[Notifications] subscribeToNotifications — registering onSnapshot for userId:', userId)
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
  )
  return onSnapshot(q, onNext, onError || (err => console.error('[Notifications] snapshot error:', err.code, err.message)))
}

async function pruneOldNotifications(userId) {
  if (!userId) return
  const q    = query(collection(db, 'notifications'), where('userId', '==', userId))
  const snap = await getDocs(q)
  if (snap.size <= 10) return
  const sorted = snap.docs.slice().sort((a, b) => {
    const ta = a.data().createdAt?.toDate?.() ?? new Date(a.data().createdAt || 0)
    const tb = b.data().createdAt?.toDate?.() ?? new Date(b.data().createdAt || 0)
    return ta - tb
  })
  const batch = writeBatch(db)
  sorted.slice(0, sorted.length - 10).forEach(d => batch.delete(d.ref))
  await batch.commit()
}

export async function createNotification(data) {
  const user = auth.currentUser
  const payload = { ...data, createdAt: serverTimestamp() }
  console.log('=== FIRESTORE WRITE ATTEMPT ===')
  console.log('Document path: notifications/<new>')
  console.log('User UID:', user?.uid || null)
  console.log('Data keys:', Object.keys(payload))
  console.log('Notification data:', JSON.stringify({ ...payload, createdAt: '<serverTimestamp>' }))
  try {
    const ref = await addDoc(collection(db, 'notifications'), payload)
    console.log('=== WRITE SUCCESS === notifications/' + ref.id)
    pruneOldNotifications(data.userId).catch(err => console.error('Prune notifications error:', err))
    return ref
  } catch (error) {
    console.error('=== WRITE FAILED === notifications')
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    console.error('User UID:', user?.uid || null)
    throw error
  }
}

export async function setNotificationIfNotExists(docId, data) {
  const ref  = doc(db, 'notifications', docId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, data)
    return true
  }
  return false
}

export async function markNotificationRead(id) {
  return safeUpdate(doc(db, 'notifications', id), { read: true, readAt: new Date().toISOString() })
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return
  const q    = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read',   '==', false),
  )
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(db)
  const now   = new Date().toISOString()
  snap.docs.forEach(d => batch.update(d.ref, { read: true, readAt: now }))
  await batch.commit()
}

// ── Weekly Tracker (Firestore) ────────────────────────────────────────────────

export function subscribeToWeeklyTracker(weekKey, onNext, onError) {
  return onSnapshot(doc(db, 'weekly_tracker', weekKey), onNext, onError || (err => console.error('Weekly tracker snapshot error:', err)))
}

export async function saveWeeklyTrackerDoc(weekKey, data) {
  return setDoc(doc(db, 'weekly_tracker', weekKey), sanitizeForFirestore(data))
}

export async function migrateWeeklyTrackerToFirestore(weeklyEntries) {
  for (const [wk, entry] of Object.entries(weeklyEntries)) {
    await setDoc(doc(db, 'weekly_tracker', wk), entry)
  }
}

// ── Weekly Dev Notes (Firestore) ──────────────────────────────────────────────

export function subscribeToWeeklyDevNotes(weekKey, onNext, onError) {
  const q = query(collection(db, 'weekly_dev_notes'), where('weekKey', '==', weekKey))
  return onSnapshot(q, onNext, onError || (err => console.error('Dev notes snapshot error:', err)))
}

export async function saveWeeklyDevNote(weekKey, memberId, data) {
  return setDoc(doc(db, 'weekly_dev_notes', `${weekKey}_${memberId}`), data)
}

export async function getPrevWeekDevNote(weekKey, memberId) {
  const snap = await getDoc(doc(db, 'weekly_dev_notes', `${weekKey}_${memberId}`))
  return snap.exists() ? snap.data() : null
}

export async function migrateWeeklyDevNotesToFirestore(weeklyDevNotes, memberMap) {
  for (const [weekKey, memberNotes] of Object.entries(weeklyDevNotes)) {
    for (const [memberId, notes] of Object.entries(memberNotes)) {
      await setDoc(doc(db, 'weekly_dev_notes', `${weekKey}_${memberId}`), {
        memberId,
        memberName:  memberMap[memberId] || '',
        weekKey,
        startOfWeek: notes.startOfWeek || '',
        endOfWeek:   notes.endOfWeek   || '',
        migratedAt:  new Date().toISOString(),
      })
    }
  }
}

// ── Project Migration ─────────────────────────────────────────────────────────

export async function migrateProjectsToFirestore(projects) {
  for (const p of projects) {
    const docId = p.id
    const data  = {
      name:            p.name            || '',
      url:             p.url             || '',
      platform:        p.platform        || '',
      developer:       p.developer       || '',
      kickstartDate:   p.kickstartDate   || '',
      liveDate:        p.liveDate        || '',
      siteStatus:      p.siteStatus      || 'development',
      assignedMembers: p.assignedMembers || [],
      currentPhase:    p.currentPhase    || 'kickstart',
      currentSubPhase: p.currentSubPhase || null,
      activePhases:    p.activePhases    || [],
      phaseData:       p.phaseData       || {},
      originalSite:    p.originalSite    || '',
      language:        p.language        || '',
      projectType:     p.projectType     || 'website',
      sitemapUrl:      p.sitemapUrl      || '',
      builderLink:     p.builderLink     || '',
      briefingUrl:     p.briefingUrl     || '',
      googleKeepUrl:   p.googleKeepUrl   || '',
      logoSetUrl:      p.logoSetUrl      || '',
      googleSheets:    p.googleSheets    || [],
      notes:           p.notes           || '',
      phaseHistory:    p.phaseHistory    || [],
      archived:        false,
      archivedAt:      null,
      archivedBy:      null,
      createdAt:       p.createdAt       || new Date().toISOString(),
      updatedAt:       p.updatedAt       || new Date().toISOString(),
      createdBy:       p.createdBy       || 'migration',
    }
    await setDoc(doc(db, 'projects', docId), data)
    for (const h of (p.phaseHistory || [])) {
      await addDoc(collection(db, 'projects', docId, 'activity_log'), {
        action:    'phase_changed',
        detail:    `Phase changed to "${h.phase}"${h.subPhase ? ' / ' + h.subPhase : ''}`,
        userName:  'migration',
        userUid:   '',
        timestamp: h.changedAt || new Date().toISOString(),
      })
    }
  }
}

// ── Roles (Firestore) ─────────────────────────────────────────────────────────

// Canonical permission field names (all roles carry all fields for consistency):
// canViewAllProjects, canEditPhases, canManageTeam, canAccessSettings,
// canEditAllNotes, isReadOnly, isAdmin
//
// canEditAllNotes: true  = can edit weekly notes for any member
//                  false = can only edit their own row (or read-only)
const DEFAULT_ROLES = [
  {
    id: 'admin', name: 'Admin', order: 1,
    permissions: {
      canViewAllProjects: true, canEditPhases: true, canManageTeam: true,
      canAccessSettings: true, canEditAllNotes: true, isReadOnly: false, isAdmin: true,
    },
  },
  {
    id: 'manager', name: 'Manager', order: 2,
    permissions: {
      canViewAllProjects: true, canEditPhases: true, canManageTeam: true,
      canAccessSettings: true, canEditAllNotes: true, isReadOnly: false, isAdmin: false,
    },
  },
  {
    id: 'developer', name: 'Developer', order: 3,
    permissions: {
      canViewAllProjects: false, canEditPhases: true, canManageTeam: false,
      canAccessSettings: false, canEditAllNotes: false, isReadOnly: false, isAdmin: false,
    },
  },
  {
    id: 'multimedia', name: 'Multimedia', order: 4,
    permissions: {
      canViewAllProjects: true, canEditPhases: true, canManageTeam: false,
      canAccessSettings: false, canEditAllNotes: false, isReadOnly: false, isAdmin: false,
    },
  },
  {
    id: 'qa', name: 'QA', order: 5,
    permissions: {
      canViewAllProjects: true, canEditPhases: true, canManageTeam: false,
      canAccessSettings: false, canEditAllNotes: false, isReadOnly: false, isAdmin: false,
    },
  },
  {
    id: 'external', name: 'External', order: 6,
    permissions: {
      canViewAllProjects: false, canEditPhases: false, canManageTeam: false,
      canAccessSettings: false, canEditAllNotes: false, isReadOnly: true, isAdmin: false,
    },
  },
]

export async function getRolesFromFirestore() {
  const snap = await getDocs(collection(db, 'roles'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getRoleById(id) {
  const snap = await getDoc(doc(db, 'roles', id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// Seeds / migrates the 6 canonical role docs.
// Each doc is created if missing, or updated if it lacks the current field set.
// Wrapped per-doc so a single permission error doesn't block the rest.
// Also assigns Aliza Solomon to the Admin role (idempotent).
export async function seedDefaultRoles() {
  for (const role of DEFAULT_ROLES) {
    const { id, ...data } = role
    try {
      const ref  = doc(db, 'roles', id)
      const snap = await getDoc(ref)
      if (!snap.exists()) {
        await setDoc(ref, data)
        console.log('[Roles] Created default role:', id)
      } else {
        const existing = snap.data()
        const perms    = existing.permissions || {}
        // Migrate if: old field names, isAdmin missing, canEditOwnRowOnly present, or order missing
        const needsMigration =
          !('canViewAllProjects' in perms) ||
          !('isAdmin' in perms) ||
          !('canEditAllNotes' in perms) ||
          ('canEditOwnRowOnly' in perms) ||
          !('order' in existing) ||
          existing.order !== role.order
        if (needsMigration) {
          await setDoc(ref, data)
          console.log('[Roles] Migrated role schema:', id)
        }
      }
    } catch (err) {
      console.warn('[Roles] Could not seed role', id, '—', err.code || err.message)
    }
    // Small gap between writes so rule propagation delay doesn't hit the
    // last role in the batch with a stale permission check.
    await new Promise(r => setTimeout(r, 100))
  }

  // Assign Aliza Solomon to Admin role (idempotent — skips if already admin)
  try {
    const q    = query(collection(db, 'team_members'), where('email', '==', 'aliza.solomon@uptodatewebdesign.com'))
    const snap = await getDocs(q)
    for (const memberDoc of snap.docs) {
      if (memberDoc.data().roleId !== 'admin') {
        await updateDoc(memberDoc.ref, { roleId: 'admin', role: 'Admin' })
        console.log('[Roles] Assigned Admin role to Aliza Solomon')
      }
    }
  } catch (err) {
    console.warn('[Roles] Could not assign Admin to Aliza:', err.code || err.message)
  }
}

export function subscribeToRoles(onNext, onError) {
  return onSnapshot(
    collection(db, 'roles'),
    onNext,
    onError || (err => console.error('[Roles] Snapshot error:', err))
  )
}

export async function createRoleInFirestore(data) {
  const ref = await addDoc(collection(db, 'roles'), data)
  return { id: ref.id, ...data }
}

export async function updateRoleInFirestore(id, data) {
  return updateDoc(doc(db, 'roles', id), data)
}

export async function deleteRoleInFirestore(id) {
  return deleteDoc(doc(db, 'roles', id))
}

// ── Invite flow ───────────────────────────────────────────────────────────────

function generateInviteCode() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

export async function createInvitedMember(data) {
  const inviteCode   = generateInviteCode()
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const memberData = {
    ...data,
    status:         'invited',
    active:         false,
    inviteCode,
    inviteExpiry,
    createdAt:      new Date().toISOString(),
    avatarInitials: data.initials || data.avatarInitials || '',
  }
  const ref = await addDoc(collection(db, 'team_members'), memberData)
  await setDoc(doc(db, 'invite_codes', inviteCode), {
    memberDocId: ref.id,
    createdAt:   new Date().toISOString(),
  })
  return { id: ref.id, ...memberData }
}

export async function getInviteByCode(code) {
  const lookup = await getDoc(doc(db, 'invite_codes', code))
  if (!lookup.exists()) return null
  const memberDoc = await getDoc(doc(db, 'team_members', lookup.data().memberDocId))
  if (!memberDoc.exists()) return null
  return { id: memberDoc.id, ...memberDoc.data() }
}

export async function activateInvitedMember(inviteDocId, uid, memberData) {
  const activeFields = {
    status:      'active',
    active:      true,
    uid,
    inviteCode:  null,
    inviteExpiry: null,
    acceptedAt:  serverTimestamp(),
  }

  const payload = {
    name:           memberData.name           || '',
    email:          memberData.email          || '',
    role:           memberData.role           || '',
    roleId:         memberData.roleId         || null,
    department:     memberData.department     || '',
    avatarColor:    memberData.avatarColor    || '#6366f1',
    avatarInitials: memberData.avatarInitials || memberData.initials || '',
    initials:       memberData.initials       || memberData.avatarInitials || '',
    createdAt:      memberData.createdAt      || new Date().toISOString(),
    ...activeFields,
  }

  // Step 1: Write the canonical UID-based document. This must happen first so
  // that migrateTeamMemberToUID (fired by onAuthStateChanged immediately after
  // account creation) finds this doc and only cleans up the old invite doc.
  const uidRef = doc(db, 'team_members', uid)
  try {
    await setDoc(uidRef, payload)
  } catch (err) {
    console.error('[Invite] setDoc failed for team_members/' + uid, err.code, err.message)
    throw err
  }

  if (inviteDocId === uid) return

  // Step 2: Also update the original invite doc with the active fields.
  // This ensures it never shows as "Invited" in the Members tab even if the
  // delete below fails (e.g. due to a transient network error).
  try {
    await updateDoc(doc(db, 'team_members', inviteDocId), activeFields)
  } catch (err) {
    // Doc may already have been deleted by migrateTeamMemberToUID — not an error.
    if (err.code !== 'not-found') {
      console.warn('[Invite] Could not update original invite doc:', inviteDocId, err.message)
    }
  }

  // Step 3: Delete the original invite doc (background — failure is non-fatal
  // because Step 2 already marked it as active).
  deleteDoc(doc(db, 'team_members', inviteDocId))
    .catch(err => console.warn('[Invite] Could not delete old invite doc:', inviteDocId, err.message))
}

export async function resendInvite(memberId, memberEmail) {
  const inviteCode   = generateInviteCode()
  const inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  console.log('[Invite] Resending invite for:', memberId, memberEmail)

  let targetRef = doc(db, 'team_members', memberId)
  let snap      = await getDoc(targetRef)

  if (!snap.exists()) {
    // The doc ID in the local store may be stale (e.g. migrated to UID-based ID).
    // Fall back to querying by email to find the current document.
    console.warn('[Invite] Doc not found at', memberId, '— falling back to email query')
    if (!memberEmail) throw new Error('Member record not found. Try refreshing the page.')
    const q         = query(collection(db, 'team_members'), where('email', '==', memberEmail))
    const emailSnap = await getDocs(q)
    if (emailSnap.empty) throw new Error('Member record not found. Try refreshing the page.')
    targetRef = emailSnap.docs[0].ref
    snap      = emailSnap.docs[0]
    console.log('[Invite] Found member by email at doc:', targetRef.id)
  }

  const oldCode = snap.data().inviteCode
  await updateDoc(targetRef, { inviteCode, inviteExpiry, status: 'invited' })
  if (oldCode) {
    deleteDoc(doc(db, 'invite_codes', oldCode))
      .catch(err => console.warn('[Invite] Could not delete old invite_codes doc:', oldCode, err.message))
  }
  await setDoc(doc(db, 'invite_codes', inviteCode), {
    memberDocId: targetRef.id,
    createdAt:   new Date().toISOString(),
  })
  console.log('[Invite] Invite resent for:', targetRef.id)
  return { inviteCode, inviteExpiry }
}

// ── Email / Password Auth ─────────────────────────────────────────────────────

export async function createFirebaseEmailUser(email, password) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function signInWithEmailPassword(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

// ── Checklist Templates (Firestore) ──────────────────────────────────────────

export function subscribeToChecklistTemplates(onNext, onError) {
  return onSnapshot(
    collection(db, 'checklist_templates'),
    onNext,
    onError || (err => console.error('[ChecklistTemplates] snapshot error:', err))
  )
}

export async function saveChecklistTemplate(phaseId, items) {
  return setDoc(doc(db, 'checklist_templates', phaseId), {
    phaseId,
    items,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteChecklistTemplate(phaseId) {
  return deleteDoc(doc(db, 'checklist_templates', phaseId))
}

// ── Link Templates (Firestore) ────────────────────────────────────────────────

const DEFAULT_LINK_TEMPLATES = [
  { id: 'qa_checklist', name: 'QA Checklist', order: 1 },
  { id: 'briefing',     name: 'Briefing',     order: 2 },
  { id: 'sitemap',      name: 'Sitemap',       order: 3 },
  { id: 'builder_link', name: 'Builder Link',  order: 4 },
  { id: 'google_drive', name: 'Google Drive',  order: 5 },
  { id: 'google_keep',  name: 'Google Keep',   order: 6 },
]

export function subscribeLinkTemplates(onNext, onError) {
  return onSnapshot(
    query(collection(db, 'link_templates'), orderBy('order')),
    onNext,
    onError || (err => console.error('[LinkTemplates] snapshot error:', err))
  )
}

export async function seedLinkTemplates() {
  const batch = writeBatch(db)
  for (const t of DEFAULT_LINK_TEMPLATES) {
    batch.set(doc(db, 'link_templates', t.id), t)
  }
  await batch.commit()
}

export async function addLinkTemplate(data) {
  return addDoc(collection(db, 'link_templates'), data)
}

export async function updateLinkTemplate(id, data) {
  return updateDoc(doc(db, 'link_templates', id), data)
}

export async function deleteLinkTemplate(id) {
  return deleteDoc(doc(db, 'link_templates', id))
}

// ── Weekly Notes Fields (Firestore) ──────────────────────────────────────────

export function subscribeToWeeklyNotesFields(onNext, onError) {
  return onSnapshot(
    collection(db, 'weekly_notes_fields'),
    onNext,
    onError || (err => console.error('[WeeklyNotesFields] snapshot error:', err))
  )
}

export async function setWeeklyNotesField(id, data) {
  return setDoc(doc(db, 'weekly_notes_fields', id), data)
}

export async function createWeeklyNotesField(data) {
  const ref = await addDoc(collection(db, 'weekly_notes_fields'), data)
  return { id: ref.id, ...data }
}

export async function deleteWeeklyNotesField(id) {
  return deleteDoc(doc(db, 'weekly_notes_fields', id))
}

// ── Weekly Notes Edit Requests (Firestore) ───────────────────────────────────

export function subscribeToUserEditRequests(userId, onNext, onError) {
  const q = query(
    collection(db, 'weekly_notes_edit_requests'),
    where('userId', '==', userId)
  )
  return onSnapshot(q, onNext, onError || (err => console.error('[EditRequests] user snapshot error:', err)))
}

export function subscribeToPendingEditRequests(onNext, onError) {
  const q = query(
    collection(db, 'weekly_notes_edit_requests'),
    where('status', '==', 'pending')
  )
  return onSnapshot(q, onNext, onError || (err => console.error('[EditRequests] pending snapshot error:', err)))
}

export async function submitWeeklyNotesEditRequest(docId, data) {
  return setDoc(doc(db, 'weekly_notes_edit_requests', docId), {
    ...data,
    requestedAt: serverTimestamp(),
  })
}

export async function respondToWeeklyNotesEditRequest(docId, status, respondedBy) {
  return updateDoc(doc(db, 'weekly_notes_edit_requests', docId), {
    status,
    respondedBy,
    respondedAt: serverTimestamp(),
  })
}

export async function seedDefaultWeeklyNotesFields() {
  const defaults = [
    { id: 'ongoingTasks',    name: 'Ongoing Tasks',      order: 1, isDefault: true },
    { id: 'blockers',        name: 'Blockers / Issues',  order: 2, isDefault: true },
    { id: 'endOfWeekUpdate', name: 'End of Week Update', order: 3, isDefault: true },
  ]
  for (const { id, ...data } of defaults) {
    const snap = await getDoc(doc(db, 'weekly_notes_fields', id))
    if (!snap.exists()) {
      await setDoc(doc(db, 'weekly_notes_fields', id), data)
      console.log('[WeeklyNotesFields] seeded:', id)
    }
  }
}

// ── Phase / Checklist Statuses (Firestore) ───────────────────────────────────

const DEFAULT_STATUS_DOCS = [
  {
    id: 'not-started', name: 'Not Started', baseColor: '#94a3b8',
    lightBg: '#F1EFE8', lightText: '#64748b',
    darkBg:  '#2C2C2A', darkText:  '#B4B2A9',
    order: 1, isComplete: false, isDefault: true,
  },
  {
    id: 'active', name: 'Active', baseColor: '#f59e0b',
    lightBg: '#FAEEDA', lightText: '#9a3412',
    darkBg:  '#412402', darkText:  '#FAC775',
    order: 2, isComplete: false, isDefault: true,
  },
  {
    id: 'blocked', name: 'Blocked', baseColor: '#ef4444',
    lightBg: '#FCEBEB', lightText: '#b91c1c',
    darkBg:  '#501313', darkText:  '#F09595',
    order: 3, isComplete: false, isDefault: true,
  },
  {
    id: 'done', name: 'Done', baseColor: '#22c55e',
    lightBg: '#EAF3DE', lightText: '#166534',
    darkBg:  '#173404', darkText:  '#97C459',
    order: 4, isComplete: true, isDefault: true,
  },
]

export async function seedDefaultStatuses() {
  for (const { id, ...data } of DEFAULT_STATUS_DOCS) {
    await setDoc(doc(db, 'statuses', id), data)
    console.log('[Statuses] seeded:', id)
  }
}

export function subscribeToStatuses(onNext, onError) {
  const q = query(collection(db, 'statuses'), orderBy('order', 'asc'))
  return onSnapshot(q, onNext, onError || (err => console.error('[Statuses] snapshot error:', err)))
}

export async function createStatusInFirestore(data) {
  return addDoc(collection(db, 'statuses'), data)
}

export async function updateStatusInFirestore(id, data) {
  return updateDoc(doc(db, 'statuses', id), data)
}

export async function deleteStatusInFirestore(id) {
  return deleteDoc(doc(db, 'statuses', id))
}
