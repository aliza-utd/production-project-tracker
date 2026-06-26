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

    <!-- Loading -->
    <div v-if="loading" style="display:flex;align-items:center;gap:10px;padding:32px;color:var(--muted)">
      <span style="animation:spin 1s linear infinite">⏳</span> Loading…
    </div>

    <!-- Sections grid -->
    <div v-else class="wk-grid">
      <div v-for="sec in SECTIONS" :key="sec.key" class="wk-section">
        <!-- Section header -->
        <div class="wk-sec-hdr">
          <span>{{ sec.icon }} {{ sec.label }}</span>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px"
            @click="toggleAdd(sec.key)">
            {{ addOpen === sec.key ? '✕' : '+ Add' }}
          </button>
        </div>

        <!-- Items -->
        <div v-for="item in sectionItems(sec.key)" :key="item.id" class="wk-item">
          <div style="flex:1;min-width:0">
            <div v-if="item.projectId" style="font-size:12px;color:var(--muted);margin-bottom:1px">
              {{ projectName(item.projectId) }}
            </div>
            <div style="font-size:13px">{{ item.note || item.text }}</div>
          </div>
          <button class="btn-icon" style="flex-shrink:0" @click="removeItem(sec.key, item.id)"
            title="Remove">✕</button>
        </div>
        <div v-if="!sectionItems(sec.key).length"
          style="font-size:12px;color:var(--muted);padding:8px 0">Nothing logged yet.</div>

        <!-- Add form -->
        <div v-if="addOpen === sec.key" class="wk-add-form">
          <select v-if="sec.needsProject" class="form-select" v-model="addForm.projectId"
            style="font-size:13px;margin-bottom:8px">
            <option value="">Select project…</option>
            <option v-for="p in projectsStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <input class="form-input" v-model="addForm.text" placeholder="Note…"
            style="font-size:13px;margin-bottom:8px"
            @keydown.enter="addItem(sec.key, sec.needsProject)">
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" @click="addItem(sec.key, sec.needsProject)">Add</button>
            <button class="btn btn-ghost btn-sm" @click="addOpen = null">Cancel</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { subscribeToWeeklyTracker, saveWeeklyTrackerDoc } from '@/firebase-service'

const projectsStore = useProjectsStore()

const SECTIONS = [
  { key: 'newProjects',      icon: '✨', label: 'New Projects',       needsProject: true  },
  { key: 'pendingToOngoing', icon: '🔄', label: 'Pending to Ongoing', needsProject: true  },
  { key: 'deliveryPreviews', icon: '🚀', label: 'Delivery & Previews',needsProject: true  },
  { key: 'sitesGoingLive',   icon: '🌐', label: 'Sites Going Live',   needsProject: true  },
  { key: 'urgentRequests',   icon: '⚡', label: 'Urgent Requests',    needsProject: false },
  { key: 'blockersIssues',   icon: '🚧', label: 'Blockers & Issues',  needsProject: false },
]

const offset   = ref(0)
const entry    = ref({})
const loading  = ref(false)
const addOpen  = ref(null)
const addForm  = ref({ projectId: '', text: '' })

let unsub = null

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
  const sun = new Date(d); sun.setDate(sun.getDate() + 6)
  const fmt = (dt) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const prefix = offset.value === 0 ? 'This Week · '
    : offset.value === -1 ? 'Last Week · '
    : offset.value === 1  ? 'Next Week · ' : ''
  return `${prefix}${fmt(d)} – ${fmt(sun)}, ${d.getFullYear()}`
})

function sectionItems(key) {
  return (entry.value[key] || [])
}

function projectName(id) {
  return projectsStore.projects.find(p => p.id === id)?.name || id
}

function startListener(wk) {
  if (unsub) unsub()
  loading.value = true
  unsub = subscribeToWeeklyTracker(wk, (snap) => {
    entry.value   = snap.exists() ? snap.data() : {}
    loading.value = false
  })
}

watch(weekKey, (wk) => { startListener(wk); addOpen.value = null }, { immediate: true })
onUnmounted(() => { if (unsub) unsub() })

function toggleAdd(key) {
  if (addOpen.value === key) { addOpen.value = null; return }
  addOpen.value = key
  addForm.value = { projectId: '', text: '' }
}

async function addItem(sectionKey, needsProject) {
  if (!addForm.value.text.trim()) return
  if (needsProject && !addForm.value.projectId) return

  const item = {
    id:        Math.random().toString(36).slice(2),
    text:      addForm.value.text.trim(),
    projectId: needsProject ? addForm.value.projectId : undefined,
    createdAt: new Date().toISOString(),
  }

  const updated = { ...entry.value }
  updated[sectionKey] = [...(updated[sectionKey] || []), item]
  entry.value = updated

  await saveWeeklyTrackerDoc(weekKey.value, updated)
  addOpen.value = null
}

async function removeItem(sectionKey, id) {
  const updated = { ...entry.value }
  updated[sectionKey] = (updated[sectionKey] || []).filter(i => i.id !== id)
  entry.value = updated
  await saveWeeklyTrackerDoc(weekKey.value, updated)
}
</script>

<style scoped>
.wk-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
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

.wk-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) { .wk-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 700px)  { .wk-grid { grid-template-columns: 1fr; } }

.wk-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px;
}
.wk-sec-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text);
}
.wk-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.wk-add-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
</style>
