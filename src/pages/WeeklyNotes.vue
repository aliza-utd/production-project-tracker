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
      <button class="btn btn-ghost btn-sm" @click="offset++">Next →</button>
    </div>

    <!-- Completion banner -->
    <div class="dn-banner">
      <span class="dn-banner-txt">
        {{ completion.complete }}/{{ completion.total }} notes completed
      </span>
      <div class="dn-prog-bar">
        <div class="dn-prog-fill"
          :style="{ width: (completion.total ? Math.round(completion.complete / completion.total * 100) : 0) + '%' }">
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span v-for="m in devMembers" :key="m.id"
          class="badge"
          :style="statusStyle(m.id)">
          {{ m.name.split(' ')[0] }}: {{ statusLabel(m.id) }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="display:flex;align-items:center;gap:10px;padding:32px;color:var(--muted)">
      <span style="animation:spin 1s linear infinite">⏳</span> Loading…
    </div>

    <!-- Member cards -->
    <div v-else class="dn-grid">
      <div v-for="m in devMembers" :key="m.id" class="dn-card">
        <!-- Card header -->
        <div class="dn-card-hdr">
          <div class="avatar" :style="'background:' + (m.avatarColor || '#6366f1')">
            {{ m.initials || '?' }}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
            <div style="font-size:12px;color:var(--muted)">{{ m.role || m.department }}</div>
          </div>
          <span class="badge" :style="statusStyle(m.id)">{{ statusLabel(m.id) }}</span>
        </div>

        <!-- Start of week -->
        <div class="dn-field">
          <div class="dn-field-label">
            Start of Week Plans
            <button v-if="canCopyPrev(m.id)" class="btn btn-ghost btn-sm"
              style="font-size:11px;padding:1px 6px;margin-left:6px"
              @click="copyPrevWeek(m.id)">Copy prev week</button>
          </div>
          <textarea class="form-textarea dn-textarea"
            :value="getNote(m.id, 'startOfWeek')"
            placeholder="What are you planning to work on this week?"
            @input="setNote(m.id, 'startOfWeek', $event.target.value)"></textarea>
        </div>

        <!-- End of week -->
        <div class="dn-field">
          <div class="dn-field-label">End of Week Summary</div>
          <textarea class="form-textarea dn-textarea"
            :value="getNote(m.id, 'endOfWeek')"
            placeholder="What did you accomplish this week?"
            @input="setNote(m.id, 'endOfWeek', $event.target.value)"></textarea>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useTeamStore } from '@/stores/team'
import { subscribeToWeeklyDevNotes, saveWeeklyDevNote, getPrevWeekDevNote } from '@/firebase-service'

const teamStore = useTeamStore()

const offset  = ref(0)
const notes   = ref({})
const loading = ref(false)
let   unsub   = null
const debounceTimers = {}

const devMembers = computed(() =>
  teamStore.teamMembers.filter(m => m.active !== false && (m.department === 'Developer' || m.department === 'Production'))
)

const weekKey = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset.value * 7)
  const yr   = d.getFullYear()
  const jan1 = new Date(yr, 0, 1)
  const wn   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${yr}-W${String(wn).padStart(2, '0')}`
})

const prevWeekKey = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + (offset.value - 1) * 7)
  const yr   = d.getFullYear()
  const jan1 = new Date(yr, 0, 1)
  const wn   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${yr}-W${String(wn).padStart(2, '0')}`
})

const weekLabel = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset.value * 7)
  const sun = new Date(d); sun.setDate(sun.getDate() + 6)
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const prefix = offset.value === 0 ? 'This Week · '
    : offset.value === -1 ? 'Last Week · '
    : offset.value === 1  ? 'Next Week · ' : ''
  return `${prefix}${fmt(d)} – ${fmt(sun)}, ${d.getFullYear()}`
})

const completion = computed(() => {
  const total    = devMembers.value.length
  const complete = devMembers.value.filter(m => noteStatus(m.id) === 'complete').length
  return { total, complete }
})

function getNote(memberId, field) {
  return notes.value[memberId]?.[field] || ''
}

function setNote(memberId, field, value) {
  if (!notes.value[memberId]) notes.value[memberId] = { startOfWeek: '', endOfWeek: '' }
  notes.value[memberId][field] = value

  clearTimeout(debounceTimers[memberId])
  debounceTimers[memberId] = setTimeout(() => {
    const member = teamStore.teamMembers.find(m => m.id === memberId)
    saveWeeklyDevNote(weekKey.value, memberId, {
      memberId,
      memberName:  member?.name || '',
      weekKey:     weekKey.value,
      startOfWeek: notes.value[memberId]?.startOfWeek || '',
      endOfWeek:   notes.value[memberId]?.endOfWeek   || '',
      updatedAt:   new Date().toISOString(),
    }).catch(err => console.error('Save dev note error:', err))
  }, 1500)
}

function noteStatus(memberId) {
  const sow = getNote(memberId, 'startOfWeek')
  const eow = getNote(memberId, 'endOfWeek')
  if (sow && eow) return 'complete'
  if (sow || eow) return 'partial'
  return 'empty'
}

function statusLabel(memberId) {
  const s = noteStatus(memberId)
  return s === 'complete' ? 'Complete' : s === 'partial' ? 'Partial' : 'Empty'
}

function statusStyle(memberId) {
  const s = noteStatus(memberId)
  if (s === 'complete') return 'background:#f0fdf4;color:#16a34a'
  if (s === 'partial')  return 'background:#fffbeb;color:#d97706'
  return 'background:#f3f4f6;color:#6b7280'
}

function canCopyPrev(memberId) {
  return !getNote(memberId, 'startOfWeek')
}

async function copyPrevWeek(memberId) {
  const prev = await getPrevWeekDevNote(prevWeekKey.value, memberId)
  if (prev?.startOfWeek) {
    setNote(memberId, 'startOfWeek', prev.startOfWeek)
  }
}

function startListener(wk) {
  if (unsub) unsub()
  loading.value = true
  notes.value = {}
  unsub = subscribeToWeeklyDevNotes(wk, (snap) => {
    const map = {}
    snap.docs.forEach(d => {
      const data = d.data()
      map[data.memberId] = { startOfWeek: data.startOfWeek || '', endOfWeek: data.endOfWeek || '' }
    })
    notes.value   = map
    loading.value = false
  })
}

watch(weekKey, (wk) => startListener(wk), { immediate: true })
onUnmounted(() => {
  if (unsub) unsub()
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
  flex-wrap: wrap;
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
.dn-card-hdr {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.dn-field { margin-bottom: 12px; }
.dn-field-label {
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: .03em;
}
.dn-textarea { min-height: 80px; resize: vertical; font-size: 13px; }
</style>
