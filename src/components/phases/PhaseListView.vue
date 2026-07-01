<template>
  <div class="ph-list-wrap">
    <div v-if="readonly" class="ph-list-lock-banner">
      🔒 {{ siteStatus === 'live' ? 'Site is live. Phase history is read-only.' : 'Project is on-hold. Phases are locked.' }}
    </div>

    <table class="ph-list-table">
      <thead>
        <tr>
          <th>Phase</th>
          <th>Assigned</th>
          <th>Status</th>
          <th>Started</th>
          <th>Completed</th>
          <th>Hours</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="ph in phaseConfig" :key="ph.id">
          <!-- Main phase row -->
          <tr
            class="ph-list-row"
            :class="{
              'ph-list-row-active':  rowOpen[ph.id],
              'ph-list-row-blocked': phStatus(ph.id) === 'blocked',
              'ph-list-row-done':    phStatus(ph.id) === 'done',
            }"
            @click="toggleRow(ph.id)"
          >
            <td>
              <div class="ph-list-name-cell">
                <span class="ph-list-dot" :style="{ background: ph.color }"></span>
                <span class="ph-list-name">{{ ph.name }}</span>
                <span v-if="ph.subPhases && ph.subPhases.length"
                  style="font-size:10px;color:var(--muted)">+{{ ph.subPhases.length }}</span>
              </div>
            </td>
            <td @click.stop>
              <select v-if="!phReadonly(ph.id)" class="ph-list-sel"
                :value="local[ph.id]?.assignedTo || ''"
                @change="setAssignee(ph.id, null, $event.target.value || null)">
                <option value="">—</option>
                <option v-for="m in activeMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
              </select>
              <span v-else class="ph-list-assigned-name">{{ assigneeName(ph.id, null) }}</span>
            </td>
            <td @click.stop>
              <select class="ph-list-sel ph-list-status-sel"
                :class="'ph-st-' + phStatus(ph.id)"
                :disabled="phReadonly(ph.id)"
                :value="phStatus(ph.id)"
                @change="setStatus(ph.id, null, $event.target.value)">
                <option v-for="st in statusesStore.statuses" :key="st.id" :value="st.id">{{ st.name }}</option>
              </select>
            </td>
            <td style="font-size:12px;color:var(--muted);white-space:nowrap">
              {{ isoToDateInput(local[ph.id]?.dateStarted) || '—' }}
            </td>
            <td style="font-size:12px;color:var(--muted);white-space:nowrap">
              {{ isoToDateInput(local[ph.id]?.dateCompleted) || '—' }}
            </td>
            <td style="white-space:nowrap">
              <span v-if="phHoursTotal(ph.id) > 0" class="ph-hours-badge">
                {{ fmtHours(phHoursTotal(ph.id)) }}
              </span>
              <span v-else style="color:var(--muted);font-size:12px">—</span>
            </td>
            <td style="max-width:180px">
              <span v-if="local[ph.id]?.notes"
                style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:180px">
                {{ local[ph.id].notes }}
              </span>
              <span v-else style="color:#cbd5e1;font-size:12px">—</span>
            </td>
          </tr>

          <!-- Expanded content for main phase -->
          <tr v-if="rowOpen[ph.id]" class="ph-list-expanded-row" @click.stop>
            <td colspan="7">
              <div class="ph-list-expanded-body">
                <div class="ph-list-exp-card">
                  <div class="ph-list-exp-grid">
                    <div class="ph-list-exp-col">
                      <div class="ph-section-lbl">Notes</div>
                      <textarea class="form-textarea" rows="3" :readonly="phReadonly(ph.id)"
                        :value="local[ph.id]?.notes || ''"
                        @input="!phReadonly(ph.id) && setNotes(ph.id, null, $event.target.value)"
                        @blur="!phReadonly(ph.id) && debounceAutosave(ph.id)"
                        :placeholder="'Notes for ' + ph.name + '…'"></textarea>
                    </div>
                    <div v-if="projectChecklists[ph.id]?.length || !phReadonly(ph.id)" class="ph-list-exp-col">
                      <div class="ph-section-lbl">Task Checklist</div>
                      <div class="cl-items">
                        <div v-for="item in projectChecklists[ph.id]" :key="item.itemId" class="cl-item">
                          <span class="cl-item-name">{{ item.name }}</span>
                          <select
                            class="ph-status-sel ph-status-sel-sm cl-status-sel"
                            :class="'ph-st-' + item.status"
                            :disabled="phReadonly(ph.id)"
                            :value="item.status"
                            @change="!phReadonly(ph.id) && onClItemChange(ph.id, item.itemId, $event.target.value)"
                          >
                            <option v-for="st in statusesStore.statuses" :key="st.id" :value="st.id">{{ st.name }}</option>
                          </select>
                        </div>
                      </div>
                      <div v-if="!phReadonly(ph.id)" class="checklist-add" style="margin-top:6px">
                        <input class="form-input" placeholder="Add item…"
                          v-model="listNewItemText[ph.id]"
                          @keyup.enter="addClItem(ph.id)" />
                        <button class="btn btn-secondary btn-sm" @click="addClItem(ph.id)">Add</button>
                      </div>
                    </div>
                  </div>

                  <!-- Time Log -->
                  <div class="ph-list-exp-timelog">
                    <div class="ph-section-lbl">Time Log</div>
                    <TimeLogSection
                      :timeLogs="local[ph.id]?.timeLogs || []"
                      :phaseName="ph.name"
                      :readonly="phReadonly(ph.id)"
                      @add-log="(d) => addTimeLog(ph.id, null, d)"
                      @delete-log="(id) => deleteTimeLog(ph.id, null, id)"
                    />
                  </div>
                </div>
              </div>
            </td>
          </tr>

          <!-- Sub-phase rows -->
          <template v-if="ph.subPhases && ph.subPhases.length">
            <template v-for="sp in ph.subPhases" :key="ph.id + '_sp_' + sp.id">
              <tr
                class="ph-list-row"
                :class="{
                  'ph-list-row-active':  rowOpen[ph.id + '_sp_' + sp.id],
                  'ph-list-row-blocked': spStatus(ph.id, sp.id) === 'blocked',
                  'ph-list-row-done':    spStatus(ph.id, sp.id) === 'done',
                }"
                @click="toggleRow(ph.id + '_sp_' + sp.id)"
              >
                <td>
                  <div class="ph-list-name-cell">
                    <span class="ph-list-sub-corner">└</span>
                    <span class="ph-list-dot ph-list-dot-sm" :style="{ background: ph.color }"></span>
                    <span class="ph-list-name ph-list-name-sub">{{ sp.name }}</span>
                  </div>
                </td>
                <td @click.stop>
                  <select v-if="!readonly" class="ph-list-sel"
                    :value="local[ph.id]?.subPhases?.[sp.id]?.assignedTo || ''"
                    @change="setAssignee(ph.id, sp.id, $event.target.value || null)">
                    <option value="">—</option>
                    <option v-for="m in activeMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                  <span v-else class="ph-list-assigned-name">{{ assigneeName(ph.id, sp.id) }}</span>
                </td>
                <td @click.stop>
                  <select class="ph-list-sel ph-list-status-sel"
                    :class="'ph-st-' + spStatus(ph.id, sp.id)"
                    :disabled="readonly"
                    :value="spStatus(ph.id, sp.id)"
                    @change="setStatus(ph.id, sp.id, $event.target.value)">
                    <option v-for="st in statusesStore.statuses" :key="st.id" :value="st.id">{{ st.name }}</option>
                  </select>
                </td>
                <td style="font-size:12px;color:var(--muted);white-space:nowrap">
                  {{ isoToDateInput(local[ph.id]?.subPhases?.[sp.id]?.dateStarted) || '—' }}
                </td>
                <td style="font-size:12px;color:var(--muted);white-space:nowrap">
                  {{ isoToDateInput(local[ph.id]?.subPhases?.[sp.id]?.dateCompleted) || '—' }}
                </td>
                <td style="white-space:nowrap">
                  <span v-if="phHours(ph.id, sp.id) > 0" class="ph-hours-badge">
                    {{ fmtHours(phHours(ph.id, sp.id)) }}
                  </span>
                  <span v-else style="color:var(--muted);font-size:12px">—</span>
                </td>
                <td style="max-width:180px">
                  <span v-if="local[ph.id]?.subPhases?.[sp.id]?.notes"
                    style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;max-width:180px">
                    {{ local[ph.id].subPhases[sp.id].notes }}
                  </span>
                  <span v-else style="color:#cbd5e1;font-size:12px">—</span>
                </td>
              </tr>

              <!-- Expanded content for sub-phase -->
              <tr v-if="rowOpen[ph.id + '_sp_' + sp.id]" class="ph-list-expanded-row" @click.stop>
                <td colspan="7">
                  <div class="ph-list-expanded-body">
                    <div class="ph-list-exp-card">
                      <div class="ph-list-exp-grid">
                        <div class="ph-list-exp-col">
                          <div class="ph-section-lbl">Notes</div>
                          <textarea class="form-textarea" rows="3" :readonly="readonly"
                            :value="local[ph.id]?.subPhases?.[sp.id]?.notes || ''"
                            @input="!readonly && setNotes(ph.id, sp.id, $event.target.value)"
                            @blur="!readonly && debounceAutosave(ph.id)"
                            :placeholder="sp.name + ' notes…'"></textarea>
                        </div>
                        <div v-if="projectChecklists[sp.id]?.length || !readonly" class="ph-list-exp-col">
                          <div class="ph-section-lbl">Task Checklist</div>
                          <div class="cl-items">
                            <div v-for="item in projectChecklists[sp.id]" :key="item.itemId" class="cl-item">
                              <span class="cl-item-name">{{ item.name }}</span>
                              <select
                                class="ph-status-sel ph-status-sel-sm cl-status-sel"
                                :class="'ph-st-' + item.status"
                                :disabled="readonly"
                                :value="item.status"
                                @change="!readonly && onClItemChange(sp.id, item.itemId, $event.target.value)"
                              >
                                <option v-for="st in statusesStore.statuses" :key="st.id" :value="st.id">{{ st.name }}</option>
                              </select>
                            </div>
                          </div>
                          <div v-if="!readonly" class="checklist-add" style="margin-top:6px">
                            <input class="form-input" placeholder="Add item…"
                              v-model="listNewItemText[sp.id]"
                              @keyup.enter="addClItem(sp.id)" />
                            <button class="btn btn-secondary btn-sm" @click="addClItem(sp.id)">Add</button>
                          </div>
                        </div>
                      </div>
                      <div class="ph-list-exp-timelog">
                        <div class="ph-section-lbl">Time Log</div>
                        <TimeLogSection
                          :timeLogs="local[ph.id]?.subPhases?.[sp.id]?.timeLogs || []"
                          :phaseName="sp.name"
                          :readonly="readonly"
                          @add-log="(d) => addTimeLog(ph.id, sp.id, d)"
                          @delete-log="(id) => deleteTimeLog(ph.id, sp.id, id)"
                        />
                      </div>
                      <div v-if="!readonly"
                        style="display:flex;justify-content:flex-end;padding:10px 16px;border-top:1px solid var(--border)">
                        <button class="btn btn-primary btn-sm" @click="autosave(ph.id)">Save</button>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { useProjectsStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'
import { useActivityLog } from '@/composables/useActivityLog'
import { useProjectNotifications } from '@/composables/useProjectNotifications'
import { useStatusesStore } from '@/stores/statuses'
import TimeLogSection from '@/components/phases/TimeLogSection.vue'

const props = defineProps({
  phaseData:   { type: Object, default: () => ({}) },
  phaseConfig: { type: Array,  default: () => [] },
  teamMembers: { type: Array,  default: () => [] },
  projectId:   { type: String, required: true },
  siteStatus:  { type: String, default: '' },
  readonly:    { type: Boolean, default: false },
})
const emit = defineEmits(['update-phase', 'next-phase-started', 'activation-complete'])

const { uid, isoToDateInput, fmtHours, deepCopy, applyStatus, emptyPhaseEntry, computeActivePhases, getNextLanguageSubPhase } = usePhaseLogic()
const projectsStore   = useProjectsStore()
const authStore       = useAuthStore()
const statusesStore   = useStatusesStore()
const { logActivity } = useActivityLog()
const { notifyPhaseStatus, notifyPhaseStarted } = useProjectNotifications()

// Local deep copy of full phaseData — kept in sync with prop for real-time updates
const local = ref(deepCopy(props.phaseData))

watch(() => props.phaseData, (v) => { local.value = deepCopy(v) }, { deep: true })

const rowOpen         = reactive({})
const tlOpen          = reactive({})
const listNewItemText = reactive({})

const activeMembers = computed(() => props.teamMembers.filter(m => m.active))

const projectChecklists = computed(() => {
  const project = projectsStore.projects.find(p => p.id === props.projectId)
  return project?.checklists || {}
})

function toggleRow(key) { rowOpen[key] = !rowOpen[key] }
function toggleTl(key)  { tlOpen[key]  = !tlOpen[key] }

// Activation stays editable when the site is Live; all other phases follow readonly prop
function phReadonly(phId) {
  if (props.siteStatus === 'live' && phId === 'activation') return false
  return props.readonly
}

function phStatus(phId)        { return local.value[phId]?.status || 'not-started' }
function spStatus(phId, spId)  { return local.value[phId]?.subPhases?.[spId]?.status || 'not-started' }

function phHours(phId, spId) {
  const logs = spId
    ? local.value[phId]?.subPhases?.[spId]?.timeLogs || []
    : local.value[phId]?.timeLogs || []
  return logs.reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
}
function phHoursTotal(phId) {
  let total = phHours(phId, null)
  const ph  = props.phaseConfig.find(p => p.id === phId)
  if (ph?.subPhases) ph.subPhases.forEach(sp => { total += phHours(phId, sp.id) })
  return total
}

function memberById(id) { return id ? props.teamMembers.find(m => m.id === id) : null }
function assigneeName(phId, spId) {
  const id = spId
    ? local.value[phId]?.subPhases?.[spId]?.assignedTo
    : local.value[phId]?.assignedTo
  return memberById(id)?.name || '—'
}

function getTarget(phId, spId) {
  if (!local.value[phId]) {
    local.value[phId] = emptyPhaseEntry()
  }
  if (spId) {
    if (!local.value[phId].subPhases) local.value[phId].subPhases = {}
    if (!local.value[phId].subPhases[spId]) {
      local.value[phId].subPhases[spId] = emptyPhaseEntry()
    }
    return local.value[phId].subPhases[spId]
  }
  return local.value[phId]
}

function setStatus(phId, spId, status) {
  const target = getTarget(phId, spId)
  const oldStatus = target.status || 'not-started'
  applyStatus(target, status)
  console.log('[PhaseListView] setStatus', phId, spId ? '/ ' + spId : '(main)', '→', status)
  if (statusesStore.isComplete(status)) markListChecklistDone(spId || phId)
  if (statusesStore.isComplete(status) && phId === 'golive' && !spId) emit('activation-complete')
  if (oldStatus !== status) {
    const ph = props.phaseConfig.find(p => p.id === phId)
    const spName = spId ? ph?.subPhases?.find(s => s.id === spId)?.name : null
    const label = spName ? `${ph?.name || phId} / ${spName}` : (ph?.name || phId)
    logActivity(props.projectId, 'phase_status_changed', { phase: label, from: oldStatus, to: status }).catch(() => {})
    const proj = projectsStore.projects.find(p => p.id === props.projectId)
    notifyPhaseStatus({
      projectId: props.projectId,
      projectName: proj?.name || '',
      phaseName: label,
      fromStatus: oldStatus,
      toStatus: status,
      assignedMembers: proj?.assignedMembers || [],
    })

    // Language-aware sequential auto-progression for dynamic (Languages) phases
    if (spId && statusesStore.isComplete(status) && ph?.dynamic && (ph.subPhaseMode || 'simultaneous') === 'sequential') {
      const tmplLen = ph.subPhaseTemplate?.length || 0
      const nextDef = getNextLanguageSubPhase(spId, ph.subPhases || [], tmplLen)
      if (nextDef) {
        const nextTarget = getTarget(phId, nextDef.id)
        if ((nextTarget.status || 'not-started') === 'not-started') {
          applyStatus(nextTarget, 'active')
          const fromLabel = spName?.split(' — ').slice(1).join(' — ') || spName || spId
          logActivity(props.projectId, 'phase_auto_advanced', {
            phase: nextDef.name,
            from:  fromLabel,
            to:    'active',
          }).catch(() => {})
        }
      }
    }
  }
  autosave(phId, !spId && statusesStore.isComplete(status))
}

function setAssignee(phId, spId, memberId) {
  const target = getTarget(phId, spId)
  target.assignedTo = memberId || null
  const ph = props.phaseConfig.find(p => p.id === phId)
  const newName = memberId ? (props.teamMembers.find(m => m.id === memberId)?.name || memberId) : 'Unassigned'
  logActivity(props.projectId, 'phase_assigned', { phase: ph?.name || phId, assignedTo: newName }).catch(() => {})
  autosave(phId)
}

function setNotes(phId, spId, value) {
  const target = getTarget(phId, spId)
  target.notes = value
}

async function onClItemChange(clKey, itemId, newStatus) {
  const items = (projectChecklists.value[clKey] || []).map(i =>
    i.itemId === itemId ? { ...i, status: newStatus } : i
  )
  try {
    await projectsStore.updateProject(props.projectId, { [`checklists.${clKey}`]: items })
    const ph = props.phaseConfig.find(p => p.id === clKey)
    logActivity(props.projectId, 'checklist_updated', {
      phase: ph?.name || clKey, action: 'status_changed', to: newStatus,
    }).catch(() => {})
    // Auto-completion: if all items done, mark the phase/sub-phase done
    if (items.every(i => statusesStore.isComplete(i.status))) {
      const doneId = statusesStore.completeStatusId()
      const isMainPhase = !!props.phaseConfig.find(p => p.id === clKey)
      if (isMainPhase) {
        if (!statusesStore.isComplete(phStatus(clKey))) setStatus(clKey, null, doneId)
      } else {
        const parent = props.phaseConfig.find(p => p.subPhases?.some(s => s.id === clKey))
        if (parent && !statusesStore.isComplete(spStatus(parent.id, clKey))) {
          setStatus(parent.id, clKey, doneId)
        }
      }
    }
  } catch (err) {
    console.error('[PhaseListView] Checklist item update failed:', err)
  }
}

async function addClItem(clKey) {
  const name = (listNewItemText[clKey] || '').trim()
  if (!name) return
  listNewItemText[clKey] = ''
  const existing = projectChecklists.value[clKey] || []
  const items = [...existing, { itemId: uid(), name, status: 'not-started' }]
  try {
    await projectsStore.updateProject(props.projectId, { [`checklists.${clKey}`]: items })
    const ph = props.phaseConfig.find(p => p.id === clKey)
    logActivity(props.projectId, 'checklist_updated', {
      phase: ph?.name || clKey, item: name, action: 'added',
    }).catch(() => {})
  } catch (err) {
    console.error('[PhaseListView] Add checklist item failed:', err)
  }
}

async function markListChecklistDone(clKey) {
  const existing = projectChecklists.value[clKey] || []
  if (!existing.length) return
  console.log('[PhaseListView] markListChecklistDone:', clKey, '—', existing.length, 'items')
  const items = existing.map(i => ({ ...i, status: statusesStore.completeStatusId() }))
  try {
    await projectsStore.updateProject(props.projectId, { [`checklists.${clKey}`]: items })
  } catch (err) {
    console.error('[PhaseListView] Mark checklist done failed:', err)
  }
}

function addTimeLog(phId, spId, logData) {
  const target = getTarget(phId, spId)
  if (!target.timeLogs) target.timeLogs = []
  target.timeLogs.push({
    id: uid(),
    ...logData,
    loggedBy: { uid: authStore.currentUser?.uid || '', name: authStore.currentUser?.name || '' },
  })
  const ph = props.phaseConfig.find(p => p.id === phId)
  logActivity(props.projectId, 'time_logged', { phase: ph?.name || phId, hours: logData.hours, description: logData.description || '', action: 'added' }).catch(() => {})
  autosave(phId)
}

function deleteTimeLog(phId, spId, logId) {
  const target = getTarget(phId, spId)
  const log = (target.timeLogs || []).find(l => l.id === logId)
  target.timeLogs = (target.timeLogs || []).filter(l => l.id !== logId)
  if (log) {
    const ph = props.phaseConfig.find(p => p.id === phId)
    logActivity(props.projectId, 'time_logged', { phase: ph?.name || phId, hours: log.hours, description: '', action: 'deleted' }).catch(() => {})
  }
  autosave(phId)
}

// ── Autosave ─────────────────────────────────────────────────────────────
async function autosave(phId, autoStartNext = false) {
  if (!props.projectId) return
  try {
    const project = projectsStore.projects.find(p => p.id === props.projectId)
    if (!project) return

    // Auto-start the next not-started phase when this phase becomes done
    let nextPhaseName = null
    if (autoStartNext) {
      const order = props.phaseConfig.map(p => p.id)
      const idx   = order.indexOf(phId)
      if (idx >= 0 && idx < order.length - 1) {
        const nextId = order[idx + 1]
        if (!local.value[nextId]) local.value[nextId] = emptyPhaseEntry()
        const nxt = local.value[nextId]
        if (!nxt.status || nxt.status === 'not-started') {
          applyStatus(nxt, 'active')
          nextPhaseName = props.phaseConfig.find(p => p.id === nextId)?.name
        }
      }
    }

    const { activePhases, currentPhase, currentSubPhase } =
      computeActivePhases(local.value, props.phaseConfig)
    await projectsStore.updateProject(props.projectId, {
      phaseData:       deepCopy(local.value),
      activePhases,
      currentPhase:    currentPhase    || project.currentPhase    || null,
      currentSubPhase: currentSubPhase || project.currentSubPhase || null,
      updatedAt:       new Date().toISOString(),
    })
    emit('update-phase', { phaseId: phId, data: deepCopy(local.value[phId]) })
    if (nextPhaseName) {
      emit('next-phase-started', nextPhaseName)
      const proj = projectsStore.projects.find(p => p.id === props.projectId)
      notifyPhaseStarted({
        projectId: props.projectId,
        projectName: proj?.name || '',
        phaseName: nextPhaseName,
        assignedMembers: proj?.assignedMembers || [],
      })
    }
  } catch (err) {
    console.error('List view phase save failed:', err)
  }
}

const _debounce = {}
function debounceAutosave(phId) {
  clearTimeout(_debounce[phId])
  _debounce[phId] = setTimeout(() => autosave(phId), 1500)
}
</script>
