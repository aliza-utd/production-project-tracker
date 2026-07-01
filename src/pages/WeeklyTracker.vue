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
        <button class="btn btn-secondary btn-sm" style="font-size:12px"
          :disabled="carryOverLoading"
          @click="carryOverFromLastWeek">
          {{ carryOverLoading ? 'Carrying over…' : '↩ Carry over from last week' }}
        </button>
        <span v-if="carryOverMsg" style="font-size:12px;color:var(--muted)">{{ carryOverMsg }}</span>
        <NotificationBell />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="display:flex;align-items:center;gap:10px;padding:32px;color:var(--muted)">
      <span style="animation:spin 1s linear infinite">⏳</span> Loading…
    </div>

    <!-- Sections grid -->
    <div v-else class="wk-grid">
      <div v-for="sec in SECTIONS" :key="sec.key" class="wk-section"
        :style="sec.color ? { borderTop: `3px solid ${sec.color}` } : {}">

        <!-- Section header -->
        <div class="wk-sec-hdr">
          <span>{{ sec.icon }} {{ sec.label }}</span>
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px"
            @click="toggleAdd(sec.key)">
            {{ addOpen === sec.key ? '✕' : '+ Add' }}
          </button>
        </div>

        <!-- ── FREEFORM (New Projects) — drag-reorderable ── -->
        <template v-if="sec.kind === 'freeform'">
          <div v-for="item in sectionItems(sec.key)" :key="item.id"
            class="wk-item wk-draggable"
            :class="{ 'wk-drag-over': dragOverId === item.id }"
            draggable="true"
            @dragstart="onDragStart(sec.key, item.id, $event)"
            @dragover.prevent="dragOverId = item.id"
            @dragleave="dragOverId = null"
            @drop.prevent="onDrop(sec.key, item.id)">
            <span class="drag-handle" title="Drag to reorder">⠿</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px">{{ item.text }}</div>
              <div v-if="item.projectId" style="font-size:11px;color:var(--muted);margin-top:2px">
                {{ projectPhase(item.projectId) || '—' }}
                <span v-if="projectSiteStatus(item.projectId)"
                  :style="{ color: siteStatusColor(projectSiteStatus(item.projectId)) }">
                  · {{ projectSiteStatus(item.projectId) }}
                </span>
              </div>
            </div>
            <button v-if="!item.projectId"
              class="btn btn-ghost btn-sm"
              style="font-size:11px;padding:2px 8px;white-space:nowrap;flex-shrink:0"
              :disabled="creatingProjectFor === item.id"
              @click.stop="addToProjects(item, sec.key)">
              {{ creatingProjectFor === item.id ? 'Creating…' : 'Add to Projects' }}
            </button>
            <button class="btn-icon" @click="removeItem(sec.key, item.id)" title="Remove">✕</button>
          </div>
          <div v-if="!sectionItems(sec.key).length" class="wk-empty">Nothing logged yet.</div>

          <div v-if="addOpen === sec.key" class="wk-add-form">
            <input class="form-input" v-model="addForm.text"
              placeholder="Project name or note…" style="font-size:13px;margin-bottom:8px"
              @keydown.enter="addFreeformItem(sec.key)">
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" @click="addFreeformItem(sec.key)">Add</button>
              <button class="btn btn-ghost btn-sm" @click="addOpen = null">Cancel</button>
            </div>
          </div>
        </template>

        <!-- ── PROJECT LINK (Pending to Ongoing) ── -->
        <template v-else-if="sec.kind === 'project'">
          <div v-for="item in sectionItems(sec.key)" :key="item.id" class="wk-item">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500">{{ projectName(item.projectId) }}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">
                {{ projectPhase(item.projectId) || '—' }}
                <span v-if="projectSiteStatus(item.projectId)"
                  :style="{ color: siteStatusColor(projectSiteStatus(item.projectId)) }">
                  · {{ projectSiteStatus(item.projectId) }}
                </span>
              </div>
            </div>
            <button class="btn-icon" @click="removeItem(sec.key, item.id)" title="Remove">✕</button>
          </div>
          <div v-if="!sectionItems(sec.key).length" class="wk-empty">Nothing logged yet.</div>

          <div v-if="addOpen === sec.key" class="wk-add-form">
            <div class="wk-project-search" style="margin-bottom:8px">
              <input class="form-input" v-model="addForm.projectSearch"
                placeholder="Search projects…" style="font-size:13px"
                autocomplete="off"
                @input="showDropdown = true"
                @focus="showDropdown = true"
                @keydown.escape="showDropdown = false"
                @keydown.enter.prevent="selectFirstProject(sec)">
              <div v-if="showDropdown && filteredProjects.length" class="wk-dropdown">
                <div v-for="p in filteredProjects" :key="p.id"
                  class="wk-dropdown-item"
                  @mousedown.prevent="selectProject(p, sec)">
                  {{ p.name }}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm"
                :disabled="!addForm.projectId"
                @click="addProjectItem(sec.key)">Add</button>
              <button class="btn btn-ghost btn-sm" @click="addOpen = null">Cancel</button>
            </div>
          </div>
        </template>

        <!-- ── PROJECT + DATE (Delivery & Previews, Sites Going Live) ── -->
        <template v-else-if="sec.kind === 'project-date'">
          <div v-for="item in sectionItems(sec.key)" :key="item.id"
            class="wk-item" style="flex-direction:column;align-items:stretch;gap:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;font-size:13px;font-weight:500;min-width:0">
                {{ projectName(item.projectId) }}
              </div>
              <button class="btn-icon" @click="removeItem(sec.key, item.id)" title="Remove">✕</button>
            </div>
            <input type="date" class="form-input"
              :value="item.date"
              style="font-size:12px"
              @change="onItemDateChange(sec, item.id, $event.target.value)">
          </div>
          <div v-if="!sectionItems(sec.key).length" class="wk-empty">Nothing logged yet.</div>

          <div v-if="addOpen === sec.key" class="wk-add-form">
            <div class="wk-project-search" style="margin-bottom:8px">
              <input class="form-input" v-model="addForm.projectSearch"
                placeholder="Search projects…" style="font-size:13px"
                autocomplete="off"
                @input="showDropdown = true"
                @focus="showDropdown = true"
                @keydown.escape="showDropdown = false"
                @keydown.enter.prevent="selectFirstProject(sec)">
              <div v-if="showDropdown && filteredProjects.length" class="wk-dropdown">
                <div v-for="p in filteredProjects" :key="p.id"
                  class="wk-dropdown-item"
                  @mousedown.prevent="selectProject(p, sec)">
                  {{ p.name }}
                </div>
              </div>
            </div>
            <input type="date" class="form-input" v-model="addForm.date"
              style="font-size:13px;margin-bottom:8px">
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm"
                :disabled="!addForm.projectId"
                @click="addProjectDateItem(sec)">Add</button>
              <button class="btn btn-ghost btn-sm" @click="addOpen = null">Cancel</button>
            </div>
          </div>
        </template>

        <!-- ── RICH TEXT (Urgent Requests, Blockers & Issues) ── -->
        <template v-else-if="sec.kind === 'richtext'">
          <div v-for="item in sectionItems(sec.key)" :key="item.id" class="wk-richtext-block">
            <template v-if="editingRichId === `${sec.key}:${item.id}`">
              <RichTextEditor v-model="editingRichHtml" style="margin-bottom:8px" />
              <div style="display:flex;gap:6px">
                <button class="btn btn-primary btn-sm" @click="saveRichItem(sec.key, item.id)">Save</button>
                <button class="btn btn-ghost btn-sm" @click="editingRichId = null">Cancel</button>
              </div>
            </template>
            <template v-else>
              <div class="wk-html-content" v-html="item.html || '<em style=\'color:var(--muted)\'>Empty block</em>'"></div>
              <div class="wk-richtext-actions">
                <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px"
                  @click="editRich(sec.key, item)">Edit</button>
                <button class="btn-icon" style="font-size:11px"
                  @click="removeItem(sec.key, item.id)" title="Remove">✕</button>
              </div>
            </template>
          </div>
          <div v-if="!sectionItems(sec.key).length" class="wk-empty">Nothing logged yet.</div>

          <div v-if="addOpen === sec.key" class="wk-add-form">
            <RichTextEditor v-model="addForm.html" placeholder="Write here…" style="margin-bottom:8px" />
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" @click="addRichItem(sec.key)">Add</button>
              <button class="btn btn-ghost btn-sm" @click="addOpen = null">Cancel</button>
            </div>
          </div>
        </template>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore }   from '@/stores/phases'
import { useAuthStore }     from '@/stores/auth'
import { usePhaseLogic }    from '@/composables/usePhaseLogic'
import { subscribeToWeeklyTracker, saveWeeklyTrackerDoc, getWeeklyTrackerDoc } from '@/firebase-service'
import RichTextEditor from '@/components/shared/RichTextEditor.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const authStore     = useAuthStore()
const { emptyPhaseEntry } = usePhaseLogic()

// ── Section definitions ───────────────────────────────────────────────────────
// color: null = no accent; otherwise a CSS color for the top border
// kind:  freeform | project | project-date | richtext
// dateField: the project document field that syncs with the date picker
const SECTIONS = [
  { key: 'newProjects',      kind: 'freeform',      icon: '✨', label: 'New Projects',        color: null,      dateField: null },
  { key: 'pendingToOngoing', kind: 'project',        icon: '🔄', label: 'Pending to Ongoing',  color: '#f59e0b', dateField: null },
  { key: 'deliveryPreviews', kind: 'project-date',   icon: '🚀', label: 'Delivery & Previews', color: '#3b82f6', dateField: 'deliveryDate' },
  { key: 'sitesGoingLive',   kind: 'project-date',   icon: '🌐', label: 'Sites Going Live',    color: '#10b981', dateField: 'liveDate' },
  { key: 'urgentRequests',   kind: 'richtext',       icon: '⚡', label: 'Urgent Requests',     color: null,      dateField: null },
  { key: 'blockersIssues',   kind: 'richtext',       icon: '🚧', label: 'Blockers & Issues',   color: null,      dateField: null },
]

// ── State ─────────────────────────────────────────────────────────────────────
const offset  = ref(0)
const entry   = ref({})
const loading = ref(false)
const addOpen = ref(null)
const addForm = ref({ projectId: '', projectSearch: '', text: '', html: '', date: '' })

// "Add to Projects" for freeform items
const creatingProjectFor = ref(null)

// Carry over
const carryOverLoading = ref(false)
const carryOverMsg     = ref('')

// Type-ahead
const showDropdown = ref(false)
const filteredProjects = computed(() => {
  const q = (addForm.value.projectSearch || '').toLowerCase().trim()
  const list = q
    ? projectsStore.projects.filter(p => p.name.toLowerCase().includes(q))
    : projectsStore.projects.slice()
  return list.slice(0, 10)
})

// Rich text inline editing
const editingRichId   = ref(null)
const editingRichHtml = ref('')

// Drag-and-drop (freeform column only)
let   _dragSectionKey = null
let   _dragItemId     = null
const dragOverId      = ref(null)

let unsub = null

// ── Week key helpers ──────────────────────────────────────────────────────────
function computeWeekKey(off) {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + off * 7)
  const yr   = d.getFullYear()
  const jan1 = new Date(yr, 0, 1)
  const wn   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${yr}-W${String(wn).padStart(2, '0')}`
}

const weekKey     = computed(() => computeWeekKey(offset.value))
const prevWeekKey = computed(() => computeWeekKey(offset.value - 1))

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

// ── Listener ──────────────────────────────────────────────────────────────────
function startListener(wk) {
  if (unsub) unsub()
  loading.value = true
  unsub = subscribeToWeeklyTracker(wk, (snap) => {
    entry.value   = snap.exists() ? snap.data() : {}
    loading.value = false
  })
}

watch(weekKey, (wk) => {
  startListener(wk)
  addOpen.value    = null
  editingRichId.value = null
}, { immediate: true })

onUnmounted(() => { if (unsub) unsub() })

// ── Helpers ───────────────────────────────────────────────────────────────────
function sectionItems(key) {
  return entry.value[key] || []
}

function uid() {
  return Math.random().toString(36).slice(2)
}

function projectById(id) {
  return projectsStore.projects.find(p => p.id === id)
}

function projectName(id) {
  return projectById(id)?.name || id
}

function projectPhase(id) {
  const p = projectById(id)
  if (!p?.currentPhase) return ''
  const ph = phasesStore.phaseConfig.find(ph => ph.id === p.currentPhase)
  return ph?.name || p.currentPhase
}

function projectSiteStatus(id) {
  return projectById(id)?.siteStatus || ''
}

function siteStatusColor(status) {
  if (status === 'live')      return '#10b981'
  if (status === 'on-hold')   return '#f59e0b'
  if (status === 'cancelled') return '#ef4444'
  return 'var(--muted)'
}

// ── Add form ──────────────────────────────────────────────────────────────────
function toggleAdd(key) {
  if (addOpen.value === key) { addOpen.value = null; return }
  addOpen.value  = key
  addForm.value  = { projectId: '', projectSearch: '', text: '', html: '', date: '' }
  showDropdown.value = false
}

// Freeform (New Projects)
function addFreeformItem(sectionKey) {
  if (!addForm.value.text.trim()) return
  const item = { id: uid(), text: addForm.value.text.trim(), createdAt: new Date().toISOString() }
  saveSection(sectionKey, [...sectionItems(sectionKey), item])
  addOpen.value = null
}

// Type-ahead helpers
function selectProject(p, sec) {
  addForm.value.projectId     = p.id
  addForm.value.projectSearch = p.name
  showDropdown.value          = false
  // Pre-populate date from the project document
  if (sec?.dateField) {
    addForm.value.date = p[sec.dateField] || ''
  }
}

function selectFirstProject(sec) {
  if (filteredProjects.value.length) selectProject(filteredProjects.value[0], sec)
}

// Project link (Pending to Ongoing)
function addProjectItem(sectionKey) {
  if (!addForm.value.projectId) return
  const item = { id: uid(), projectId: addForm.value.projectId, createdAt: new Date().toISOString() }
  saveSection(sectionKey, [...sectionItems(sectionKey), item])
  addOpen.value = null
}

// Project + date (Delivery & Previews, Sites Going Live)
async function addProjectDateItem(sec) {
  if (!addForm.value.projectId) return
  const item = {
    id:        uid(),
    projectId: addForm.value.projectId,
    date:      addForm.value.date || '',
    createdAt: new Date().toISOString(),
  }
  saveSection(sec.key, [...sectionItems(sec.key), item])
  addOpen.value = null

  // Write the date back to the project document
  if (item.date && sec.dateField) {
    try {
      await projectsStore.updateProject(item.projectId, { [sec.dateField]: item.date })
    } catch (err) {
      console.error('[WeeklyTracker] project date update failed:', err.code, err.message)
    }
  }
}

// Date change on an existing project-date item
async function onItemDateChange(sec, itemId, newDate) {
  const items = sectionItems(sec.key).map(i =>
    i.id === itemId ? { ...i, date: newDate } : i
  )
  saveSection(sec.key, items)

  // Write back to the project document
  const item = items.find(i => i.id === itemId)
  if (item?.projectId && sec.dateField) {
    try {
      await projectsStore.updateProject(item.projectId, { [sec.dateField]: newDate })
    } catch (err) {
      console.error('[WeeklyTracker] project date update failed:', err.code, err.message)
    }
  }
}

// Rich text (Urgent Requests, Blockers & Issues)
function addRichItem(sectionKey) {
  if (!addForm.value.html) return
  const item = { id: uid(), html: addForm.value.html, createdAt: new Date().toISOString() }
  saveSection(sectionKey, [...sectionItems(sectionKey), item])
  addOpen.value = null
}

function editRich(sectionKey, item) {
  editingRichId.value   = `${sectionKey}:${item.id}`
  editingRichHtml.value = item.html || ''
}

async function saveRichItem(sectionKey, itemId) {
  const items = sectionItems(sectionKey).map(i =>
    i.id === itemId ? { ...i, html: editingRichHtml.value } : i
  )
  saveSection(sectionKey, items)
  editingRichId.value = null
}

// Remove
function removeItem(sectionKey, id) {
  saveSection(sectionKey, sectionItems(sectionKey).filter(i => i.id !== id))
}

// ── "Add to Projects" (New Projects freeform column) ─────────────────────────
async function addToProjects(item, sectionKey) {
  if (creatingProjectFor.value) return
  creatingProjectFor.value = item.id
  try {
    const now   = new Date().toISOString()
    const today = now.slice(0, 10)

    // Build minimal phase data using defaults
    const phaseData = {}
    for (const ph of phasesStore.phaseConfig) {
      if (ph.id === 'languages') continue
      phaseData[ph.id] = emptyPhaseEntry()
      if (ph.subPhases?.length) {
        phaseData[ph.id].subPhases = {}
        for (const sp of ph.subPhases) {
          phaseData[ph.id].subPhases[sp.id] = emptyPhaseEntry()
        }
      }
    }
    // Mark kickstart as active
    if (phaseData.kickstart) phaseData.kickstart.status = 'active'

    const docData = {
      name:                  item.text.trim(),
      url:                   '',
      originalSite:          '',
      mainLanguage:          'NL',
      additionalLanguages:   [],
      platform:              'WordPress',
      projectType:           'new_site',
      kickstartDate:         today,
      liveDate:              '',
      siteStatus:            'development',
      currentPhase:          'kickstart',
      currentSubPhase:       null,
      activePhases:          [{ phase: 'kickstart', subPhase: null }],
      phaseData,
      leadDeveloperId:       null,
      developersInvolvedIds: [],
      webServicesAssigneeId: null,
      multimediaAssigneeId:  null,
      qaAssigneeId:          null,
      assignedMembers:       [],
      developer:             '',
      notes:                 '',
      checklists:            {},
      links:                 [],
      langStatus:            {},
      phaseHistory:          [],
      onHoldSince:           null,
      onHoldReason:          '',
      cancelledAt:           null,
      cancelledReason:       '',
      archived:              false,
      shareToken:            null,
      templateId:            null,
      createdBy:             authStore.currentUser?.name || '',
      createdAt:             now,
      updatedAt:             now,
    }

    const created = await projectsStore.createProject(docData)

    // Update the tracker item: link it to the new project
    const items = sectionItems(sectionKey).map(i =>
      i.id === item.id ? { ...i, projectId: created.id } : i
    )
    await saveSection(sectionKey, items)
  } catch (err) {
    console.error('[WeeklyTracker] addToProjects failed:', err)
  } finally {
    creatingProjectFor.value = null
  }
}

// ── "Carry over from last week" ───────────────────────────────────────────────
let _carryMsgTimer = null

async function carryOverFromLastWeek() {
  if (carryOverLoading.value) return
  carryOverLoading.value = true
  carryOverMsg.value = ''

  try {
    const prevData = await getWeeklyTrackerDoc(prevWeekKey.value)

    if (!prevData) {
      carryOverMsg.value = 'No items in the previous week'
      return
    }

    const hasPrevItems = SECTIONS.some(sec => (prevData[sec.key] || []).length > 0)
    if (!hasPrevItems) {
      carryOverMsg.value = 'No items in the previous week'
      return
    }

    const current = { ...entry.value }
    let copiedCount = 0

    for (const sec of SECTIONS) {
      const prevItems    = prevData[sec.key] || []
      if (!prevItems.length) continue

      const currentItems = current[sec.key] || []

      // Collect source IDs that were already carried into this week
      const alreadyCarried = new Set(
        currentItems
          .filter(i => i.sourceItemId)
          .map(i => i.sourceItemId)
      )

      const newItems = prevItems
        .filter(i => !alreadyCarried.has(i.id))
        .map(i => ({
          ...i,
          id:           uid(),                       // fresh ID for this week's copy
          sourceItemId: i.id,                        // tracks origin for dedup
          createdAt:    new Date().toISOString(),
        }))

      if (newItems.length > 0) {
        current[sec.key] = [...currentItems, ...newItems]
        copiedCount += newItems.length
      }
    }

    if (copiedCount === 0) {
      carryOverMsg.value = 'All items were already carried over'
      return
    }

    entry.value = current
    await saveWeeklyTrackerDoc(weekKey.value, current)
    carryOverMsg.value = `Carried over ${copiedCount} item${copiedCount !== 1 ? 's' : ''}`
  } catch (err) {
    console.error('[WeeklyTracker] carryOver failed:', err)
    carryOverMsg.value = 'Failed to carry over items'
  } finally {
    carryOverLoading.value = false
    clearTimeout(_carryMsgTimer)
    _carryMsgTimer = setTimeout(() => { carryOverMsg.value = '' }, 4000)
  }
}

// ── Drag-and-drop (freeform column) ──────────────────────────────────────────
function onDragStart(sectionKey, itemId, evt) {
  _dragSectionKey         = sectionKey
  _dragItemId             = itemId
  evt.dataTransfer.effectAllowed = 'move'
}

function onDrop(sectionKey, targetId) {
  dragOverId.value = null
  if (_dragSectionKey !== sectionKey || !_dragItemId || _dragItemId === targetId) return
  const items   = sectionItems(sectionKey).slice()
  const fromIdx = items.findIndex(i => i.id === _dragItemId)
  const toIdx   = items.findIndex(i => i.id === targetId)
  if (fromIdx === -1 || toIdx === -1) return
  items.splice(toIdx, 0, items.splice(fromIdx, 1)[0])
  saveSection(sectionKey, items)
  _dragItemId = null
}

// ── Firestore write ───────────────────────────────────────────────────────────
async function saveSection(sectionKey, items) {
  const updated = { ...entry.value, [sectionKey]: items }
  entry.value = updated
  try {
    await saveWeeklyTrackerDoc(weekKey.value, updated)
  } catch (err) {
    console.error('[WeeklyTracker] save failed:', err.code, err.message)
  }
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
  display: flex;
  flex-direction: column;
  gap: 0;
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

/* Generic item row */
.wk-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.wk-item:last-of-type { border-bottom: none; }

/* Draggable freeform items */
.wk-draggable { cursor: grab; }
.wk-draggable:active { cursor: grabbing; }
.wk-drag-over {
  background: var(--bg);
  border-radius: 4px;
  outline: 2px dashed var(--primary);
  outline-offset: -2px;
}
.drag-handle {
  color: var(--muted);
  font-size: 14px;
  flex-shrink: 0;
  user-select: none;
  padding-top: 1px;
}

.wk-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 8px 0;
}

.wk-add-form {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

/* Type-ahead project search */
.wk-project-search { position: relative; }
.wk-dropdown {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
}
.wk-dropdown-item {
  padding: 7px 10px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text);
}
.wk-dropdown-item:hover { background: var(--bg); }

/* Rich text blocks */
.wk-richtext-block {
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.wk-richtext-block:last-of-type { border-bottom: none; }

.wk-html-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
}
.wk-html-content :deep(p)           { margin: 0 0 4px; }
.wk-html-content :deep(p:last-child){ margin-bottom: 0; }
.wk-html-content :deep(ul),
.wk-html-content :deep(ol)          { margin: 4px 0; padding-left: 20px; }
.wk-html-content :deep(li)          { margin: 2px 0; }
.wk-html-content :deep(strong)      { font-weight: 700; }
.wk-html-content :deep(em)          { font-style: italic; }
.wk-html-content :deep(s)           { text-decoration: line-through; }

.wk-richtext-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
</style>
