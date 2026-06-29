<template>
  <div class="content">

    <!-- Header + Save -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">Phase Settings</h1>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">
          Drag to reorder phases. Changes are not saved until you click Save.
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-ghost btn-sm" @click="reset">Reset to Default</button>
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save Changes' }}
        </button>
      </div>
    </div>

    <div v-if="savedMsg" style="padding:8px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:var(--r);margin-bottom:16px;font-size:13px;color:#16a34a">
      ✓ Phase config saved successfully.
    </div>

    <!-- Phase list -->
    <div class="ps-list">
      <div v-for="(ph, idx) in phases" :key="ph.id">

        <!-- Phase row -->
        <div
          class="ps-row"
          :class="{ 'ps-drag-over': dragOverIdx === idx }"
          draggable="true"
          @dragstart="onDragStart(idx, $event)"
          @dragover.prevent="onDragOver(idx)"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop(idx)"
        >
          <!-- Drag handle -->
          <div class="ps-handle" title="Drag to reorder">⠿</div>

          <!-- Color swatch picker -->
          <div style="position:relative">
            <div class="ps-color-swatch" :style="'background:' + ph.color"
              @click="toggleColorPicker(idx)"></div>
            <div v-if="colorPickerIdx === idx" class="ps-color-panel">
              <div v-for="c in COLOR_SWATCHES" :key="c"
                class="ps-color-opt"
                :style="'background:' + c + (ph.color === c ? ';outline:2px solid #111;outline-offset:1px' : '')"
                @click="setColor(idx, c)"></div>
              <input type="color" :value="ph.color" style="width:100%;height:24px;margin-top:6px;cursor:pointer"
                @input="setColor(idx, $event.target.value)">
            </div>
          </div>

          <!-- Phase name -->
          <input class="form-input ps-name-input" v-model="ph.name" placeholder="Phase name">

          <!-- Default Assignee -->
          <select
            v-if="authStore.isManager"
            class="form-select ps-assignee-select"
            v-model="ph.defaultAssigneeId"
            @click.stop
          >
            <option value="">No default</option>
            <option v-for="m in activeTeamMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>

          <!-- Sub-phases expand button (hidden for dynamic phases) -->
          <button v-if="!ph.dynamic" class="btn btn-ghost btn-sm" style="white-space:nowrap" @click="toggleExpanded(idx)">
            <template v-if="ph.subPhases?.length">
              {{ ph.subPhases.length }} sub-phase{{ ph.subPhases.length !== 1 ? 's' : '' }}
            </template>
            <template v-else>+ Sub-phases</template>
            {{ expandedIdx === idx ? '▾' : '▸' }}
          </button>
          <span v-else class="ps-dynamic-chip">Dynamic</span>

          <!-- Delete phase -->
          <button class="btn-icon" style="color:var(--danger)" @click="removePhase(idx)" title="Delete phase">✕</button>
        </div>

        <!-- Sub-phases panel (regular phases only — dynamic phases show inline note) -->
        <div v-show="!ph.dynamic && expandedIdx === idx" class="ps-sub-panel">

          <!-- Sub-phase mode -->
          <div v-if="(ph.subPhases || []).length" class="ps-submode-wrap">
            <div class="ps-sub-title" style="margin-bottom:6px">Sub-phase mode:</div>
            <label class="ps-radio-opt">
              <input type="radio" :name="'spm-' + ph.id" value="simultaneous" v-model="ph.subPhaseMode">
              <span><strong>Simultaneous</strong> — all activate at once</span>
            </label>
            <label class="ps-radio-opt">
              <input type="radio" :name="'spm-' + ph.id" value="sequential" v-model="ph.subPhaseMode">
              <span><strong>Sequential</strong> — one at a time, in order</span>
            </label>
          </div>

          <div class="ps-sub-title">Sub-phases for <strong>{{ ph.name }}</strong></div>

          <div v-for="(sp, spIdx) in (ph.subPhases || [])" :key="sp.id" class="ps-sub-row">
            <input class="form-input" style="flex:1" v-model="sp.name" placeholder="Sub-phase name">
            <select
              v-if="authStore.isManager"
              class="form-select ps-assignee-select"
              :value="sp.defaultAssigneeId ?? ph.defaultAssigneeId ?? ''"
              @change="sp.defaultAssigneeId = $event.target.value || null"
              title="Default assignee (inherits phase default when not set)"
            >
              <option value="">No default</option>
              <option v-for="m in activeTeamMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <button class="btn-icon" style="color:var(--danger)" @click="removeSubPhase(idx, spIdx)">✕</button>
          </div>

          <button class="btn btn-ghost btn-sm" style="margin-top:8px" @click="addSubPhase(idx)">+ Add Sub-phase</button>

        </div><!-- end sub-phases panel -->

        <!-- Dynamic phase settings panel (Languages phase) -->
        <div v-if="ph.dynamic" class="ps-sub-panel ps-dynamic-panel">

          <!-- Sub-phase mode -->
          <div class="ps-submode-wrap" style="margin-bottom:14px">
            <div class="ps-sub-title" style="margin-bottom:6px">Sub-phase mode:</div>
            <label class="ps-radio-opt">
              <input type="radio" :name="'spm-' + ph.id" value="sequential" v-model="ph.subPhaseMode">
              <span><strong>Sequential</strong> — one at a time, in order</span>
            </label>
            <label class="ps-radio-opt">
              <input type="radio" :name="'spm-' + ph.id" value="simultaneous" v-model="ph.subPhaseMode">
              <span><strong>Simultaneous</strong> — all activate at once</span>
            </label>
          </div>

          <!-- Template editor -->
          <div class="ps-sub-title">Sub-phase Template</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">
            These sub-phases repeat for each additional language.
            Example: <em>FR — Development, FR — QA Initial, EN — Development…</em>
          </div>

          <div
            v-for="(tpl, tplIdx) in (ph.subPhaseTemplate || [])"
            :key="tpl.id"
            class="ps-sub-row"
            :class="{ 'ps-drag-over': tplDragOverIdx === tplIdx && tplDragPhaseIdx === idx }"
            draggable="true"
            @dragstart="onTplDragStart(idx, tplIdx, $event)"
            @dragover.prevent="onTplDragOver(idx, tplIdx)"
            @dragleave="onTplDragLeave"
            @drop.prevent="onTplDrop(idx, tplIdx)"
            style="margin-bottom:5px"
          >
            <div class="ps-handle" style="font-size:14px;cursor:grab">⠿</div>
            <input class="form-input" style="flex:1" v-model="tpl.name" placeholder="Sub-phase name">
            <button class="btn-icon" style="color:var(--danger)" title="Delete"
              @click="removeTplItem(idx, tplIdx)">✕</button>
          </div>

          <button class="btn btn-ghost btn-sm" style="margin-top:6px;margin-bottom:16px"
            @click="addTplItem(idx)">+ Add Sub-phase Template</button>

          <!-- Live preview -->
          <div class="ps-lang-note">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;color:#1d4ed8">
              Live Preview (FR, EN)
            </div>
            <div style="font-weight:600;color:var(--text);margin-bottom:4px">{{ ph.name }}</div>
            <div v-for="sp in previewSubPhases(ph)" :key="sp"
              style="font-size:12px;color:var(--muted);padding:1px 0">
              └ {{ sp }}
            </div>
            <div v-if="!(ph.subPhaseTemplate || []).length"
              style="font-size:12px;color:var(--muted);font-style:italic">No template items yet.</div>
          </div>

          <!-- Apply to existing projects -->
          <button class="btn btn-secondary btn-sm" style="margin-top:12px"
            @click="applyTemplateToProjects(ph)">
            Apply template to existing projects
          </button>

        </div>

      </div><!-- end phase item -->
    </div><!-- end ps-list -->

    <!-- Add phase -->
    <button class="btn btn-secondary btn-sm" style="margin-top:12px" @click="addPhase">+ Add Phase</button>

    <!-- Default assignee note -->
    <div v-if="authStore.isManager" style="margin-top:14px;font-size:12px;color:var(--muted);padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r)">
      <strong>Note:</strong> Lead Developer and Developers Involved are set per project — no phase default applies.
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { usePhasesStore }  from '@/stores/phases'
import { useAuthStore }    from '@/stores/auth'
import { useProjectsStore } from '@/stores/projects'
import { useTeamStore }    from '@/stores/team'
import { usePhaseLogic }   from '@/composables/usePhaseLogic'

const phasesStore   = usePhasesStore()
const authStore     = useAuthStore()
const projectsStore = useProjectsStore()
const teamStore     = useTeamStore()

const activeTeamMembers = computed(() => teamStore.teamMembers.filter(m => m.active !== false))
const { generateLanguagePhaseData } = usePhaseLogic()

const COLOR_SWATCHES = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#ef4444',
  '#f97316','#f59e0b','#eab308','#10b981','#14b8a6',
  '#0ea5e9','#3b82f6','#6b7280','#374151',
]

const DEFAULT_LANG_TEMPLATE = [
  { id: 'development',      name: 'Development' },
  { id: 'qa_initial',       name: 'QA Initial' },
  { id: 'qa_golive',        name: 'QA Go-Live' },
  { id: 'qa_live_checking', name: 'QA Live Checking' },
]

const phases         = reactive([])
const saving         = ref(false)
const savedMsg       = ref(false)
const colorPickerIdx = ref(null)
const expandedIdx    = ref(null)
const dragSrcIdx     = ref(null)
const dragOverIdx    = ref(null)

// Template item drag state (for dynamic phase sub-phase template)
const tplDragSrcIdx   = ref(null)
const tplDragPhaseIdx = ref(null)
const tplDragOverIdx  = ref(null)

function nameToId(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '')
}

function loadFromStore() {
  phases.length = 0
  phasesStore.phaseConfig.forEach(ph => {
    const copy = JSON.parse(JSON.stringify(ph))
    // Ensure defaultAssigneeId exists so v-model doesn't bind to undefined
    copy.defaultAssigneeId = copy.defaultAssigneeId ?? ''
    if (Array.isArray(copy.subPhases)) {
      // null = no explicit override (inherits parent); non-empty string = explicit choice
      copy.subPhases.forEach(sp => { sp.defaultAssigneeId = sp.defaultAssigneeId || null })
    }
    if (copy.dynamic && !copy.subPhaseTemplate?.length) {
      copy.subPhaseTemplate = JSON.parse(JSON.stringify(DEFAULT_LANG_TEMPLATE))
    }
    phases.push(copy)
  })
}

onMounted(() => {
  loadFromStore()
  document.addEventListener('click', onDocClick)
})
onUnmounted(() => document.removeEventListener('click', onDocClick))

function onDocClick(e) {
  if (!e.target.closest('.ps-color-panel') && !e.target.closest('.ps-color-swatch')) {
    colorPickerIdx.value = null
  }
}

function toggleColorPicker(idx) {
  colorPickerIdx.value = colorPickerIdx.value === idx ? null : idx
}

function setColor(idx, color) {
  phases[idx].color = color
  colorPickerIdx.value = null
}

function toggleExpanded(idx) {
  expandedIdx.value = expandedIdx.value === idx ? null : idx
}

function addPhase() {
  phases.push({
    id:          Math.random().toString(36).slice(2),
    name:        'New Phase',
    color:       '#6366f1',
    subPhases:   [],
    subPhaseMode:'simultaneous',
    order:       phases.length,
  })
}

function removePhase(idx) {
  if (!confirm(`Remove phase "${phases[idx].name}"?`)) return
  phases.splice(idx, 1)
  if (expandedIdx.value === idx) expandedIdx.value = null
}

function addSubPhase(phaseIdx) {
  if (!phases[phaseIdx].subPhases) phases[phaseIdx].subPhases = []
  phases[phaseIdx].subPhases.push({
    id:                Math.random().toString(36).slice(2),
    name:              '',
    defaultAssigneeId: null,  // null = inherit from parent phase
  })
}

// ── Template item functions (dynamic phases) ──────────────────────────────
function addTplItem(phaseIdx) {
  if (!phases[phaseIdx].subPhaseTemplate) phases[phaseIdx].subPhaseTemplate = []
  phases[phaseIdx].subPhaseTemplate.push({ id: 'new_' + Math.random().toString(36).slice(2), name: '' })
}

function removeTplItem(phaseIdx, tplIdx) {
  const name = phases[phaseIdx].subPhaseTemplate[tplIdx].name
  if (name && !confirm(`Remove template item "${name}"?`)) return
  phases[phaseIdx].subPhaseTemplate.splice(tplIdx, 1)
}

function onTplDragStart(phaseIdx, tplIdx, e) {
  tplDragPhaseIdx.value = phaseIdx
  tplDragSrcIdx.value   = tplIdx
  e.dataTransfer.effectAllowed = 'move'
}

function onTplDragOver(phaseIdx, tplIdx) {
  if (tplDragPhaseIdx.value === phaseIdx) tplDragOverIdx.value = tplIdx
}

function onTplDragLeave() { tplDragOverIdx.value = null }

function onTplDrop(phaseIdx, targetIdx) {
  const src = tplDragSrcIdx.value
  if (src === null || src === targetIdx || tplDragPhaseIdx.value !== phaseIdx) {
    tplDragOverIdx.value = null; return
  }
  const tpl  = phases[phaseIdx].subPhaseTemplate
  const item = tpl.splice(src, 1)[0]
  tpl.splice(targetIdx, 0, item)
  tplDragSrcIdx.value = tplDragPhaseIdx.value = tplDragOverIdx.value = null
}

function previewSubPhases(ph) {
  return ['FR', 'EN'].flatMap(lang =>
    (ph.subPhaseTemplate || []).map(t => `${lang} — ${t.name}`)
  )
}

async function applyTemplateToProjects(ph) {
  const template = (ph.subPhaseTemplate || []).filter(t => t.name.trim())
  if (!template.length) { alert('Add at least one template item first.'); return }
  const projects = projectsStore.projects.filter(p => (p.additionalLanguages || []).length > 0)
  if (!projects.length) { alert('No projects with additional languages found.'); return }
  if (!confirm(
    `Apply this template to ${projects.length} project(s) with additional languages?\n\n` +
    `Existing language sub-task PROGRESS will be preserved. New items will be added; ` +
    `removed items will be kept if they have any progress data.`
  )) return
  let updated = 0
  for (const project of projects) {
    const newLangsData = generateLanguagePhaseData(project.additionalLanguages, template)
    const existing     = project.phaseData?.languages?.subPhases || {}
    // Merge: preserve existing progress, add new items
    const merged = { ...newLangsData.subPhases }
    for (const [id, data] of Object.entries(existing)) {
      if (data.status && data.status !== 'not-started') merged[id] = data
    }
    const phaseData = JSON.parse(JSON.stringify(project.phaseData || {}))
    if (!phaseData.languages) phaseData.languages = newLangsData
    phaseData.languages.subPhases = merged
    try {
      await projectsStore.updateProject(project.id, { phaseData })
      updated++
    } catch (e) {
      console.error('Failed to update project', project.id, e)
    }
  }
  alert(`Template applied to ${updated} project(s).`)
}

function removeSubPhase(phaseIdx, spIdx) {
  phases[phaseIdx].subPhases.splice(spIdx, 1)
}

// ── Drag & drop ───────────────────────────────────────────────────────────────
function onDragStart(idx, e) {
  dragSrcIdx.value = idx
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(idx) {
  dragOverIdx.value = idx
}

function onDragLeave() {
  dragOverIdx.value = null
}

function onDrop(targetIdx) {
  const src = dragSrcIdx.value
  if (src === null || src === targetIdx) {
    dragOverIdx.value = null
    return
  }
  const item = phases.splice(src, 1)[0]
  phases.splice(targetIdx, 0, item)
  phases.forEach((ph, i) => { ph.order = i })
  dragSrcIdx.value  = null
  dragOverIdx.value = null
  if (expandedIdx.value === src) expandedIdx.value = targetIdx
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function save() {
  saving.value = true
  try {
    const clean = phases.map((ph, i) => {
      const base = {
        id:                ph.id,
        name:              ph.name,
        color:             ph.color,
        order:             i,
        subPhaseMode:      ph.subPhaseMode || (ph.dynamic ? 'sequential' : 'simultaneous'),
        defaultAssigneeId: ph.defaultAssigneeId || null,
        subPhases:         (ph.subPhases || [])
          .filter(sp => sp.name.trim())
          .map(sp => ({ id: sp.id, name: sp.name, defaultAssigneeId: sp.defaultAssigneeId || null })),
      }
      if (ph.dynamic) {
        base.dynamic = true
        base.subPhaseTemplate = (ph.subPhaseTemplate || [])
          .filter(t => t.name.trim())
          .map(t => ({
            id:   t.id.startsWith('new_') ? nameToId(t.name) : t.id,
            name: t.name.trim(),
          }))
      }
      return base
    })
    await phasesStore.saveConfig(clean, authStore.currentUser?.uid)
    savedMsg.value = true
    setTimeout(() => { savedMsg.value = false }, 3000)
  } catch (err) {
    alert('Save failed: ' + err.message)
  } finally {
    saving.value = false
  }
}

function reset() {
  if (!confirm('Reset to default phase configuration? Unsaved changes will be lost.')) return
  loadFromStore()
}
</script>

<style scoped>
.ps-list { display: flex; flex-direction: column; gap: 0; }

.ps-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  margin-bottom: 0;
  border-bottom: none;
  border-radius: var(--r) var(--r) 0 0;
  cursor: grab;
  transition: background .15s;
}
.ps-row:last-of-type { border-radius: var(--r); border-bottom: 1px solid var(--border); margin-bottom: 6px; }
.ps-row:active { cursor: grabbing; }
.ps-drag-over { border-color: var(--primary); background: var(--primary-ghost, #eef2ff); }

.ps-handle { font-size: 18px; color: var(--muted); cursor: grab; flex-shrink: 0; }
.ps-color-swatch {
  width: 24px; height: 24px; border-radius: 6px;
  cursor: pointer; border: 2px solid transparent; flex-shrink: 0;
  transition: transform .1s;
}
.ps-color-swatch:hover { transform: scale(1.2); }

.ps-color-panel {
  position: absolute;
  top: 30px; left: 0;
  z-index: 200;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  width: 168px;
  box-shadow: 0 4px 16px rgba(0,0,0,.15);
}
.ps-color-opt {
  width: 22px; height: 22px; border-radius: 50%;
  cursor: pointer; transition: transform .1s;
}
.ps-color-opt:hover { transform: scale(1.2); }

.ps-name-input { flex: 1; min-width: 100px; }
.ps-assignee-select { flex: 0 1 150px; min-width: 110px; font-size: 12px; }
.ps-lang-toggle {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--text);
  white-space: nowrap; cursor: pointer; flex-shrink: 0;
}

.ps-sub-panel {
  background: var(--bg);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  padding: 14px 16px;
  margin-bottom: 6px;
}
.ps-dynamic-panel {
  display: block !important;
}
.ps-dynamic-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: #ede9fe;
  color: #7c3aed;
  white-space: nowrap;
  flex-shrink: 0;
}

.ps-lang-note {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #1d4ed8;
  margin-bottom: 12px;
}

.ps-sub-title { font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.ps-submode-wrap { margin-bottom: 12px; padding: 8px 10px; background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; }
.ps-radio-opt { display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; padding: 3px 0; }
.ps-radio-opt input { margin: 0; cursor: pointer; }
.ps-sub-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }

/* Preview */
.ps-preview {
  margin-top: 14px;
  padding: 10px 12px;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--r);
  font-size: 12px;
}
.ps-preview-title { font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; }
.ps-preview-phase { font-weight: 700; color: var(--text); margin-bottom: 4px; }
.ps-preview-sp { display: flex; align-items: center; gap: 6px; color: var(--muted); padding: 2px 0; }
.ps-preview-corner { opacity: .4; }
.ps-preview-lang-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
</style>
