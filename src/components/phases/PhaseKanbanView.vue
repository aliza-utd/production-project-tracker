<template>
  <div class="ph-kb-wrap">
    <div v-if="readonly" class="ph-kb-lock-banner">
      🔒 {{ siteStatus === 'live' ? 'Site is live. Phase history is read-only.' : 'Project is on-hold. Phases are locked.' }}
    </div>

    <div class="ph-kb-cols">
      <div
        v-for="col in COLUMNS"
        :key="col.id"
        class="ph-kb-col"
        :class="'ph-kb-col-' + col.id"
        @dragover.prevent
        @drop.prevent="!readonly && onDrop(col.id)"
      >
        <div class="ph-kb-col-hdr">
          <span>{{ col.label }}</span>
          <span class="ph-kb-count">{{ cardsForStatus(col.id).length }}</span>
        </div>
        <div class="ph-kb-cards">
          <div v-if="!cardsForStatus(col.id).length" class="ph-kb-empty">—</div>
          <div
            v-for="card in cardsForStatus(col.id)"
            :key="card.key"
            class="ph-kb-card"
            :draggable="!readonly"
            @dragstart="dragKey = card.key"
            :style="{ borderLeft: '3px solid ' + card.color }"
          >
            <div class="ph-kb-card-name">{{ card.name }}</div>
            <div v-if="card.parentName" class="ph-kb-card-parent">{{ card.parentName }}</div>
            <div class="ph-kb-card-meta">
              <span v-if="card.assignee" class="pc-av"
                style="width:22px;height:22px;font-size:9px;font-weight:700;flex-shrink:0"
                :style="{ background: card.assignee.avatarColor || '#6366f1' }">
                {{ card.assignee.initials }}
              </span>
              <span v-if="card.hours > 0" class="ph-hours-badge" style="font-size:10px">
                {{ fmtHours(card.hours) }}
              </span>
              <span v-if="readonly" class="pc-locked-chip">🔒</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { useProjectsStore } from '@/stores/projects'

const COLUMNS = [
  { id: 'not-started', label: 'Not Started' },
  { id: 'active',      label: 'Active' },
  { id: 'blocked',     label: 'Blocked' },
  { id: 'done',        label: 'Done' },
]

const props = defineProps({
  phaseData:   { type: Object, default: () => ({}) },
  phaseConfig: { type: Array,  default: () => [] },
  teamMembers: { type: Array,  default: () => [] },
  projectId:   { type: String, required: true },
  siteStatus:  { type: String, default: '' },
  readonly:    { type: Boolean, default: false },
})
const emit = defineEmits(['update-phase', 'activation-complete'])

const { fmtHours, deepCopy, applyStatus, computeActivePhases } = usePhaseLogic()
const projectsStore = useProjectsStore()

// Local mutable copy of phaseData
const local   = ref(deepCopy(props.phaseData))
const dragKey = ref(null)

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

function memberById(id) { return id ? props.teamMembers.find(m => m.id === id) || null : null }
function phAssignee(phId) {
  return memberById(local.value[phId]?.assignedTo)
}
function spAssignee(phId, spId) {
  return memberById(local.value[phId]?.subPhases?.[spId]?.assignedTo)
}

function cardsForStatus(status) {
  const cards = []
  for (const ph of props.phaseConfig) {
    if (phStatus(ph.id) === status) {
      cards.push({
        key:        ph.id,
        name:       ph.name,
        parentName: null,
        phaseId:    ph.id,
        subId:      null,
        color:      ph.color,
        assignee:   phAssignee(ph.id),
        hours:      phHoursTotal(ph.id),
      })
    }
    if (ph.subPhases) {
      for (const sp of ph.subPhases) {
        if (spStatus(ph.id, sp.id) === status) {
          cards.push({
            key:        ph.id + '_sp_' + sp.id,
            name:       sp.name,
            parentName: ph.name,
            phaseId:    ph.id,
            subId:      sp.id,
            color:      ph.color,
            assignee:   spAssignee(ph.id, sp.id),
            hours:      phHours(ph.id, sp.id),
          })
        }
      }
    }
  }
  return cards
}

async function onDrop(newStatus) {
  const key = dragKey.value
  dragKey.value = null
  if (!key) return

  let phaseId, subId
  if (key.includes('_sp_')) {
    const parts = key.split('_sp_')
    phaseId = parts[0]
    subId   = parts[1]
  } else {
    phaseId = key
    subId   = null
  }

  if (subId) {
    if (!local.value[phaseId]) return
    if (!local.value[phaseId].subPhases) local.value[phaseId].subPhases = {}
    const sp = local.value[phaseId].subPhases[subId]
    if (!sp) return
    applyStatus(sp, newStatus)
  } else {
    const ph = local.value[phaseId]
    if (!ph) return
    applyStatus(ph, newStatus)
    // Activation phase done → trigger event
    if (phaseId === 'activation' && newStatus === 'done') {
      emit('activation-complete')
    }
  }

  await saveAll(phaseId)
}

async function saveAll(phaseId) {
  if (!props.projectId) return
  try {
    const project = projectsStore.projects.find(p => p.id === props.projectId)
    if (!project) return
    const { activePhases, currentPhase, currentSubPhase } =
      computeActivePhases(local.value, props.phaseConfig)
    await projectsStore.updateProject(props.projectId, {
      phaseData:       deepCopy(local.value),
      activePhases,
      currentPhase:    currentPhase    || project.currentPhase    || null,
      currentSubPhase: currentSubPhase || project.currentSubPhase || null,
      updatedAt:       new Date().toISOString(),
    })
    emit('update-phase', { phaseId, data: deepCopy(local.value[phaseId]) })
  } catch (err) {
    console.error('Kanban phase save failed:', err)
  }
}
</script>
