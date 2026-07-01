<template>
  <div class="content">

    <!-- Week navigation -->
    <div class="wk-nav">
      <button class="btn btn-ghost btn-sm" @click="offset--">← Prev</button>
      <div class="wk-nav-center">
        <span class="wk-label">{{ weekLabel }}</span>
        <button v-if="offset !== 0" class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px"
          @click="offset = 0">Today</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-ghost btn-sm" @click="offset++">Next →</button>
        <NotificationBell />
      </div>
    </div>

    <!-- Progress banner -->
    <div class="dn-banner">
      <span class="dn-banner-txt">
        {{ completion.complete }}/{{ completion.total }} members updated this week
      </span>
      <div class="dn-prog-bar">
        <div class="dn-prog-fill" :style="{ width: progressPct + '%' }"></div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="showLoading" style="display:flex;align-items:center;gap:10px;padding:32px;color:var(--muted)">
      <span>⏳</span> Loading…
    </div>

    <!-- Member cards -->
    <div v-else class="dn-grid">
      <div v-for="m in sortedMembers" :key="m.id"
        class="dn-card"
        :class="{ 'dn-card-readonly': !canEdit(m.id), 'dn-card-highlight': highlightedMemberId === m.id }"
        :data-member-id="m.id">

        <!-- Card header -->
        <div class="dn-card-hdr">
          <div class="avatar avatar-sm" :style="'background:' + (m.avatarColor || '#6366f1')">
            {{ m.initials || '?' }}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
            <div style="font-size:12px;color:var(--muted)">{{ roleLabel(m.roleId) }}</div>
          </div>
          <span class="badge" :style="statusStyle(m.id)">{{ statusLabel(m.id) }}</span>
          <!-- "View only" only for other people's cards, not own past-locked card -->
          <span v-if="!canEdit(m.id) && m.id !== authStore.currentUser?.memberId"
            class="dn-view-only">View only</span>
        </div>

        <!-- Inline approval notice — Admin/Manager viewing a past-week card with a pending request -->
        <div v-if="authStore.currentUser?.permissions?.canEditAllNotes && offset < 0 && pendingRequestFor(m.id)"
          class="dn-past-notice dn-request-notice">
          <span style="font-size:12px;font-weight:500">⏳ Edit request</span>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-sm er-approve-btn" @click="approveCardRequest(pendingRequestFor(m.id))">Approve</button>
            <button class="btn btn-sm er-deny-btn"    @click="denyCardRequest(pendingRequestFor(m.id))">Deny</button>
          </div>
        </div>

        <!-- Past-week lock notice — own card only -->
        <div v-if="isPastLocked(m.id)" class="dn-past-notice">
          <template v-if="myCurrentWeekRequest?.status === 'pending'">
            <span class="dn-notice-chip dn-notice-pending">⏳ Edit request pending review</span>
          </template>
          <template v-else-if="myCurrentWeekRequest?.status === 'denied'">
            <span class="dn-notice-chip dn-notice-denied">✕ Edit access was denied for this week</span>
          </template>
          <template v-else>
            <span style="font-size:12px;color:var(--muted)">Past week — read only</span>
            <button class="btn btn-secondary btn-sm" style="font-size:12px"
              :disabled="requestSubmitting" @click="submitRequest">
              {{ requestSubmitting ? 'Sending…' : 'Request Edit Access' }}
            </button>
          </template>
        </div>

        <!-- Dynamic fields -->
        <div v-for="field in fieldsStore.fields" :key="field.id" class="dn-field">
          <div class="dn-field-label">{{ field.name }}</div>
          <RichTextEditor
            :modelValue="getNote(m.id, field.id)"
            :placeholder="fieldPlaceholder(field.id)"
            :disabled="!canEdit(m.id)"
            @update:modelValue="setNote(m.id, field.id, $event)"
          />
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore }              from '@/stores/auth'
import { useTeamStore }              from '@/stores/team'
import { useRolesStore }             from '@/stores/roles'
import { useWeeklyNotesFieldsStore } from '@/stores/weeklyNotesFields'
import {
  subscribeToWeeklyDevNotes,
  saveWeeklyDevNote,
  subscribeToUserEditRequests,
  submitWeeklyNotesEditRequest,
  subscribeToPendingEditRequests,
  respondToWeeklyNotesEditRequest,
  createNotification,
} from '@/firebase-service'
import RichTextEditor from '@/components/shared/RichTextEditor.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const route  = useRoute()
const router = useRouter()

const authStore   = useAuthStore()
const teamStore   = useTeamStore()
const rolesStore  = useRolesStore()
const fieldsStore = useWeeklyNotesFieldsStore()

const offset             = ref(0)
const notes              = ref({})
const loading            = ref(true)
const highlightedMemberId = ref(null)  // card to briefly highlight after notif navigation
let   highlightTimer            = null
let   unsubPendingHighlight     = null  // stops the one-shot watcher used for highlight=pending
let   unsub         = null
let   unsubRequests = null
let   unsubPending  = null
const debounceTimers = {}
let   notifSaveTimer = null

// ── Edit requests ─────────────────────────────────────────────────────────────

// myRequests[weekKey] → { id, status, userId, userName, week, weekLabel, … }
const myRequests     = ref({})
const requestsLoaded = ref(false)
const requestSubmitting = ref(false)

const myCurrentWeekRequest = computed(() => myRequests.value[weekKey.value] || null)

// All pending requests across all weeks, keyed by memberId — used by admin/manager
// to show inline approve/deny on cards. Filtered to current week in the template.
const pendingRequests = ref([])

// Pending request for a given memberId in the currently viewed week
function pendingRequestFor(memberId) {
  return pendingRequests.value.find(
    r => r.week === weekKey.value && r.userId === memberUid(memberId)
  ) || null
}

function memberUid(memberId) {
  return teamStore.teamMembers.find(m => m.id === memberId)?.uid || null
}

function startRequestsListener() {
  const perms = authStore.currentUser?.permissions

  if (perms?.canEditAllNotes) {
    // Admin/Manager: subscribe to all pending requests so they can act inline on cards
    unsubPending = subscribeToPendingEditRequests((snap) => {
      pendingRequests.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
    requestsLoaded.value = true
    return
  }

  const uid = authStore.currentUser?.uid
  if (!uid) { requestsLoaded.value = true; return }

  unsubRequests = subscribeToUserEditRequests(uid, (snap) => {
    const map = {}
    snap.docs.forEach(d => {
      const data = d.data()
      map[data.week] = { id: d.id, ...data }
    })
    myRequests.value   = map
    requestsLoaded.value = true
  }, () => { requestsLoaded.value = true })
}

async function approveCardRequest(req) {
  await respondToWeeklyNotesEditRequest(req.id, 'approved', authStore.currentUser?.name || '')
  createNotification({
    userId:  req.userId,
    type:    'weekly_notes_request_approved',
    message: `Your edit request for ${req.weekLabel || req.week} was approved`,
    weekKey: req.week,
    read:    false,
  }).catch(() => {})
}

async function denyCardRequest(req) {
  await respondToWeeklyNotesEditRequest(req.id, 'denied', authStore.currentUser?.name || '')
  createNotification({
    userId:  req.userId,
    type:    'weekly_notes_request_denied',
    message: `Your edit request for ${req.weekLabel || req.week} was denied`,
    weekKey: req.week,
    read:    false,
  }).catch(() => {})
}

async function submitRequest() {
  if (requestSubmitting.value) return
  requestSubmitting.value = true
  try {
    const uid     = authStore.currentUser.uid
    const name    = authStore.currentUser.name
    const docId   = `${uid}_${weekKey.value}`

    await submitWeeklyNotesEditRequest(docId, {
      userId:    uid,
      userName:  name,
      week:      weekKey.value,
      weekLabel: weekNotifLabel.value,
      status:    'pending',
    })

    // Notify all admin/manager users
    const targets = adminManagerUids.value.filter(id => id !== uid)
    for (const targetUid of targets) {
      createNotification({
        userId:   targetUid,
        type:     'weekly_notes_edit_request',
        message:  `${name} requested edit access for ${weekNotifLabel.value}`,
        weekKey:  weekKey.value,
        read:     false,
      }).catch(() => {})
    }
  } catch (err) {
    console.error('Submit edit request error:', err)
  } finally {
    requestSubmitting.value = false
  }
}

// ── Members ───────────────────────────────────────────────────────────────────

const sortedMembers = computed(() => {
  const active = teamStore.teamMembers.filter(m => m.active !== false)
  return active.slice().sort((a, b) => {
    const roleA  = rolesStore.getRoleById(a.roleId)
    const roleB  = rolesStore.getRoleById(b.roleId)
    const orderA = roleA?.order ?? 99
    const orderB = roleB?.order ?? 99
    if (orderA !== orderB) return orderA - orderB
    return (a.name || '').localeCompare(b.name || '')
  })
})

// UIDs of all active Admin/Manager members (for notification targeting)
const adminManagerUids = computed(() =>
  teamStore.teamMembers
    .filter(m => {
      if (!m.uid || m.active === false) return false
      const role = rolesStore.getRoleById(m.roleId)
      return role?.permissions?.canEditAllNotes === true
    })
    .map(m => m.uid)
)

// ── Week helpers ──────────────────────────────────────────────────────────────

const weekKey = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset.value * 7)
  const yr   = d.getFullYear()
  const jan1 = new Date(yr, 0, 1)
  const wn   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${yr}-W${String(wn).padStart(2, '0')}`
})

const weekLabel = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset.value * 7)
  const sun  = new Date(d); sun.setDate(sun.getDate() + 6)
  const fmt  = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const yr   = d.getFullYear()
  const jan1 = new Date(yr, 0, 1)
  const wn   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  const rel  = offset.value ===  0 ? 'This Week · '
    : offset.value === -1 ? 'Last Week · '
    : offset.value ===  1 ? 'Next Week · ' : ''
  return `Week ${wn} · ${rel}${fmt(d)} – ${fmt(sun)}, ${yr}`
})

// Compact label used in notifications and edit request documents
const weekNotifLabel = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset.value * 7)
  const sun = new Date(d); sun.setDate(sun.getDate() + 6)
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(d)} – ${fmt(sun)}, ${d.getFullYear()}`
})

// ── Progress ──────────────────────────────────────────────────────────────────

// Wait for fields, notes, and (for non-admins) request state before rendering
const showLoading = computed(() => loading.value || !fieldsStore.loaded || !requestsLoaded.value)

const completion = computed(() => ({
  total:    sortedMembers.value.length,
  complete: sortedMembers.value.filter(m => isUpdated(m.id)).length,
}))

const progressPct = computed(() => {
  const { total, complete } = completion.value
  return total ? Math.round(complete / total * 100) : 0
})

// ── Permissions ───────────────────────────────────────────────────────────────

function canEdit(memberId) {
  const perms = authStore.currentUser?.permissions
  if (perms?.canEditAllNotes) return true               // admin/manager — always editable
  if (memberId !== authStore.currentUser?.memberId) return false  // not own card
  if (offset.value >= 0) return true                   // current or future week
  return myCurrentWeekRequest.value?.status === 'approved'  // past week — only if approved
}

// True when it's the current user's own card, it's a past week, and no approved request
function isPastLocked(memberId) {
  if (authStore.currentUser?.permissions?.canEditAllNotes) return false
  if (memberId !== authStore.currentUser?.memberId) return false
  if (offset.value >= 0) return false
  return myCurrentWeekRequest.value?.status !== 'approved'
}

function roleLabel(roleId) {
  return rolesStore.getRoleById(roleId)?.name || roleId || ''
}

// ── Notes data ────────────────────────────────────────────────────────────────

// Legacy key fallback: default fieldIds → key stored by Session 6 code
const LEGACY_KEYS = {
  ongoingTasks:    'ongoing',
  endOfWeekUpdate: 'endOfWeek',
}

const DEFAULT_PLACEHOLDERS = {
  ongoingTasks:    'Current tasks in progress…',
  blockers:        'Any blockers or issues to flag…',
  endOfWeekUpdate: 'Summary of what was accomplished…',
}

function fieldPlaceholder(fieldId) {
  return DEFAULT_PLACEHOLDERS[fieldId] || 'Enter your update here…'
}

function getNote(memberId, fieldId) {
  return notes.value[memberId]?.[fieldId] || ''
}

function setNote(memberId, fieldId, value) {
  if (!notes.value[memberId]) notes.value[memberId] = {}
  notes.value[memberId][fieldId] = value

  clearTimeout(debounceTimers[memberId])
  debounceTimers[memberId] = setTimeout(() => persistNote(memberId), 1500)
}

function buildSavePayload(memberId) {
  const member = teamStore.teamMembers.find(m => m.id === memberId)
  const payload = {
    memberId,
    memberName: member?.name || '',
    weekKey:    weekKey.value,
    updatedAt:  new Date().toISOString(),
  }
  for (const field of fieldsStore.fields) {
    payload[field.id] = notes.value[memberId]?.[field.id] || ''
  }
  return payload
}

async function persistNote(memberId) {
  await saveWeeklyDevNote(weekKey.value, memberId, buildSavePayload(memberId))
    .catch(err => console.error('Save note error:', err))

  // Notify admins/managers when a limited-permission user saves their own card.
  // 5-second debounce so rapid edits produce only one notification per session.
  const perms = authStore.currentUser?.permissions
  if (!perms?.canEditAllNotes && memberId === authStore.currentUser?.memberId) {
    clearTimeout(notifSaveTimer)
    notifSaveTimer = setTimeout(sendSaveNotification, 5000)
  }
}

function sendSaveNotification() {
  const uid     = authStore.currentUser?.uid
  const name    = authStore.currentUser?.name
  const targets = adminManagerUids.value.filter(id => id !== uid)
  for (const targetUid of targets) {
    createNotification({
      userId:  targetUid,
      type:    'weekly_notes_updated',
      message: `${name} updated their weekly notes for ${weekNotifLabel.value}`,
      weekKey: weekKey.value,
      read:    false,
    }).catch(() => {})
  }
}

function isUpdated(memberId) {
  const n = notes.value[memberId]
  if (!n) return false
  return fieldsStore.fields.some(f => !!n[f.id])
}

function statusLabel(memberId) { return isUpdated(memberId) ? 'Updated' : 'Empty' }

function statusStyle(memberId) {
  return isUpdated(memberId)
    ? 'background:#f0fdf4;color:#16a34a'
    : 'background:#f3f4f6;color:#6b7280'
}

// ── Firestore listeners ───────────────────────────────────────────────────────

function startListener(wk) {
  if (unsub) unsub()
  loading.value = true
  notes.value   = {}
  unsub = subscribeToWeeklyDevNotes(wk, (snap) => {
    const map = {}
    snap.docs.forEach(d => {
      const data = d.data()
      if (!data.memberId) return
      const memberFields = {}
      for (const field of fieldsStore.fields) {
        const legacyKey = LEGACY_KEYS[field.id]
        memberFields[field.id] = data[field.id] || (legacyKey ? data[legacyKey] : '') || ''
      }
      map[data.memberId] = memberFields
    })
    notes.value   = map
    loading.value = false
  })
}

onMounted(() => {
  fieldsStore.fetchFields()
  startRequestsListener()
})

// Apply week + highlight from notification query params whenever they change.
// immediate: true covers the initial mount case; subsequent firings handle
// clicking another weekly-notes notification while the page is already open.
// The router.replace() that clears the query also triggers this watcher, but
// the `if (!week)` guard makes that a no-op.
watch(
  () => route.query.week,
  (week) => {
    if (!week) return
    offset.value = weekKeyToOffset(week)

    // Strip query params from the URL without re-navigating
    router.replace({ path: '/weekly-notes' })

    const highlightMode = route.query.highlight

    if (highlightMode === 'own') {
      // Requester arriving after approval/denial — their own card is the relevant one
      const ownMemberId = authStore.currentUser?.memberId
      if (ownMemberId) {
        clearTimeout(highlightTimer)
        if (unsubPendingHighlight) { unsubPendingHighlight(); unsubPendingHighlight = null }
        highlightedMemberId.value = null
        nextTick(() => {
          scrollToCard(ownMemberId)
          highlightedMemberId.value = ownMemberId
          highlightTimer = setTimeout(() => { highlightedMemberId.value = null }, 2500)
        })
      }
    } else if (highlightMode === 'pending') {
      // Admin arriving from an edit-request notification — highlight the requester's card.
      // pendingRequests may not be populated yet (async subscription), so watch until it is.
      clearTimeout(highlightTimer)
      if (unsubPendingHighlight) { unsubPendingHighlight(); unsubPendingHighlight = null }
      highlightedMemberId.value = null

      const targetWeek = week  // capture for the closure
      unsubPendingHighlight = watch(
        pendingRequests,
        (reqs) => {
          const req = reqs.find(r => r.week === targetWeek)
          if (!req) return
          const member = teamStore.teamMembers.find(m => m.uid === req.userId)
          if (!member) return
          // Found the card — stop the watcher and highlight
          if (unsubPendingHighlight) { unsubPendingHighlight(); unsubPendingHighlight = null }
          clearTimeout(highlightTimer)
          highlightedMemberId.value = null
          nextTick(() => {
            scrollToCard(member.id)
            highlightedMemberId.value = member.id
            highlightTimer = setTimeout(() => { highlightedMemberId.value = null }, 2500)
          })
        },
        { immediate: true }
      )
    }
  },
  { immediate: true }
)

// Convert a stored weekKey (e.g. "2026-W27") to the integer offset relative to today.
// Uses the same week-numbering formula as the weekKey computed, so they always match.
function weekKeyToOffset(targetWk) {
  for (let o = -104; o <= 52; o++) {
    const d = new Date()
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + o * 7)
    const yr   = d.getFullYear()
    const jan1 = new Date(yr, 0, 1)
    const wn   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
    if (`${yr}-W${String(wn).padStart(2, '0')}` === targetWk) return o
  }
  return 0
}

function scrollToCard(memberId) {
  const el = document.querySelector(`[data-member-id="${memberId}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// Start (or restart) notes listener once both fields and requests are loaded
watch(
  [weekKey, () => fieldsStore.loaded],
  ([wk, ready]) => { if (ready) startListener(wk) },
  { immediate: true }
)

onUnmounted(() => {
  if (unsub) unsub()
  if (unsubRequests) unsubRequests()
  if (unsubPending) unsubPending()
  if (unsubPendingHighlight) unsubPendingHighlight()
  clearTimeout(notifSaveTimer)
  clearTimeout(highlightTimer)
  Object.values(debounceTimers).forEach(clearTimeout)
})
</script>

<style scoped>
.wk-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}
.wk-nav-center {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  justify-content: center;
}
.wk-label { font-size: 15px; font-weight: 600; color: var(--text); }

.dn-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 12px 16px;
  margin-bottom: 20px;
}
.dn-banner-txt { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; }
.dn-prog-bar {
  flex: 1;
  min-width: 80px;
  height: 6px;
  background: var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.dn-prog-fill {
  height: 100%;
  background: #16a34a;
  border-radius: 4px;
  transition: width .4s;
}

.dn-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.dn-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
}
.dn-card-readonly { opacity: 0.85; }
@keyframes dn-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,.3); } 50% { box-shadow: 0 0 0 6px rgba(99,102,241,.15); } }
.dn-card-highlight { border-color: var(--primary); animation: dn-pulse 1s ease 3; }

.dn-card-hdr {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.dn-view-only {
  font-size: 11px;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 7px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Past-week lock notice strip */
.dn-past-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 14px;
  font-size: 12px;
}

.dn-request-notice { background: #fffbeb; border-color: #fde68a; }

.er-approve-btn { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
.er-approve-btn:hover { background:#dcfce7; }
.er-deny-btn    { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
.er-deny-btn:hover { background:#fee2e2; }

.dn-notice-chip {
  font-size: 12px;
  font-weight: 500;
  border-radius: 4px;
  padding: 2px 8px;
}
.dn-notice-pending {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}
.dn-notice-denied {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.dn-field { margin-bottom: 12px; }
.dn-field:last-child { margin-bottom: 0; }

.dn-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
</style>
