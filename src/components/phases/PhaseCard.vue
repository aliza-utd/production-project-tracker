<template>
  <div
    :id="'ph-card-' + phaseId"
    class="ph-card"
    :class="{
      'ph-card-blocked': currentStatus === 'blocked',
      'ph-card-done':    currentStatus === 'done',
    }"
    :style="{ borderLeft: '4px solid ' + (currentStatus === 'blocked' ? '#d97706' : phaseDef.color) }"
  >
    <!-- ── Card header ── -->
    <div class="ph-card-hdr" @click="isCollapsed = !isCollapsed">
      <!-- ✓ Done toggle -->
      <button v-if="!effectiveReadonly" class="ph-done-toggle"
        :class="{ active: currentStatus === 'done' }"
        @click.stop="toggleDone"
        :title="currentStatus === 'done' ? 'Set Active' : 'Mark Done'">✓</button>
      <div class="ph-card-dot" :style="{ background: phaseDef.color }"></div>
      <div class="ph-card-name">{{ phaseDef.name }}</div>

      <!-- Assignee avatar (non-interactive) -->
      <span class="pc-av-wrap" style="flex-shrink:0" @click.stop>
        <span v-if="assigneeMember" class="pc-av"
          :style="{ background: assigneeMember.avatarColor || '#6366f1' }">
          {{ assigneeMember.initials }}
          <span class="pc-av-tip">{{ assigneeMember.name }}</span>
        </span>
        <span v-else class="pc-av-empty"></span>
      </span>

      <!-- Status dropdown — v-model on statusModel ensures the visible option
           always reflects the store, even after programmatic status changes. -->
      <select
        class="ph-status-sel"
        :class="'ph-st-' + currentStatus"
        :disabled="effectiveReadonly"
        v-model="statusModel"
        @click.stop
      >
        <option value="not-started">Not Started</option>
        <option value="active">Active</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
      </select>

      <span v-if="totalHours > 0" class="ph-hours-badge">{{ fmtHours(totalHours) }}</span>
      <SaveIndicator v-model:state="saveState" />
      <span v-if="readonly || locked" class="pc-locked-chip" style="margin-left:4px">🔒</span>
      <span class="ph-arrow" :class="{ open: !isCollapsed }">▶</span>
    </div>

    <!-- ── Card body ── -->
    <div v-if="!isCollapsed" class="ph-card-body">

      <!-- Time Log (first) -->
      <div class="form-group" style="margin-bottom:14px">
        <div class="ph-section-lbl">Time Log</div>
        <TimeLogSection
          :timeLogs="localPhase.timeLogs || []"
          :subPhaseTotals="subPhaseTotals"
          :phaseName="phaseDef.name"
          :readonly="readonly"
          @add-log="addTimeLog"
          @delete-log="deleteTimeLog"
        />
      </div>

      <!-- Assignee picker -->
      <div class="form-group" style="position:relative;margin-bottom:14px">
        <label class="form-label">Assigned to</label>
        <div v-if="!effectiveReadonly">
          <button class="ph-assignee-btn" @click="assigneeOpen = !assigneeOpen" @blur="onAssigneeBlur">
            <template v-if="assigneeMember">
              <span class="pc-av" style="width:20px;height:20px;font-size:8px"
                :style="{ background: assigneeMember.avatarColor || '#6366f1' }">
                {{ assigneeMember.initials }}
              </span>
              <span>{{ assigneeMember.name }}</span>
              <span style="margin-left:6px;opacity:.5;font-weight:400" @click.stop="setAssignee(null)">×</span>
            </template>
            <span v-else style="color:var(--muted);font-weight:400">— Unassigned</span>
            <span style="margin-left:auto;opacity:.5">▾</span>
          </button>
          <div v-if="assigneeOpen" class="np-dropdown" style="top:calc(100% + 2px)">
            <div v-for="m in activeMembers" :key="m.id" class="np-dropdown-item"
              @mousedown.prevent="setAssignee(m.id)">
              <span class="avatar avatar-xs" :style="{ background: m.avatarColor || '#6366f1' }">{{ m.initials }}</span>
              {{ m.name }}
            </div>
          </div>
        </div>
        <div v-else class="il-value">{{ assigneeMember ? assigneeMember.name : '—' }}</div>
      </div>

      <!-- Dates -->
      <div v-if="currentStatus !== 'not-started'" class="ph-dates-row" style="margin-bottom:14px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Date Started</label>
          <input type="date" class="form-input" :readonly="effectiveReadonly"
            :value="isoToDateInput(localPhase.dateStarted)"
            @input="!effectiveReadonly && setDate('dateStarted', $event.target.value)"
            @blur="!effectiveReadonly && debounceSave()" />
        </div>
        <div v-if="currentStatus === 'done'" class="form-group" style="margin-bottom:0">
          <label class="form-label">Date Completed</label>
          <input type="date" class="form-input" :readonly="effectiveReadonly"
            :value="isoToDateInput(localPhase.dateCompleted)"
            @input="!effectiveReadonly && setDate('dateCompleted', $event.target.value)"
            @blur="!effectiveReadonly && debounceSave()" />
        </div>
      </div>

      <!-- Notes -->
      <div class="form-group">
        <div class="ph-section-lbl">Notes</div>
        <textarea class="form-textarea" rows="3" :readonly="effectiveReadonly"
          v-model="localPhase.notes"
          @blur="!effectiveReadonly && debounceSave()"
          :placeholder="'Notes for ' + phaseDef.name + '…'"></textarea>
      </div>

      <!-- Checklist -->
      <div class="form-group">
        <div class="ph-section-lbl">Checklist</div>
        <div v-if="localPhase.checklist && localPhase.checklist.length"
          style="background:#f8fafc;border:1px solid var(--border);border-radius:var(--r);padding:4px 12px;margin-bottom:8px">
          <div v-for="item in localPhase.checklist" :key="item.id" class="checklist-item">
            <input type="checkbox" v-model="item.done" :disabled="effectiveReadonly" @change="!effectiveReadonly && onChecklistToggle(item)" />
            <span class="checklist-text" :class="{ done: item.done }">{{ item.text }}</span>
            <button v-if="!effectiveReadonly" class="btn-icon" @click="removeChecklistItem(item.id)">🗑️</button>
          </div>
        </div>
        <div v-else style="font-size:13px;color:var(--muted);padding:2px 0 8px">No items yet.</div>
        <div v-if="!effectiveReadonly" class="checklist-add">
          <input class="form-input" placeholder="Add item…"
            v-model="newChecklistText"
            @keyup.enter="addChecklistItem" />
          <button class="btn btn-secondary btn-sm" @click="addChecklistItem">Add</button>
        </div>
      </div>

      <!-- Sub-phase cards -->
      <div v-if="phaseDef.subPhases && phaseDef.subPhases.length" class="ph-sub-cards">
        <SubPhaseCard
          v-for="sp in phaseDef.subPhases"
          :key="sp.id"
          :subPhase="localPhase.subPhases?.[sp.id] || emptyPhaseEntry()"
          :subId="sp.id"
          :subDef="sp"
          :parentPhaseId="phaseId"
          :parentColor="phaseDef.color"
          :teamMembers="teamMembers"
          :readonly="readonly"
          :locked="locked"
          @update-sub="onUpdateSub"
          @hours-updated="() => {}"
        />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore } from '@/stores/phases'
import { useAuthStore } from '@/stores/auth'
import { useActivityLog } from '@/composables/useActivityLog'
import SubPhaseCard from '@/components/phases/SubPhaseCard.vue'
import TimeLogSection from '@/components/phases/TimeLogSection.vue'
import SaveIndicator from '@/components/shared/SaveIndicator.vue'

const props = defineProps({
  phase:               { type: Object, default: () => ({}) },
  phaseId:             { type: String, required: true },
  phaseDef:            { type: Object, required: true },   // { id, name, color, bg, subPhases }
  projectId:           { type: String, required: true },
  teamMembers:         { type: Array,  default: () => [] },
  readonly:            { type: Boolean, default: false },
  locked:              { type: Boolean, default: false },  // like readonly but time log stays enabled
  expandedPhaseConfig: { type: Array,  default: null },   // language-expanded config for correct sub-phase IDs
})
const emit = defineEmits(['update-phase', 'activation-complete', 'next-phase-started', 'phase-toast'])

const { uid, isoToDateInput, fmtHours, deepCopy, applyStatus, emptyPhaseEntry, computeActivePhases } = usePhaseLogic()

// locked = like readonly but time log stays enabled (used when site is live with pending languages)
const effectiveReadonly = computed(() => props.readonly || props.locked)
const projectsStore    = useProjectsStore()
const phasesStore      = usePhasesStore()
const authStore        = useAuthStore()
const { logActivity }  = useActivityLog()

const localPhase = ref(deepCopy(props.phase))

// ── Store-derived status (single source of truth for display) ─────────────
// The select and all status-based classes/styles read from here so they
// stay in sync after every save, including saves triggered by other views.
const currentStatus = computed(() =>
  projectsStore.projects.find(p => p.id === props.projectId)
    ?.phaseData?.[props.phaseId]?.status || 'not-started'
)

// Writable computed lets v-model on the select call onStatusChange directly.
const statusModel = computed({
  get: () => currentStatus.value,
  set: (val) => onStatusChange(val),
})

// Keep localPhase.status in sync when the store updates (e.g. another view
// saves, or a parent phase auto-completes this one).
watch(currentStatus, (newStatus) => {
  localPhase.value.status = newStatus
})

const isCollapsed      = ref(props.readonly || ['not-started', 'done'].includes(localPhase.value.status))
const assigneeOpen     = ref(false)
const newChecklistText = ref('')
const saveState        = ref('idle')

const activeMembers  = computed(() => props.teamMembers.filter(m => m.active))
const assigneeMember = computed(() =>
  localPhase.value.assignedTo
    ? (props.teamMembers.find(m => m.id === localPhase.value.assignedTo) || null)
    : null
)

const subPhaseTotals = computed(() => {
  const result = {}
  for (const sp of (props.phaseDef.subPhases || [])) {
    const hrs = (localPhase.value.subPhases?.[sp.id]?.timeLogs || [])
      .reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
    if (hrs > 0) result[sp.name] = hrs
  }
  return result
})

const totalHours = computed(() => {
  const direct = (localPhase.value.timeLogs || []).reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
  const subTotal = Object.values(subPhaseTotals.value).reduce((s, h) => s + h, 0)
  return direct + subTotal
})

// ── Autosave ──────────────────────────────────────────────────────────────
async function autosave(autoStartNext = false) {
  if (!props.projectId) return
  saveState.value = 'saving'
  try {
    const project = projectsStore.projects.find(p => p.id === props.projectId)
    if (!project) throw new Error('Project not found')

    const newPhaseData = deepCopy(project.phaseData || {})
    newPhaseData[props.phaseId] = deepCopy(localPhase.value)

    // ── Auto-start next phase when this phase is marked done ─────────────
    // expandedPhaseConfig is the per-project config (Languages injected when
    // additionalLanguages is non-empty, omitted when empty). This ensures the
    // "last phase" check is correct regardless of manager-defined phase order.
    let nextPhaseName  = null
    let activatedNext  = false
    if (autoStartNext) {
      const configSource = props.expandedPhaseConfig || phasesStore.phaseConfig
      const order = configSource.map(p => p.id)
      const idx   = order.indexOf(props.phaseId)
      if (idx >= 0 && idx < order.length - 1) {
        const nextId  = order[idx + 1]
        const nextDef = configSource.find(p => p.id === nextId)
        if (!newPhaseData[nextId]) newPhaseData[nextId] = emptyPhaseEntry()
        const nxt = newPhaseData[nextId]
        if (!nxt.status || nxt.status === 'not-started') {
          applyStatus(nxt, 'active')
          if (nextDef?.subPhases?.length) {
            if (!nxt.subPhases) nxt.subPhases = {}
            const mode = nextDef.subPhaseMode || 'simultaneous'
            for (const sp of nextDef.subPhases) {
              if (!nxt.subPhases[sp.id]) nxt.subPhases[sp.id] = emptyPhaseEntry()
            }
            if (mode === 'sequential') {
              const first = nextDef.subPhases.find(sp =>
                (nxt.subPhases[sp.id]?.status || 'not-started') === 'not-started'
              )
              if (first) applyStatus(nxt.subPhases[first.id], 'active')
            } else {
              for (const sp of nextDef.subPhases) {
                if ((nxt.subPhases[sp.id]?.status || 'not-started') === 'not-started') {
                  applyStatus(nxt.subPhases[sp.id], 'active')
                }
              }
            }
          }
          nextPhaseName = nextDef?.name
          activatedNext = true
        }
      }
    }

    const { activePhases, currentPhase, currentSubPhase } =
      computeActivePhases(newPhaseData, phasesStore.phaseConfig)

    await projectsStore.updateProject(props.projectId, {
      phaseData:       newPhaseData,
      activePhases,
      currentPhase:    currentPhase    || project.currentPhase    || null,
      currentSubPhase: currentSubPhase || project.currentSubPhase || null,
      updatedAt:       new Date().toISOString(),
    })

    saveState.value = 'saved'
    emit('update-phase', { phaseId: props.phaseId, data: deepCopy(localPhase.value) })
    if (nextPhaseName) emit('next-phase-started', nextPhaseName)
    // No next phase → this was the last phase → trigger the live prompt
    if (autoStartNext && !activatedNext) emit('activation-complete')
  } catch (err) {
    console.error('[PhaseCard autosave] FAILED:', err.code, err.message)
    saveState.value = 'error'
  }
}

let _debounceTimer = null
function debounceSave() {
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => autosave(), 1500)
}

// ── Status ────────────────────────────────────────────────────────────────
function onStatusChange(status) {
  const oldStatus = localPhase.value.status || 'not-started'
  applyStatus(localPhase.value, status)
  if (status === 'active' || status === 'blocked') isCollapsed.value = false

  // Propagate status change to sub-phases based on mode
  const subDefs = props.phaseDef.subPhases || []
  const mode    = props.phaseDef.subPhaseMode || 'simultaneous'

  if (subDefs.length > 0) {
    if (!localPhase.value.subPhases) localPhase.value.subPhases = {}

    if (status === 'done') {
      // Always mark all sub-phases done when parent is manually set to done
      for (const sp of subDefs) {
        if (!localPhase.value.subPhases[sp.id]) localPhase.value.subPhases[sp.id] = emptyPhaseEntry()
        if (localPhase.value.subPhases[sp.id].status !== 'done') {
          applyStatus(localPhase.value.subPhases[sp.id], 'done')
        }
      }
    } else if (status === 'active') {
      if (mode === 'simultaneous') {
        for (const sp of subDefs) {
          if (!localPhase.value.subPhases[sp.id]) localPhase.value.subPhases[sp.id] = emptyPhaseEntry()
          if ((localPhase.value.subPhases[sp.id].status || 'not-started') === 'not-started') {
            applyStatus(localPhase.value.subPhases[sp.id], 'active')
          }
        }
        emit('phase-toast', `All ${props.phaseDef.name} sub-phases are now Active`)
      } else {
        // sequential: only the first not-yet-started sub-phase
        const firstPending = subDefs.find(sp =>
          (localPhase.value.subPhases[sp.id]?.status || 'not-started') === 'not-started'
        )
        if (firstPending) {
          if (!localPhase.value.subPhases[firstPending.id]) localPhase.value.subPhases[firstPending.id] = emptyPhaseEntry()
          applyStatus(localPhase.value.subPhases[firstPending.id], 'active')
          emit('phase-toast', `${firstPending.name} is now Active`)
        }
      }
    }
  }

  if (oldStatus !== status) {
    logActivity(props.projectId, 'phase_status_changed', { phase: props.phaseDef.name, from: oldStatus, to: status }).catch(() => {})
  }
  autosave(status === 'done')
}

function toggleDone() {
  onStatusChange(currentStatus.value === 'done' ? 'active' : 'done')
}

// ── Dates ─────────────────────────────────────────────────────────────────
function setDate(field, val) {
  localPhase.value[field] = val ? new Date(val + 'T00:00:00').toISOString() : null
}

// ── Assignee ──────────────────────────────────────────────────────────────
function setAssignee(id) {
  const newName = id ? (props.teamMembers.find(m => m.id === id)?.name || id) : 'Unassigned'
  localPhase.value.assignedTo = id || null
  assigneeOpen.value = false
  logActivity(props.projectId, 'phase_assigned', { phase: props.phaseDef.name, assignedTo: newName }).catch(() => {})
  autosave()
}
function onAssigneeBlur() {
  setTimeout(() => { assigneeOpen.value = false }, 150)
}

// ── Checklist ─────────────────────────────────────────────────────────────
function addChecklistItem() {
  const text = newChecklistText.value.trim()
  if (!text) return
  if (!localPhase.value.checklist) localPhase.value.checklist = []
  localPhase.value.checklist.push({ id: uid(), text, done: false })
  newChecklistText.value = ''
  logActivity(props.projectId, 'checklist_updated', { phase: props.phaseDef.name, item: text, action: 'added' }).catch(() => {})
  autosave()
}
function removeChecklistItem(itemId) {
  const item = (localPhase.value.checklist || []).find(i => i.id === itemId)
  localPhase.value.checklist = (localPhase.value.checklist || []).filter(i => i.id !== itemId)
  if (item) logActivity(props.projectId, 'checklist_updated', { phase: props.phaseDef.name, item: item.text, action: 'deleted' }).catch(() => {})
  autosave()
}
function onChecklistToggle(item) {
  logActivity(props.projectId, 'checklist_updated', { phase: props.phaseDef.name, item: item.text, action: item.done ? 'checked' : 'unchecked' }).catch(() => {})
  autosave()
}

// ── Time Log ──────────────────────────────────────────────────────────────
function addTimeLog(logData) {
  if (!localPhase.value.timeLogs) localPhase.value.timeLogs = []
  localPhase.value.timeLogs.push({
    id: uid(),
    ...logData,
    loggedBy: {
      uid:  authStore.currentUser?.uid  || '',
      name: authStore.currentUser?.name || '',
    },
  })
  logActivity(props.projectId, 'time_logged', { phase: props.phaseDef.name, hours: logData.hours, description: logData.description || '', action: 'added' }).catch(() => {})
  autosave()
}
function deleteTimeLog(logId) {
  const log = (localPhase.value.timeLogs || []).find(l => l.id === logId)
  localPhase.value.timeLogs = (localPhase.value.timeLogs || []).filter(l => l.id !== logId)
  if (log) logActivity(props.projectId, 'time_logged', { phase: props.phaseDef.name, hours: log.hours, description: '', action: 'deleted' }).catch(() => {})
  autosave()
}

// ── Sub-phase updates ─────────────────────────────────────────────────────
function onUpdateSub({ subId, data }) {
  if (!localPhase.value.subPhases) localPhase.value.subPhases = {}
  localPhase.value.subPhases[subId] = data

  // Auto-activate parent when any sub-phase becomes active
  if (data.status === 'active' && localPhase.value.status === 'not-started') {
    applyStatus(localPhase.value, 'active')
    isCollapsed.value = false
  }

  const subDefs = props.phaseDef.subPhases || []
  const mode    = props.phaseDef.subPhaseMode || 'simultaneous'
  const subIds  = subDefs.map(sp => sp.id)

  if (subIds.length > 0) {
    const allDone = subIds.every(id =>
      (localPhase.value.subPhases?.[id]?.status || 'not-started') === 'done'
    )
    const anyActive = subIds.some(id =>
      (localPhase.value.subPhases?.[id]?.status || 'not-started') === 'active'
    )

    if (allDone && localPhase.value.status !== 'done') {
      applyStatus(localPhase.value, 'done')
      autosave(true)  // auto-start next phase (or emit activation-complete if last)
      return
    }

    // Sequential mode: activate the next pending sub-phase when current one finishes
    if (mode === 'sequential' && data.status === 'done' && !allDone) {
      const doneIdx = subDefs.findIndex(sp => sp.id === subId)
      const nextDef = subDefs[doneIdx + 1]
      if (nextDef && (localPhase.value.subPhases?.[nextDef.id]?.status || 'not-started') === 'not-started') {
        if (!localPhase.value.subPhases[nextDef.id]) localPhase.value.subPhases[nextDef.id] = emptyPhaseEntry()
        applyStatus(localPhase.value.subPhases[nextDef.id], 'active')
        emit('phase-toast', `${nextDef.name} is now Active`)
      }
    }

    if (!allDone && anyActive && localPhase.value.status === 'not-started') {
      applyStatus(localPhase.value, 'active')
      isCollapsed.value = false
    } else if (!allDone && localPhase.value.status === 'done') {
      applyStatus(localPhase.value, 'active')
    }
  }

  autosave()
}
</script>
