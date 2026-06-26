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
              <select v-if="!readonly" class="ph-list-sel"
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
                :disabled="readonly"
                :value="phStatus(ph.id)"
                @change="setStatus(ph.id, null, $event.target.value)">
                <option value="not-started">Not Started</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
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
                <div class="ph-list-exp-grid">
                  <div>
                    <div class="ph-section-lbl">Notes</div>
                    <textarea class="form-textarea" rows="3" :readonly="readonly"
                      :value="local[ph.id]?.notes || ''"
                      @input="!readonly && setNotes(ph.id, null, $event.target.value)"
                      @blur="!readonly && debounceAutosave(ph.id)"
                      :placeholder="'Notes for ' + ph.name + '…'"></textarea>
                  </div>
                  <div>
                    <div class="ph-section-lbl">Checklist</div>
                    <div v-if="(local[ph.id]?.checklist || []).length"
                      style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 10px;margin-bottom:6px">
                      <div v-for="item in local[ph.id].checklist" :key="item.id" class="checklist-item">
                        <input type="checkbox" v-model="item.done" :disabled="readonly"
                          @change="!readonly && autosave(ph.id)" />
                        <span class="checklist-text" :class="{ done: item.done }">{{ item.text }}</span>
                        <button v-if="!readonly" class="btn-icon"
                          @click="removeChecklist(ph.id, null, item.id)">🗑️</button>
                      </div>
                    </div>
                    <div v-else style="font-size:12px;color:var(--muted);margin-bottom:6px">No items.</div>
                    <div v-if="!readonly" class="checklist-add">
                      <input class="form-input" placeholder="Add item…"
                        v-model="newChecklistText[ph.id]"
                        @keyup.enter="addChecklist(ph.id, null)" />
                      <button class="btn btn-secondary btn-sm" @click="addChecklist(ph.id, null)">Add</button>
                    </div>
                  </div>
                </div>

                <!-- Time log collapsible -->
                <div style="margin-top:12px">
                  <div class="ph-section-lbl"
                    style="display:flex;align-items:center;justify-content:space-between;cursor:pointer"
                    @click="toggleTl(ph.id)">
                    <span>Time Log
                      <span v-if="phHours(ph.id, null) > 0"
                        style="color:var(--text);font-weight:700;margin-left:6px">
                        {{ fmtHours(phHours(ph.id, null)) }}
                      </span>
                    </span>
                    <span>{{ tlOpen[ph.id] ? '▲' : '▼' }}</span>
                  </div>
                  <template v-if="tlOpen[ph.id]">
                    <TimeLogSection
                      :timeLogs="local[ph.id]?.timeLogs || []"
                      :phaseName="ph.name"
                      :readonly="readonly"
                      @add-log="(d) => addTimeLog(ph.id, null, d)"
                      @delete-log="(id) => deleteTimeLog(ph.id, null, id)"
                    />
                  </template>
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
                    <option value="not-started">Not Started</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
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
                    <div class="ph-list-exp-grid">
                      <div>
                        <div class="ph-section-lbl">Notes</div>
                        <textarea class="form-textarea" rows="3" :readonly="readonly"
                          :value="local[ph.id]?.subPhases?.[sp.id]?.notes || ''"
                          @input="!readonly && setNotes(ph.id, sp.id, $event.target.value)"
                          @blur="!readonly && debounceAutosave(ph.id)"
                          :placeholder="sp.name + ' notes…'"></textarea>
                      </div>
                      <div>
                        <div class="ph-section-lbl">Checklist</div>
                        <div v-if="(local[ph.id]?.subPhases?.[sp.id]?.checklist || []).length"
                          style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 10px;margin-bottom:6px">
                          <div v-for="item in local[ph.id].subPhases[sp.id].checklist" :key="item.id"
                            class="checklist-item">
                            <input type="checkbox" v-model="item.done" :disabled="readonly"
                              @change="!readonly && autosave(ph.id)" />
                            <span class="checklist-text" :class="{ done: item.done }">{{ item.text }}</span>
                            <button v-if="!readonly" class="btn-icon"
                              @click="removeChecklist(ph.id, sp.id, item.id)">🗑️</button>
                          </div>
                        </div>
                        <div v-else style="font-size:12px;color:var(--muted);margin-bottom:6px">No items.</div>
                        <div v-if="!readonly" class="checklist-add">
                          <input class="form-input" placeholder="Add item…"
                            v-model="newChecklistText[ph.id + ':' + sp.id]"
                            @keyup.enter="addChecklist(ph.id, sp.id)" />
                          <button class="btn btn-secondary btn-sm"
                            @click="addChecklist(ph.id, sp.id)">Add</button>
                        </div>
                      </div>
                    </div>
                    <div style="margin-top:12px">
                      <div class="ph-section-lbl"
                        style="display:flex;align-items:center;justify-content:space-between;cursor:pointer"
                        @click="toggleTl(ph.id + '_sp_' + sp.id)">
                        <span>Time Log
                          <span v-if="phHours(ph.id, sp.id) > 0"
                            style="color:var(--text);font-weight:700;margin-left:6px">
                            {{ fmtHours(phHours(ph.id, sp.id)) }}
                          </span>
                        </span>
                        <span>{{ tlOpen[ph.id + '_sp_' + sp.id] ? '▲' : '▼' }}</span>
                      </div>
                      <template v-if="tlOpen[ph.id + '_sp_' + sp.id]">
                        <TimeLogSection
                          :timeLogs="local[ph.id]?.subPhases?.[sp.id]?.timeLogs || []"
                          :phaseName="sp.name"
                          :readonly="readonly"
                          @add-log="(d) => addTimeLog(ph.id, sp.id, d)"
                          @delete-log="(id) => deleteTimeLog(ph.id, sp.id, id)"
                        />
                      </template>
                    </div>
                    <div v-if="!readonly"
                      style="display:flex;justify-content:flex-end;margin-top:12px">
                      <button class="btn btn-primary btn-sm" @click="autosave(ph.id)">Save</button>
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
import TimeLogSection from '@/components/phases/TimeLogSection.vue'

const props = defineProps({
  phaseData:   { type: Object, default: () => ({}) },
  phaseConfig: { type: Array,  default: () => [] },
  teamMembers: { type: Array,  default: () => [] },
  projectId:   { type: String, required: true },
  siteStatus:  { type: String, default: '' },
  readonly:    { type: Boolean, default: false },
})
const emit = defineEmits(['update-phase', 'next-phase-started'])

const { uid, isoToDateInput, fmtHours, deepCopy, applyStatus, emptyPhaseEntry, computeActivePhases } = usePhaseLogic()
const projectsStore = useProjectsStore()
const authStore     = useAuthStore()

// Local deep copy of full phaseData — kept in sync with prop for real-time updates
const local = ref(deepCopy(props.phaseData))

watch(() => props.phaseData, (v) => { local.value = deepCopy(v) }, { deep: true })

const rowOpen          = reactive({})
const tlOpen           = reactive({})
const newChecklistText = reactive({})

const activeMembers = computed(() => props.teamMembers.filter(m => m.active))

function toggleRow(key) { rowOpen[key] = !rowOpen[key] }
function toggleTl(key)  { tlOpen[key]  = !tlOpen[key] }

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
  applyStatus(target, status)
  autosave(phId, !spId && status === 'done')
}

function setAssignee(phId, spId, memberId) {
  const target = getTarget(phId, spId)
  target.assignedTo = memberId || null
  autosave(phId)
}

function setNotes(phId, spId, value) {
  const target = getTarget(phId, spId)
  target.notes = value
}

function addChecklist(phId, spId) {
  const key  = spId ? `${phId}:${spId}` : phId
  const text = (newChecklistText[key] || '').trim()
  if (!text) return
  const target = getTarget(phId, spId)
  if (!target.checklist) target.checklist = []
  target.checklist.push({ id: uid(), text, done: false })
  newChecklistText[key] = ''
  autosave(phId)
}

function removeChecklist(phId, spId, itemId) {
  const target = getTarget(phId, spId)
  target.checklist = (target.checklist || []).filter(i => i.id !== itemId)
  autosave(phId)
}

function addTimeLog(phId, spId, logData) {
  const target = getTarget(phId, spId)
  if (!target.timeLogs) target.timeLogs = []
  target.timeLogs.push({
    id: uid(),
    ...logData,
    loggedBy: { uid: authStore.currentUser?.uid || '', name: authStore.currentUser?.name || '' },
  })
  autosave(phId)
}

function deleteTimeLog(phId, spId, logId) {
  const target = getTarget(phId, spId)
  target.timeLogs = (target.timeLogs || []).filter(l => l.id !== logId)
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
    if (nextPhaseName) emit('next-phase-started', nextPhaseName)
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
