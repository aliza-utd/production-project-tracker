<template>
  <div>

    <!-- Bulk Action Toolbar -->
    <Teleport to="body">
      <div v-if="showArchiveConfirm" class="confirm-wrap" @mousedown.self="showArchiveConfirm = false">
        <div class="confirm-box">
          <div class="confirm-title">Archive {{ selectedIds.length }} project{{ selectedIds.length !== 1 ? 's' : '' }}?</div>
          <div class="confirm-desc">They'll be moved to the archive. You can restore them later.</div>
          <div class="confirm-btns">
            <button class="btn btn-ghost btn-sm" @click="showArchiveConfirm = false">Cancel</button>
            <button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none"
              @click="archiveSelected" :disabled="bulkSaving">
              {{ bulkSaving ? 'Archiving…' : 'Archive' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="selectedIds.length > 0" class="bulk-toolbar">
      <span class="bulk-count">{{ selectedIds.length }} selected</span>

      <div style="display:flex;align-items:center;gap:6px">
        <select class="filter-select" v-model="bulkPhase" style="font-size:12px">
          <option value="">Change Phase…</option>
          <option v-for="ph in phasesStore.phaseConfig" :key="ph.id" :value="ph.id">{{ ph.name }}</option>
        </select>
        <button v-if="bulkPhase" class="btn btn-ghost btn-sm" @click="applyBulkPhase" :disabled="bulkSaving">Apply</button>
      </div>

      <div style="display:flex;align-items:center;gap:6px">
        <select class="filter-select" v-model="bulkDeveloperId" style="font-size:12px">
          <option value="">Assign Developer…</option>
          <option v-for="m in activeMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <button v-if="bulkDeveloperId" class="btn btn-ghost btn-sm" @click="applyBulkDeveloper" :disabled="bulkSaving">Apply</button>
      </div>

      <button class="btn btn-ghost btn-sm" @click="exportSelected">⬇ Export</button>
      <button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none"
        @click="showArchiveConfirm = true">Archive Selected</button>
      <button class="btn btn-ghost btn-sm" @click="clearSelection">✕ Clear</button>
    </div>

    <!-- Loading -->
    <div v-if="loading"
      style="display:flex;align-items:center;justify-content:center;padding:60px;gap:12px;color:var(--muted)">
      <span style="font-size:22px;animation:spin 1s linear infinite">⏳</span>
      <span>Loading projects…</span>
    </div>

    <!-- Empty -->
    <div v-else-if="!projects.length" class="empty">
      <div class="empty-icon">📂</div>
      <div class="empty-title">No projects found</div>
      <div class="empty-desc">No projects match the current filters.</div>
    </div>

    <!-- Table -->
    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th style="width:32px;padding-right:0">
              <input type="checkbox" ref="headerCbRef" :checked="allSelected" @change="toggleSelectAll">
            </th>
            <th>Project Name</th>
            <th>URL</th>
            <th>Platform</th>
            <th>Developer</th>
            <th>Kickstart</th>
            <th>Live Date</th>
            <th>Phase</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id" @click="$emit('open-project', p)" style="cursor:pointer">
            <td style="padding-right:0" @click.stop>
              <input type="checkbox" :checked="selectedIds.includes(p.id)" @change="toggleSelect(p.id)">
            </td>
            <td style="font-weight:600;max-width:200px">
              {{ p.name }}
              <span v-if="isUrgent(p.liveDate)" class="urgent-pill" style="margin-left:6px">⚡ Urgent</span>
            </td>
            <td class="url-cell" style="max-width:140px">
              <a v-if="p.url" :href="p.url" target="_blank" class="ext" @click.stop style="font-size:12px">
                {{ truncateUrl(p.url) }}
              </a>
              <span v-else style="color:var(--muted)">—</span>
            </td>
            <td>
              <span class="badge" :class="p.platform === 'WordPress' ? 'badge-wp' : 'badge-blogger'">
                {{ p.platform || '—' }}
              </span>
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:7px">
                <div v-if="memberByName(p.developer)" class="avatar avatar-sm"
                  :style="'background:' + memberByName(p.developer).avatarColor">
                  {{ memberByName(p.developer).initials }}
                </div>
                {{ p.developer || '—' }}
              </div>
            </td>
            <td>{{ fmtDate(p.kickstartDate) || '—' }}</td>
            <td :style="liveDateStyle(p.liveDate)">{{ fmtDate(p.liveDate) || '—' }}</td>
            <td>
              <div style="display:flex;flex-wrap:wrap;gap:3px">
                <span v-for="info in allPhaseInfos(p)" :key="info.id"
                  class="badge"
                  :style="'background:' + info.bg + ';color:' + info.color">
                  <span class="phase-dot" :style="'background:' + info.color"></span>
                  {{ info.name }}
                </span>
              </div>
            </td>
            <td>
              <SiteStatusBadge :status="p.siteStatus || 'development'" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, watchEffect } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore }   from '@/stores/phases'
import { useTeamStore }     from '@/stores/team'
import { useAuthStore }     from '@/stores/auth'
import SiteStatusBadge from '@/components/shared/SiteStatusBadge.vue'

const props = defineProps({
  projects:    { type: Array,   default: () => [] },
  phaseConfig: { type: Array,   default: () => [] },
  teamMembers: { type: Array,   default: () => [] },
  loading:     { type: Boolean, default: false },
})
defineEmits(['open-project'])

const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const teamStore     = useTeamStore()
const authStore     = useAuthStore()

// ── Selection ─────────────────────────────────────────────────────────────────
const selectedIds   = ref([])
const headerCbRef   = ref(null)

const allSelected  = computed(() => props.projects.length > 0 && selectedIds.value.length === props.projects.length)
const someSelected = computed(() => selectedIds.value.length > 0 && selectedIds.value.length < props.projects.length)

watchEffect(() => {
  if (headerCbRef.value) headerCbRef.value.indeterminate = someSelected.value
})

function toggleSelect(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else          selectedIds.value.push(id)
}

function toggleSelectAll() {
  if (allSelected.value) selectedIds.value = []
  else                   selectedIds.value = props.projects.map(p => p.id)
}

function clearSelection() {
  selectedIds.value   = []
  bulkPhase.value     = ''
  bulkDeveloperId.value = ''
}

// clear selection when the project list changes (filter applied, etc.)
watch(() => props.projects.map(p => p.id).join(','), () => {
  selectedIds.value = selectedIds.value.filter(id => props.projects.some(p => p.id === id))
})

// ── Bulk actions ──────────────────────────────────────────────────────────────
const bulkPhase       = ref('')
const bulkDeveloperId = ref('')
const bulkSaving      = ref(false)
const showArchiveConfirm = ref(false)

const activeMembers = computed(() => teamStore.teamMembers.filter(m => m.active !== false))

async function applyBulkPhase() {
  if (!bulkPhase.value || !selectedIds.value.length) return
  bulkSaving.value = true
  try {
    await Promise.all(selectedIds.value.map(id =>
      projectsStore.updateProject(id, {
        currentPhase: bulkPhase.value,
        activePhases: [{ phase: bulkPhase.value, subPhase: null }],
      })
    ))
  } finally {
    bulkPhase.value  = ''
    bulkSaving.value = false
    clearSelection()
  }
}

async function applyBulkDeveloper() {
  if (!bulkDeveloperId.value || !selectedIds.value.length) return
  const member = teamStore.teamMembers.find(m => m.id === bulkDeveloperId.value)
  if (!member) return
  bulkSaving.value = true
  try {
    await Promise.all(selectedIds.value.map(id =>
      projectsStore.updateProject(id, { developer: member.name })
    ))
  } finally {
    bulkDeveloperId.value = ''
    bulkSaving.value      = false
    clearSelection()
  }
}

async function archiveSelected() {
  bulkSaving.value = true
  try {
    const by = authStore.currentUser?.name || ''
    const at = new Date().toISOString()
    await Promise.all(selectedIds.value.map(id => projectsStore.archiveProject(id, by, at)))
  } finally {
    showArchiveConfirm.value = false
    bulkSaving.value         = false
    clearSelection()
  }
}

function exportSelected() {
  const selected = props.projects.filter(p => selectedIds.value.includes(p.id))
  const header   = ['Project Name', 'URL', 'Platform', 'Developer', 'Kickstart Date', 'Live Date', 'Phase', 'Status']
  const rows     = selected.map(p => [
    p.name,
    p.url || '',
    p.platform || '',
    p.developer || '',
    p.kickstartDate || '',
    p.liveDate || '',
    p.currentPhase || '',
    p.siteStatus || '',
  ])
  const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `projects-export-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Display helpers ────────────────────────────────────────────────────────────
function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isUrgent(d) {
  if (!d) return false
  const diff = new Date(d + 'T00:00:00') - new Date()
  return diff >= 0 && diff <= 7 * 86400000
}

function liveDateStyle(d) {
  if (!d) return {}
  const diff = (new Date(d + 'T00:00:00') - new Date()) / 86400000
  if (diff < 0)  return {}
  if (diff < 7)  return { color: 'var(--danger)', fontWeight: '600' }
  if (diff < 14) return { color: '#d97706', fontWeight: '600' }
  return { color: '#16a34a' }
}

function truncateUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.length > 28 ? host.slice(0, 28) + '…' : host
  } catch {
    return url.length > 28 ? url.slice(0, 28) + '…' : url
  }
}

function memberByName(name) {
  return props.teamMembers.find(m => m.name === name && m.active !== false)
}

function allPhaseInfos(proj) {
  const aps     = proj.activePhases
  const entries = (aps && aps.length) ? aps : [{ phase: proj.currentPhase || 'kickstart', subPhase: proj.currentSubPhase || null }]
  return entries.map(ap => {
    const ph = props.phaseConfig.find(x => x.id === ap.phase)
    if (!ph) return { id: ap.phase, name: ap.phase || '—', color: '#6b7280', bg: '#f9fafb' }
    if (ap.subPhase && ph.subPhases) {
      const sp = ph.subPhases.find(s => s.id === ap.subPhase)
      return { ...ph, name: `${ph.name}: ${sp ? sp.name : ap.subPhase}` }
    }
    return { ...ph }
  })
}
</script>

<style scoped>
.bulk-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface2, #f1f5f9);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.bulk-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-right: 4px;
}
</style>
