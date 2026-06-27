import { initializeApp }                                      from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup,
         signOut, onAuthStateChanged,
         setPersistence, browserLocalPersistence }            from 'firebase/auth'
import { getFirestore,
         collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc,
         getDoc, setDoc, onSnapshot, orderBy, serverTimestamp }  from 'firebase/firestore'
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

export async function isManager() {
  const user = auth.currentUser
  if (!user) return false
  const token = await user.getIdTokenResult()
  return token.claims.role === 'Manager'
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
  await setDoc(doc(db, 'team_members', uid), {
    ...existingData,
    uid,
    migratedAt: new Date().toISOString(),
  })
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
    timestamp:   new Date().toISOString(),
  })
}

// ── Notifications (Firestore) ────────────────────────────────────────────────

export function subscribeToNotifications(userId, onNext, onError) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
  )
  return onSnapshot(q, onNext, onError || (err => console.error('Notifications snapshot error:', err)))
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

export async function markAllNotificationsRead(ids) {
  for (const id of ids) {
    await safeUpdate(doc(db, 'notifications', id), { read: true, readAt: new Date().toISOString() })
  }
}

// ── Weekly Tracker (Firestore) ────────────────────────────────────────────────

export function subscribeToWeeklyTracker(weekKey, onNext, onError) {
  return onSnapshot(doc(db, 'weekly_tracker', weekKey), onNext, onError || (err => console.error('Weekly tracker snapshot error:', err)))
}

export async function saveWeeklyTrackerDoc(weekKey, data) {
  return setDoc(doc(db, 'weekly_tracker', weekKey), data)
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
