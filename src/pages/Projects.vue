<template>
  <div class="content">

    <!-- Page header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">Projects</h1>
      <NotificationBell />
    </div>

    <!-- Row 1: Search + action buttons — always visible regardless of view -->
    <div class="filter-bar" style="margin-bottom:10px">
      <input class="filter-input" placeholder="🔍 Search projects…" v-model="filters.search" style="flex:1;min-width:200px">
      <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
        <button class="btn btn-secondary btn-sm" @click="router.push('/archived')">🗄 Archived</button>
        <button class="btn btn-secondary btn-sm" @click="exportCSV" title="Download as CSV">⬇ CSV</button>
        <div style="position:relative">
          <button class="btn btn-secondary btn-sm" @click="doTSV" title="Copy as TSV for Google Sheets">⎘ TSV</button>
          <span v-if="tsvCopied" class="pd-tip" style="right:0;left:auto">Copied!</span>
        </div>
        <button class="btn btn-primary btn-sm" @click="showCreateModal = true">+ New Project</button>
      </div>
    </div>

    <!-- Row 2: Dynamic left (filters in List, sub-tabs in Kanban) + always-visible List|Kanban toggle -->
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px">

      <!-- List view: filter + sort controls -->
      <div v-if="viewMode === 'list'" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;flex:1;min-width:0">
        <span class="filter-label">Year:</span>
        <select class="filter-select" v-model="filters.year">
          <option value="">All</option>
          <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
        </select>
        <select class="filter-select" v-model="filters.dateField" style="font-size:12px">
          <option value="kickstartDate">by Kickstart</option>
          <option value="liveDate">by Live Date</option>
        </select>
        <div class="filter-sep"></div>
        <span class="filter-label">Developer:</span>
        <select class="filter-select" v-model="filters.developer">
          <option value="">All</option>
          <option v-for="m in developerFilterOptions" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <div class="filter-sep"></div>
        <span class="filter-label">Phase:</span>
        <select class="filter-select" v-model="filters.phase">
          <option value="">All</option>
          <option v-for="ph in phasesStore.phaseConfig" :key="ph.id" :value="ph.id">{{ ph.name }}</option>
        </select>
        <div class="filter-sep"></div>
        <span class="filter-label">Status:</span>
        <select class="filter-select" v-model="filters.siteStatus">
          <option value="">All</option>
          <option value="development">Development</option>
          <option value="live">Live</option>
          <option value="on-hold">On-Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div class="filter-sep"></div>
        <span class="filter-label">Platform:</span>
        <select class="filter-select" v-model="filters.platform">
          <option value="">All</option>
          <option value="WordPress">WordPress</option>
          <option value="Blogger">Blogger</option>
        </select>
        <button v-if="hasFilters" class="btn btn-ghost btn-sm" @click="clearFilters">✕ Clear</button>
        <div class="filter-sep"></div>
        <span class="filter-label">Sort:</span>
        <select class="filter-select" v-model="sortBy">
          <option value="created_desc">Newest First</option>
          <option value="created_asc">Oldest First</option>
          <option value="kickstart_desc">Kickstart ↓</option>
          <option value="kickstart_asc">Kickstart ↑</option>
          <option value="live_asc">Live Date ↑</option>
          <option value="live_desc">Live Date ↓</option>
          <option value="phase_asc">Phase A→Z</option>
          <option value="phase_desc">Phase Z→A</option>
        </select>
        <span style="font-size:13px;color:var(--muted);white-space:nowrap">
          {{ sortedProjects.length }}{{ sortedProjects.length !== projectsStore.projects.length ? ' / ' + projectsStore.projects.length : '' }}
          project{{ projectsStore.projects.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Kanban view: Phase / Member sub-tabs + Role filter (Member only) -->
      <div v-else style="display:flex;align-items:center;gap:10px">
        <div class="ph-view-toggle">
          <button class="ph-view-btn" :class="{ active: kanbanTab === 'phase' }"  @click="kanbanTab = 'phase'">Phase</button>
          <button class="ph-view-btn" :class="{ active: kanbanTab === 'member' }" @click="kanbanTab = 'member'">Member</button>
        </div>
        <template v-if="kanbanTab === 'member' && canViewAll">
          <div class="filter-sep"></div>
          <span class="filter-label">Role:</span>
          <div class="ph-view-toggle">
            <button class="ph-view-btn" :class="{ active: memberRoleFilter === 'all' }"        @click="memberRoleFilter = 'all'">All</button>
            <button class="ph-view-btn" :class="{ active: memberRoleFilter === 'developer' }"  @click="memberRoleFilter = 'developer'">Developers</button>
            <button class="ph-view-btn" :class="{ active: memberRoleFilter === 'multimedia' }" @click="memberRoleFilter = 'multimedia'">Multimedia</button>
            <button class="ph-view-btn" :class="{ active: memberRoleFilter === 'qa' }"         @click="memberRoleFilter = 'qa'">QA</button>
          </div>
        </template>
      </div>

      <!-- Always: List | Kanban toggle -->
      <div class="ph-view-toggle" style="flex-shrink:0;align-self:flex-start">
        <button class="ph-view-btn" :class="{ active: viewMode === 'list' }"   @click="viewMode = 'list'">List</button>
        <button class="ph-view-btn" :class="{ active: viewMode === 'kanban' }" @click="viewMode = 'kanban'">Kanban</button>
      </div>
    </div>

    <!-- Project views -->
    <ProjectListView
      v-if="viewMode === 'list'"
      :projects="sortedProjects"
      :phaseConfig="phasesStore.phaseConfig"
      :teamMembers="teamStore.teamMembers"
      :loading="projectsStore.loading"
      @open-project="p => router.push('/projects/' + p.id)"
    />
    <template v-else>
      <ProjectsKanbanView
        v-if="kanbanTab === 'phase'"
        :projects="sortedProjects"
        :phaseConfig="phasesStore.phaseConfig"
        :teamMembers="teamStore.teamMembers"
        :loading="projectsStore.loading"
        @open-project="p => router.push('/projects/' + p.id)"
      />
      <ProjectsByMemberView
        v-else
        :projects="sortedProjects"
        :phaseConfig="phasesStore.phaseConfig"
        :teamMembers="teamStore.teamMembers"
        :loading="projectsStore.loading"
        :roleFilter="memberRoleFilter"
        @open-project="p => router.push('/projects/' + p.id)"
      />
    </template>

    <!-- Create Project Modal -->
    <CreateProjectModal
      v-if="showCreateModal"
      @created="showCreateModal = false"
      @cancel="showCreateModal = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore } from '@/stores/phases'
import { useTeamStore } from '@/stores/team'
import { useAuthStore } from '@/stores/auth'
import ProjectListView      from '@/components/projects/ProjectListView.vue'
import ProjectsKanbanView   from '@/components/projects/ProjectsKanbanView.vue'
import ProjectsByMemberView from '@/components/projects/ProjectsByMemberView.vue'
import CreateProjectModal   from '@/components/projects/CreateProjectModal.vue'
import { downloadCSV, copyTSV } from '@/utils/exportUtils'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const router        = useRouter()
const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const teamStore     = useTeamStore()
const authStore     = useAuthStore()

const canViewAll = computed(() => authStore.currentUser?.permissions?.canViewAllProjects !== false)
const memberRoleFilter = ref('all')

const showCreateModal = ref(false)

// Issue 4: viewMode is now 'list' | 'kanban' only; 'member' is a kanban sub-tab
const VIEW_KEY = 'pt_projects_view'
const _rawView = localStorage.getItem(VIEW_KEY)
const viewMode = ref(_rawView === 'kanban' ? 'kanban' : 'list')
watch(viewMode, v => localStorage.setItem(VIEW_KEY, v))

const KANBAN_TAB_KEY = 'pt_projects_kanban_tab'
const kanbanTab = ref(localStorage.getItem(KANBAN_TAB_KEY) === 'member' ? 'member' : 'phase')
watch(kanbanTab, v => localStorage.setItem(KANBAN_TAB_KEY, v))

const SORT_KEY = 'pt_projects_sort'
const sortBy   = ref(localStorage.getItem(SORT_KEY) || 'created_desc')
watch(sortBy, v => localStorage.setItem(SORT_KEY, v))

const filters = ref({
  search: '', year: '', dateField: 'kickstartDate', developer: '', phase: '', siteStatus: '', platform: '',
})

const developerFilterOptions = computed(() =>
  teamStore.teamMembers.filter(m => m.active !== false)
)

const availableYears = computed(() => {
  const ys = new Set()
  projectsStore.projects.forEach(p => {
    const d = p[filters.value.dateField]
    if (d) ys.add(new Date(d).getFullYear())
  })
  return [...ys].sort((a, b) => b - a)
})

const hasFilters = computed(() =>
  !!(filters.value.search || filters.value.year || filters.value.developer || filters.value.phase || filters.value.siteStatus || filters.value.platform)
)

const filteredProjects = computed(() =>
  projectsStore.projects.filter(p => {
    const f = filters.value
    if (f.search && !p.name.toLowerCase().includes(f.search.toLowerCase())) return false
    if (f.year) {
      const d = p[f.dateField]
      if (!d || new Date(d).getFullYear() !== parseInt(f.year)) return false
    }
    if (f.developer) {
      const allIds = [
        p.leadDeveloperId,
        ...(Array.isArray(p.developersInvolvedIds) ? p.developersInvolvedIds : []),
        p.webServicesAssigneeId,
        p.multimediaAssigneeId,
        p.qaAssigneeId,
      ].filter(Boolean)
      if (allIds.length > 0) {
        if (!allIds.includes(f.developer)) return false
      } else {
        const filterMember = teamStore.teamMembers.find(m => m.id === f.developer)
        if (!filterMember || p.developer !== filterMember.name) return false
      }
    }
    if (f.siteStatus && p.siteStatus !== f.siteStatus) return false
    if (f.platform   && p.platform   !== f.platform)   return false
    // Issue 6: top-level phase match — any active phase entry whose phase id matches
    if (f.phase) {
      const aps = (p.activePhases && p.activePhases.length)
        ? p.activePhases
        : [{ phase: p.currentPhase, subPhase: p.currentSubPhase }]
      if (!aps.some(ap => ap.phase === f.phase)) return false
    }
    return true
  })
)

function clearFilters() {
  filters.value = { search: '', year: '', dateField: filters.value.dateField, developer: '', phase: '', siteStatus: '', platform: '' }
}

function toMs(v) {
  if (!v) return null
  if (typeof v?.toDate === 'function') return v.toDate().getTime()
  if (v?.seconds) return v.seconds * 1000
  const ms = new Date(v).getTime()
  return isNaN(ms) ? null : ms
}

const sortedProjects = computed(() => {
  const list = filteredProjects.value.slice()
  const phaseOrder = Object.fromEntries(phasesStore.phaseConfig.map((ph, i) => [ph.id, i]))
  const cmp = (a, b) => {
    const ma = toMs(a), mb = toMs(b)
    if (ma === null && mb === null) return 0
    if (ma === null) return 1
    if (mb === null) return -1
    return ma - mb
  }
  switch (sortBy.value) {
    case 'created_asc':    return list.sort((a, b) =>  cmp(a.createdAt,     b.createdAt))
    case 'kickstart_desc': return list.sort((a, b) =>  cmp(b.kickstartDate, a.kickstartDate))
    case 'kickstart_asc':  return list.sort((a, b) =>  cmp(a.kickstartDate, b.kickstartDate))
    case 'live_asc':       return list.sort((a, b) =>  cmp(a.liveDate,      b.liveDate))
    case 'live_desc':      return list.sort((a, b) =>  cmp(b.liveDate,      a.liveDate))
    case 'phase_asc':      return list.sort((a, b) => (phaseOrder[a.currentPhase] ?? 999) - (phaseOrder[b.currentPhase] ?? 999))
    case 'phase_desc':     return list.sort((a, b) => (phaseOrder[b.currentPhase] ?? 999) - (phaseOrder[a.currentPhase] ?? 999))
    default:               return list.sort((a, b) =>  cmp(b.createdAt,     a.createdAt))
  }
})

const tsvCopied = ref(false)
let _tsvTimer = null

function exportCSV() {
  downloadCSV(sortedProjects.value, phasesStore.phaseConfig)
}

function doTSV() {
  copyTSV(sortedProjects.value, phasesStore.phaseConfig).then(() => {
    tsvCopied.value = true
    clearTimeout(_tsvTimer)
    _tsvTimer = setTimeout(() => { tsvCopied.value = false }, 2000)
  }).catch(() => {})
}
</script>
