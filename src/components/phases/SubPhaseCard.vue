<template>
  <div
    class="ph-sub-card"
    :class="{
      'ph-card-blocked': localSub.status === 'blocked',
      'ph-card-done':    localSub.status === 'done',
    }"
    :style="{ borderLeft: '3px solid ' + (localSub.status === 'blocked' ? '#d97706' : parentColor) }"
  >
    <!-- Sub-phase header -->
    <div class="ph-card-hdr" style="background:#f8fafc" @click="isCollapsed = !isCollapsed">
      <div class="ph-card-dot" style="width:8px;height:8px" :style="{ background: parentColor }"></div>
      <div class="ph-card-name" style="font-size:13px">{{ subDef.name }}</div>

      <span class="pc-av-wrap" @click.stop>
        <span v-if="assigneeMember" class="pc-av"
          :style="{ background: assigneeMember.avatarColor || '#6366f1' }">
          {{ assigneeMember.initials }}
          <span class="pc-av-tip">{{ assigneeMember.name }}</span>
        </span>
        <span v-else class="pc-av-empty"></span>
      </span>

      <select
        class="ph-status-sel ph-status-sel-sm"
        :class="'ph-st-' + localSub.status"
        :disabled="effectiveReadonly"
        v-model="statusModel"
        @click.stop
      >
        <option value="not-started">Not Started</option>
        <option value="active">Active</option>
        <option value="blocked">Blocked</option>
        <option value="done">Done</option>
      </select>

      <span v-if="subHours > 0" class="ph-hours-badge" style="font-size:10px">{{ fmtHours(subHours) }}</span>
      <span class="ph-arrow" :class="{ open: !isCollapsed }">▶</span>
    </div>

    <!-- Sub-phase body -->
    <div v-if="!isCollapsed" class="ph-card-body" style="padding:14px 16px">

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
      <div v-if="localSub.status !== 'not-started'" class="ph-dates-row" style="margin-bottom:14px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Date Started</label>
          <input type="date" class="form-input" :readonly="effectiveReadonly"
            :value="isoToDateInput(localSub.dateStarted)"
            @input="!effectiveReadonly && setDate('dateStarted', $event.target.value)"
            @blur="!effectiveReadonly && debounceSave()" />
        </div>
        <div v-if="localSub.status === 'done'" class="form-group" style="margin-bottom:0">
          <label class="form-label">Date Completed</label>
          <input type="date" class="form-input" :readonly="effectiveReadonly"
            :value="isoToDateInput(localSub.dateCompleted)"
            @input="!effectiveReadonly && setDate('dateCompleted', $event.target.value)"
            @blur="!effectiveReadonly && debounceSave()" />
        </div>
      </div>

      <!-- Notes -->
      <div class="form-group">
        <div class="ph-section-lbl">Notes</div>
        <textarea class="form-textarea" rows="2" :readonly="effectiveReadonly"
          v-model="localSub.notes"
          @blur="!effectiveReadonly && debounceSave()"
          :placeholder="subDef.name + ' notes…'"></textarea>
      </div>

      <!-- Checklist -->
      <div class="form-group">
        <div class="ph-section-lbl">Checklist</div>
        <div v-if="localSub.checklist && localSub.checklist.length"
          style="background:#f8fafc;border:1px solid var(--border);border-radius:var(--r);padding:4px 12px;margin-bottom:8px">
          <div v-for="item in localSub.checklist" :key="item.id" class="checklist-item">
            <input type="checkbox" v-model="item.done" :disabled="effectiveReadonly" @change="!effectiveReadonly && requestSave()" />
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

      <!-- Time Log -->
      <div class="form-group" style="margin-bottom:0">
        <div class="ph-section-lbl">Time Log</div>
        <TimeLogSection
          :timeLogs="localSub.timeLogs || []"
          :phaseName="subDef.name"
          :readonly="readonly"
          @add-log="addTimeLog"
          @delete-log="deleteTimeLog"
        />
      </div>

      <!-- Save button -->
      <div v-if="!effectiveReadonly"
        style="display:flex;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--border);margin-top:12px">
        <button class="btn btn-primary btn-sm" @click="requestSave">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import TimeLogSection from '@/components/phases/TimeLogSection.vue'

const props = defineProps({
  subPhase:      { type: Object, default: () => ({}) },
  subId:         { type: String, required: true },
  subDef:        { type: Object, required: true },
  parentPhaseId: { type: String, required: true },
  parentColor:   { type: String, default: '#6366f1' },
  teamMembers:   { type: Array,  default: () => [] },
  readonly:      { type: Boolean, default: false },
  locked:        { type: Boolean, default: false },
})
const emit = defineEmits(['update-sub', 'hours-updated'])

const { uid, isoToDateInput, fmtHours, deepCopy, applyStatus } = usePhaseLogic()

const effectiveReadonly = computed(() => props.readonly || props.locked)

const localSub = ref(deepCopy(props.subPhase))

// Sync status (and collapse state) when the parent changes this sub-phase
// externally — e.g. parent marked done, sequential mode advances to next sub.
watch(() => props.subPhase?.status, (newStatus) => {
  if (newStatus !== undefined && newStatus !== localSub.value.status) {
    localSub.value.status = newStatus
    if (newStatus === 'active') isCollapsed.value = false
    if (newStatus === 'done')   isCollapsed.value = true
  }
})

// Writable computed so v-model reliably updates the visible option.
const statusModel = computed({
  get: () => localSub.value.status || 'not-started',
  set: (val) => onStatusChange(val),
})

const isCollapsed      = ref(props.readonly || ['not-started', 'done'].includes(localSub.value.status))
const assigneeOpen     = ref(false)
const newChecklistText = ref('')

const activeMembers  = computed(() => props.teamMembers.filter(m => m.active))
const assigneeMember = computed(() =>
  localSub.value.assignedTo
    ? (props.teamMembers.find(m => m.id === localSub.value.assignedTo) || null)
    : null
)
const subHours = computed(() =>
  (localSub.value.timeLogs || []).reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
)

function requestSave() {
  emit('update-sub', { subId: props.subId, data: deepCopy(localSub.value) })
}

let _debounceTimer = null
function debounceSave() {
  clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => requestSave(), 1500)
}

function onStatusChange(status) {
  applyStatus(localSub.value, status)
  requestSave()
}

function setDate(field, val) {
  localSub.value[field] = val ? new Date(val + 'T00:00:00').toISOString() : null
}

function setAssignee(id) {
  localSub.value.assignedTo = id || null
  assigneeOpen.value = false
  requestSave()
}
function onAssigneeBlur() {
  setTimeout(() => { assigneeOpen.value = false }, 150)
}

function addChecklistItem() {
  const text = newChecklistText.value.trim()
  if (!text) return
  if (!localSub.value.checklist) localSub.value.checklist = []
  localSub.value.checklist.push({ id: uid(), text, done: false })
  newChecklistText.value = ''
  requestSave()
}
function removeChecklistItem(itemId) {
  localSub.value.checklist = (localSub.value.checklist || []).filter(i => i.id !== itemId)
  requestSave()
}

function addTimeLog(logData) {
  if (!localSub.value.timeLogs) localSub.value.timeLogs = []
  localSub.value.timeLogs.push({ id: uid(), ...logData })
  requestSave()
  emit('hours-updated')
}
function deleteTimeLog(logId) {
  localSub.value.timeLogs = (localSub.value.timeLogs || []).filter(l => l.id !== logId)
  requestSave()
  emit('hours-updated')
}
</script>
