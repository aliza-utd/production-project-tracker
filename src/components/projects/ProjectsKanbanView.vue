<template>
  <div>
    <div v-if="loading"
      style="display:flex;align-items:center;justify-content:center;padding:60px;gap:12px;color:var(--muted)">
      <span style="font-size:22px;animation:spin 1s linear infinite">⏳</span>
      <span>Loading projects…</span>
    </div>

    <div v-else class="kanban-wrap">
      <div
        v-for="col in columns"
        :key="col.phase.id"
        class="kb-col"
        @dragover.prevent="dragOverCol = col.phase.id"
        @dragleave="onColDragLeave(col.phase.id, $event)"
        @drop.prevent="onDrop(col.phase.id)"
      >
        <div class="kb-col-hdr"
          :style="{ background: col.phase.bg || 'var(--bg)', borderRadius: 'var(--r) var(--r) 0 0', borderBottom: '1px solid var(--border)' }">
          <div class="kb-col-title">
            <span class="phase-dot" :style="{ background: col.phase.color || '#6b7280' }"></span>
            <span :style="{ color: col.phase.color || 'var(--text)' }">{{ col.phase.name }}</span>
          </div>
          <span class="kb-count" :style="{ background: col.phase.color ? col.phase.color + '33' : 'rgba(0,0,0,.15)', color: col.phase.color || 'inherit' }">
            {{ col.projects.length }}
          </span>
        </div>

        <div class="kb-cards" :class="{ 'drag-over': dragOverCol === col.phase.id }">
          <div
            v-for="p in col.projects"
            :key="p.id"
            draggable="true"
            class="kb-drag-wrap"
            :class="{ dragging: draggingId === p.id }"
            @dragstart="onDragStart(p.id, $event)"
            @dragend="onDragEnd"
          >
            <ProjectCard
              :project="p"
              :phaseConfig="phaseConfig"
              :kanban="true"
              @click="$emit('open-project', p)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ProjectCard          from '@/components/projects/ProjectCard.vue'
import { useProjectsStore } from '@/stores/projects'
import { usePhaseLogic }    from '@/composables/usePhaseLogic'
import { useActivityLog }   from '@/composables/useActivityLog'

const props = defineProps({
  projects:    { type: Array,   default: () => [] },
  phaseConfig: { type: Array,   default: () => [] },
  teamMembers: { type: Array,   default: () => [] },
  loading:     { type: Boolean, default: false },
})
defineEmits(['open-project'])

const projectsStore = useProjectsStore()
const { autoCompletePreviousPhases } = usePhaseLogic()
const { logActivity }                = useActivityLog()

// ── Drag state ────────────────────────────────────────────────────────────────
const draggingId = ref(null)
const dragOverCol = ref(null)

function onDragStart(projectId, e) {
  draggingId.value  = projectId
  dragOverCol.value = null
  e.dataTransfer.effectAllowed = 'move'
  // store the id so external drop targets can read it
  e.dataTransfer.setData('text/plain', projectId)
}

function onDragEnd() {
  draggingId.value  = null
  dragOverCol.value = null
}

// Only clear drag-over highlight if the pointer actually leaves the column
// (not when entering a child element inside it).
function onColDragLeave(phaseId, e) {
  const col = e.currentTarget
  if (!col.contains(e.relatedTarget)) {
    if (dragOverCol.value === phaseId) dragOverCol.value = null
  }
}

async function onDrop(targetPhaseId) {
  const projectId  = draggingId.value
  draggingId.value  = null
  dragOverCol.value = null
  if (!projectId) return

  const project = props.projects.find(p => p.id === projectId)
  if (!project) return

  const fromPhaseId = project.currentPhase || project.activePhases?.[0]?.phase || 'kickstart'
  if (fromPhaseId === targetPhaseId) return

  const fromPhase = props.phaseConfig.find(ph => ph.id === fromPhaseId)
  const toPhase   = props.phaseConfig.find(ph => ph.id === targetPhaseId)
  const fromName  = fromPhase?.name || fromPhaseId
  const toName    = toPhase?.name   || targetPhaseId

  // Deep-clone phaseData so we don't mutate the reactive store object
  const phaseData = JSON.parse(JSON.stringify(project.phaseData || {}))
  autoCompletePreviousPhases(targetPhaseId, phaseData, props.phaseConfig)

  const update = {
    currentPhase:    targetPhaseId,
    currentSubPhase: null,
    activePhases:    [{ phase: targetPhaseId, subPhase: null }],
    phaseData,
    updatedAt: new Date().toISOString(),
  }

  try {
    await projectsStore.updateProject(projectId, update)
    logActivity(projectId, 'field_updated', {
      field:    'Phase',
      oldValue: fromName,
      newValue: toName,
    }).catch(() => {})
  } catch (err) {
    console.error('[Kanban] Phase drag failed:', err)
  }
}

// ── Columns ───────────────────────────────────────────────────────────────────
const columns = computed(() => {
  const byPhase = {}
  for (const p of props.projects) {
    const phaseId = p.currentPhase || p.activePhases?.[0]?.phase || 'kickstart'
    if (!byPhase[phaseId]) byPhase[phaseId] = []
    byPhase[phaseId].push(p)
  }

  // Always include every known phase, even if it has 0 projects
  const knownIds = new Set(props.phaseConfig.map(ph => ph.id))
  const cols = props.phaseConfig.map(ph => ({
    phase: ph,
    projects: byPhase[ph.id] || [],
  }))
  // Append any projects whose phase id isn't in the config
  for (const [phaseId, projs] of Object.entries(byPhase)) {
    if (!knownIds.has(phaseId)) {
      cols.push({ phase: { id: phaseId, name: phaseId, color: '#6b7280', bg: '#f3f4f6' }, projects: projs })
    }
  }
  return cols
})
</script>

<style scoped>
.kb-drag-wrap {
  cursor: grab;
}
.kb-drag-wrap:active {
  cursor: grabbing;
}
.kb-drag-wrap.dragging {
  opacity: 0.4;
}
/* Override kb-card cursor so the wrapper controls it */
.kb-drag-wrap :deep(.kb-card) {
  cursor: inherit;
}
</style>
