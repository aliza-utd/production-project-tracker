import { initializeApp }                                      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup,
         signOut, onAuthStateChanged,
         setPersistence, browserLocalPersistence }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore,
         collection, getDocs, query, where, addDoc, updateDoc, doc,
         getDoc, setDoc, onSnapshot, orderBy }               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig }                                    from "./firebase-config.js";

const app      = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function initAuthPersistence() {
  await setPersistence(auth, browserLocalPersistence);
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function isManager() {
  const user = auth.currentUser;
  if (!user) return false;
  const token = await user.getIdTokenResult();
  return token.claims.role === 'Manager';
}

// ── Team Members (Firestore) ──────────────────────────────────────────────────

// Returns all team_members documents.
// Maps avatarInitials → initials so the rest of the app uses a single field name.
export async function getTeamMembersFromFirestore() {
  const snap = await getDocs(collection(db, 'team_members'));
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id:       d.id,
      ...data,
      initials: data.avatarInitials || data.initials || '',
    };
  });
}

// Creates a team_member document (first-run setup or manual add).
export async function createTeamMember(data) {
  const firestoreData = {
    ...data,
    avatarInitials: data.initials || data.avatarInitials || '',
  };
  const ref = await addDoc(collection(db, 'team_members'), firestoreData);
  return { id: ref.id, ...firestoreData, initials: firestoreData.avatarInitials };
}

// Updates an existing team_member document by Firestore document ID.
export async function updateTeamMember(id, data) {
  return updateDoc(doc(db, 'team_members', id), data);
}

// Links a Firebase Auth UID to a team_member document on first login.
export async function updateMemberUID(id, uid) {
  return updateDoc(doc(db, 'team_members', id), { uid });
}

// Finds a single team member by email address.
export async function findMemberByEmail(email) {
  const q    = query(collection(db, 'team_members'), where('email', '==', email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), initials: d.data().avatarInitials || d.data().initials || '' };
}

// One-time migration: uploads an array of localStorage member objects to Firestore.
export async function migrateTeamMembersToFirestore(members) {
  const results = [];
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
    };
    const ref = await addDoc(collection(db, 'team_members'), data);
    results.push({ id: ref.id, ...data, initials: data.avatarInitials });
  }
  return results;
}

// ── Phase Config (Firestore) ──────────────────────────────────────────────────

// Reads the phase_config/default document. Returns null if it doesn't exist yet.
export async function getPhaseConfigFromFirestore() {
  const snap = await getDoc(doc(db, 'phase_config', 'default'));
  if (!snap.exists()) return null;
  return snap.data();
}

// Writes (or overwrites) the phase_config/default document.
export async function savePhaseConfigToFirestore(phases, updatedBy) {
  return setDoc(doc(db, 'phase_config', 'default'), {
    phases,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || '',
  });
}

// Real-time listener on phase_config/default.
// Returns the unsubscribe function. onNext receives the raw Firestore DocumentSnapshot.
export function subscribeToPhaseConfig(onNext, onError) {
  return onSnapshot(
    doc(db, 'phase_config', 'default'),
    onNext,
    onError || (err => console.error('Phase config snapshot error:', err))
  );
}

// ── Projects (Firestore) ──────────────────────────────────────────────────────

// Real-time listener on all non-archived projects.
// Returns the unsubscribe function. Caller must invoke it on cleanup.
export function subscribeToProjects(onNext, onError) {
  const q = query(collection(db, 'projects'), where('archived', '==', false));
  return onSnapshot(q, onNext, onError || (err => console.error('Projects snapshot error:', err)));
}

// Creates a new project document. Returns { id, ...data }.
export async function createProjectInFirestore(data) {
  const ref = await addDoc(collection(db, 'projects'), data);
  return { id: ref.id, ...data };
}

// Updates an existing project document (partial update).
export async function updateProjectInFirestore(id, data) {
  return updateDoc(doc(db, 'projects', id), data);
}

// Fetches all archived projects (one-time fetch, not real-time).
export async function getArchivedProjects() {
  const q    = query(collection(db, 'projects'), where('archived', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Archives a project by setting archived fields (Firestore rules forbid delete).
export async function archiveProjectInFirestore(id, archivedBy, archivedAt) {
  return updateDoc(doc(db, 'projects', id), {
    archived:   true,
    archivedAt: archivedAt || new Date().toISOString(),
    archivedBy: archivedBy || '',
    updatedAt:  new Date().toISOString(),
  });
}

// ── Project Comments subcollection ────────────────────────────────────────────

// Fetches all comments for a project, sorted by createdAt ascending.
export async function getProjectComments(projectId) {
  const q    = query(collection(db, 'projects', projectId, 'comments'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Adds a comment to a project's comments subcollection.
export async function addProjectComment(projectId, commentData) {
  const ref = await addDoc(collection(db, 'projects', projectId, 'comments'), commentData);
  return { id: ref.id, ...commentData };
}

// ── Project Activity Log subcollection ───────────────────────────────────────

// Fetches the activity log for a project, sorted by timestamp descending (newest first).
export async function getProjectActivityLog(projectId) {
  const q    = query(collection(db, 'projects', projectId, 'activity_log'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Appends a single entry to a project's activity_log subcollection.
export async function addProjectActivityEntry(projectId, entry) {
  return addDoc(collection(db, 'projects', projectId, 'activity_log'), entry);
}

// ── Notifications (Firestore) ────────────────────────────────────────────────

// Real-time listener on all notifications for a user (sorted client-side).
export function subscribeToNotifications(userId, onNext, onError) {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(q, onNext, onError || (err => console.error('Notifications snapshot error:', err)));
}

// Creates a new notification document.
export async function createNotification(data) {
  return addDoc(collection(db, 'notifications'), data);
}

// Creates a notification only if a document with the given ID doesn't already exist.
// Used for deadline warnings to prevent duplicates (one per user/project/day).
export async function setNotificationIfNotExists(docId, data) {
  const ref  = doc(db, 'notifications', docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, data);
    return true;
  }
  return false;
}

// Marks a single notification as read.
export async function markNotificationRead(id) {
  return updateDoc(doc(db, 'notifications', id), { read: true, readAt: new Date().toISOString() });
}

// Marks multiple notifications as read (iterates — no batch import needed).
export async function markAllNotificationsRead(ids) {
  for (const id of ids) {
    await updateDoc(doc(db, 'notifications', id), { read: true, readAt: new Date().toISOString() });
  }
}

// ── Weekly Tracker (Firestore) ────────────────────────────────────────────────

// Real-time listener on a single weekly_tracker document (one week).
export function subscribeToWeeklyTracker(weekKey, onNext, onError) {
  return onSnapshot(doc(db, 'weekly_tracker', weekKey), onNext, onError || (err => console.error('Weekly tracker snapshot error:', err)));
}

// Writes (or overwrites) one week's tracker entry.
export async function saveWeeklyTrackerDoc(weekKey, data) {
  return setDoc(doc(db, 'weekly_tracker', weekKey), data);
}

// One-time migration: uploads all weeklyEntries from localStorage to Firestore.
// weeklyEntries is the { 'YYYY-WNN': { newProjects:[], ... } } object.
export async function migrateWeeklyTrackerToFirestore(weeklyEntries) {
  for (const [wk, entry] of Object.entries(weeklyEntries)) {
    await setDoc(doc(db, 'weekly_tracker', wk), entry);
  }
}

// ── Weekly Dev Notes (Firestore) ──────────────────────────────────────────────

// Real-time listener on all weekly_dev_notes documents for a given week.
// Each doc ID: 'YYYY-WNN_memberId'.
export function subscribeToWeeklyDevNotes(weekKey, onNext, onError) {
  const q = query(collection(db, 'weekly_dev_notes'), where('weekKey', '==', weekKey));
  return onSnapshot(q, onNext, onError || (err => console.error('Dev notes snapshot error:', err)));
}

// Writes (or overwrites) one developer's notes for one week.
// Doc ID: 'weekKey_memberId'.
export async function saveWeeklyDevNote(weekKey, memberId, data) {
  return setDoc(doc(db, 'weekly_dev_notes', `${weekKey}_${memberId}`), data);
}

// Fetches a single developer's notes for a specific week (used for "Copy prev week").
export async function getPrevWeekDevNote(weekKey, memberId) {
  const snap = await getDoc(doc(db, 'weekly_dev_notes', `${weekKey}_${memberId}`));
  return snap.exists() ? snap.data() : null;
}

// One-time migration: uploads all weeklyDevNotes from localStorage to Firestore.
// weeklyDevNotes is { 'YYYY-WNN': { memberId: { startOfWeek, endOfWeek } } }.
// memberMap is { memberId: memberName } for resolving display names.
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
      });
    }
  }
}

// ── Project Migration ─────────────────────────────────────────────────────────

// One-time migration: uploads an array of localStorage project objects to Firestore.
// Preserves existing project IDs so weekly-tracker references stay valid.
// Also seeds the activity_log subcollection from each project's phaseHistory.
export async function migrateProjectsToFirestore(projects) {
  for (const p of projects) {
    const docId = p.id;
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
    };
    // Use setDoc with the existing ID so weekly-tracker project references are preserved.
    await setDoc(doc(db, 'projects', docId), data);
    // Seed activity_log from phaseHistory.
    for (const h of (p.phaseHistory || [])) {
      await addDoc(collection(db, 'projects', docId, 'activity_log'), {
        action:    'phase_changed',
        detail:    `Phase changed to "${h.phase}"${h.subPhase ? ' / ' + h.subPhase : ''}`,
        userName:  'migration',
        userUid:   '',
        timestamp: h.changedAt || new Date().toISOString(),
      });
    }
  }
}
