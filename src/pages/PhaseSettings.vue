<template>
  <div>

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
      <div v-for="(ph, idx) in phases" :key="ph.id" class="ps-phase-block">

        <!-- Phase row -->
        <div
          class="ps-row"
          :class="{ 'ps-drag-over': dragOverIdx === idx, 'ps-row-expanded': expandedIdx === idx || ph.dynamic }"
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

          <!-- Right-side controls -->
          <div class="ps-row-actions">
            <select
              v-if="authStore.isManager"
              class="form-select ps-assignee-select"
              v-model="ph.defaultAssigneeId"
              @click.stop
            >
              <option value="">No default</option>
              <option v-for="m in activeTeamMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
            <!-- Sub-phases chip -->
            <button v-if="!ph.dynamic" class="ps-chip"
              :style="ph.subPhases?.length ? phChipStyle(ph) : {}"
              @click="toggleExpanded(idx)">
              <svg class="ps-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/>
              </svg>
              Sub-phases
              <span v-if="ph.subPhases?.length" class="ps-chip-badge" :style="'background:'+ph.color">{{ ph.subPhases.length }}</span>
            </button>
            <span v-else class="ps-dynamic-chip">Dynamic</span>
            <!-- Checklist chip -->
            <button v-if="!ph.subPhases?.length" class="ps-chip"
              :style="clItemCount(ph.id) ? phChipStyle(ph) : {}"
              @click.stop="toggleChecklistExpanded(ph.id)">
              <svg class="ps-chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
                <polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>
              </svg>
              Checklist
              <span v-if="clItemCount(ph.id)" class="ps-chip-badge" :style="'background:'+ph.color">{{ clItemCount(ph.id) }}</span>
            </button>
            <button class="btn-icon" style="color:var(--muted)" @click="removePhase(idx)" title="Delete phase">✕</button>
          </div>
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

          <template v-for="(sp, spIdx) in (ph.subPhases || [])" :key="sp.id">
            <div class="ps-sub-row">
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
              <!-- Sub-phase checklist template toggle -->
              <button class="btn btn-ghost btn-sm ps-cl-btn" style="white-space:nowrap;font-size:11px"
                @click.stop="toggleChecklistExpanded(sp.id)">
                CL{{ clItemCount(sp.id) ? ' (' + clItemCount(sp.id) + ')' : '' }}
                {{ checklistExpanded[sp.id] ? '▾' : '▸' }}
              </button>
              <button class="btn-icon" style="color:var(--danger)" @click="removeSubPhase(idx, spIdx)">✕</button>
            </div>
            <!-- Sub-phase checklist template editor -->
            <div v-if="checklistExpanded[sp.id]"
              style="background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:var(--r);padding:10px 14px;margin-bottom:4px">
              <div class="ps-sub-title" style="margin-bottom:6px">Checklist: {{ sp.name }}</div>
              <div
                v-for="(item, itemIdx) in (localClItems[sp.id] || [])"
                :key="item.id"
                class="ps-sub-row"
                :class="{ 'ps-drag-over': clDragOverIdx === itemIdx && clDragPhaseId === sp.id }"
                draggable="true"
                @dragstart="onClDragStart(sp.id, itemIdx, $event)"
                @dragover.prevent="onClDragOver(sp.id, itemIdx)"
                @dragleave="onClDragLeave"
                @drop.prevent="onClDrop(sp.id, itemIdx)"
                style="margin-bottom:4px"
              >
                <div class="ps-handle" style="font-size:12px;cursor:grab">⠿</div>
                <input class="form-input" style="flex:1;font-size:12px" v-model="item.name"
                  placeholder="Item name" @input="onClItemRename(sp.id)" />
                <button class="btn-icon" style="color:var(--danger);font-size:11px"
                  @click="removeClItem(sp.id, item.id)">✕</button>
              </div>
              <div v-if="!(localClItems[sp.id] || []).length"
                style="font-size:11px;color:var(--muted);margin-bottom:6px;font-style:italic">
                No items yet.
              </div>
              <div class="ps-sub-row" style="margin-top:4px">
                <input class="form-input" style="flex:1;font-size:12px" :value="newClInput[sp.id] || ''"
                  placeholder="New item…"
                  @input="newClInput[sp.id] = $event.target.value"
                  @keyup.enter="addClItem(sp.id)" />
                <button class="btn btn-secondary btn-sm" style="font-size:11px" @click="addClItem(sp.id)">+ Add</button>
              </div>
            </div>
          </template>

          <button class="btn btn-ghost btn-sm" style="margin-top:8px" @click="addSubPhase(idx)">+ Add Sub-phase</button>

        </div><!-- end sub-phases panel -->

        <!-- Checklist template card — standalone (no flush connection to row) -->
        <div v-if="checklistExpanded[ph.id] && !ph.dynamic" class="ps-cl-card">
          <div class="ps-sub-title" style="margin-bottom:10px">
            Checklist template — <strong>{{ ph.name }}</strong>
          </div>
          <div
            v-for="(item, itemIdx) in (localClItems[ph.id] || [])"
            :key="item.id"
            class="ps-cl-item-row"
            :class="{ 'ps-drag-over': clDragOverIdx === itemIdx && clDragPhaseId === ph.id }"
            draggable="true"
            @dragstart="onClDragStart(ph.id, itemIdx, $event)"
            @dragover.prevent="onClDragOver(ph.id, itemIdx)"
            @dragleave="onClDragLeave"
            @drop.prevent="onClDrop(ph.id, itemIdx)"
          >
            <div class="ps-handle" style="font-size:13px;cursor:grab">⠿</div>
            <input class="form-input" style="flex:1;font-size:13px" v-model="item.name"
              placeholder="Item name" @input="onClItemRename(ph.id)" />
            <button class="btn-icon" style="color:var(--danger)" title="Remove"
              @click="removeClItem(ph.id, item.id)">✕</button>
          </div>
          <div v-if="!(localClItems[ph.id] || []).length"
            style="font-size:12px;color:var(--muted);margin-bottom:8px;font-style:italic">
            No checklist items yet.
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input class="form-input" style="flex:1;font-size:13px" :value="newClInput[ph.id] || ''"
              placeholder="New item name…"
              @input="newClInput[ph.id] = $event.target.value"
              @keyup.enter="addClItem(ph.id)" />
            <button class="btn btn-primary btn-sm" @click="addClItem(ph.id)">+ Add Item</button>
          </div>
        </div>

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
import { useChecklistTemplatesStore } from '@/stores/checklistTemplates'

const phasesStore              = usePhasesStore()
const authStore                = useAuthStore()
const projectsStore            = useProjectsStore()
const teamStore                = useTeamStore()
const checklistTemplatesStore  = useChecklistTemplatesStore()

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

// ── Checklist template editing state ─────────────────────────────────────────
// checklistExpanded: { phaseOrSubId: boolean }
const checklistExpanded   = reactive({})
// localClItems: { phaseOrSubId: [{ id, name, order }] }
const localClItems        = reactive({})
// newClInput: { phaseOrSubId: '' }
const newClInput          = reactive({})
// drag state for checklist item reorder
const clDragSrcId   = ref(null)
const clDragPhaseId = ref(null)
const clDragOverIdx = ref(null)
// rename debounce timers
const _clRenameTimers = {}


function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`
}
function phChipStyle(ph) {
  const rgb = hexToRgb(ph.color || '#6366f1')
  return { background: `rgba(${rgb},0.09)`, color: ph.color, borderColor: `rgba(${rgb},0.3)` }
}

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
  checklistTemplatesStore.fetchTemplates()
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

// ── Checklist template functions ──────────────────────────────────────────────
function clItemCount(id) {
  return checklistTemplatesStore.getTemplateItems(id).length
}

function toggleChecklistExpanded(id) {
  if (!checklistExpanded[id]) {
    localClItems[id]  = JSON.parse(JSON.stringify(checklistTemplatesStore.getTemplateItems(id)))
    newClInput[id]    = ''
  }
  checklistExpanded[id] = !checklistExpanded[id]
}

async function addClItem(id) {
  const name = (newClInput[id] || '').trim()
  if (!name) return
  if (!localClItems[id]) localClItems[id] = []
  localClItems[id].push({ id: Math.random().toString(36).slice(2), name, order: localClItems[id].length })
  newClInput[id] = ''
  await saveClTemplate(id)
}

async function removeClItem(id, itemId) {
  if (!confirm('Remove this checklist item from the template?')) return
  localClItems[id] = (localClItems[id] || []).filter(i => i.id !== itemId)
  await saveClTemplate(id)
}

function onClItemRename(id) {
  clearTimeout(_clRenameTimers[id])
  _clRenameTimers[id] = setTimeout(() => saveClTemplate(id), 800)
}

async function saveClTemplate(id) {
  const items = (localClItems[id] || [])
    .filter(i => i.name.trim())
    .map((i, idx) => ({ id: i.id, name: i.name.trim(), order: idx }))
  if (items.length === 0) {
    await checklistTemplatesStore.removeTemplate(id).catch(() => {})
  } else {
    await checklistTemplatesStore.saveTemplate(id, items)
  }
}

// drag-reorder for checklist items
function onClDragStart(phaseId, itemIdx, e) {
  clDragPhaseId.value = phaseId
  clDragSrcId.value   = itemIdx
  e.dataTransfer.effectAllowed = 'move'
}
function onClDragOver(phaseId, itemIdx) {
  if (clDragPhaseId.value === phaseId) clDragOverIdx.value = itemIdx
}
function onClDragLeave() { clDragOverIdx.value = null }
function onClDrop(phaseId, targetIdx) {
  const src = clDragSrcId.value
  if (src === null || src === targetIdx || clDragPhaseId.value !== phaseId) {
    clDragOverIdx.value = null; return
  }
  const items = localClItems[phaseId]
  const item  = items.splice(src, 1)[0]
  items.splice(targetIdx, 0, item)
  clDragSrcId.value = clDragPhaseId.value = clDragOverIdx.value = null
  saveClTemplate(phaseId)
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
    console.log('[PhaseSettings] saving phase config. defaultAssigneeIds:', clean.map(p => ({ id: p.id, assignee: p.defaultAssigneeId, subs: (p.subPhases || []).map(s => ({ id: s.id, assignee: s.defaultAssigneeId })) })))
    await phasesStore.saveConfig(clean, authStore.currentUser?.uid)
    console.log('[PhaseSettings] save complete.')
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

/* Each phase item (row + optional expanded panel) is a self-contained block */
.ps-phase-block { margin-bottom: 8px; }

.ps-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  cursor: grab;
  transition: background .15s;
}
.ps-row.ps-row-expanded {
  border-radius: var(--r) var(--r) 0 0;
  border-bottom: none;
}
.ps-row:active { cursor: grabbing; }
.ps-drag-over { border-color: var(--primary); background: var(--nav-active-bg); }

/* Groups assignee select + action buttons to the right */
.ps-row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: auto; }

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

.ps-name-input { flex: 1; max-width: 240px; min-width: 100px; background: var(--bg); }
.ps-assignee-select { width: 130px; flex-shrink: 0; font-size: 12px; min-width: 0; }
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
}
.ps-dynamic-panel {
  display: block !important;
}
.ps-dynamic-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--badge-pending-bg);
  color: var(--badge-pending-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.ps-lang-note {
  background: var(--badge-dev-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--badge-dev-text);
  margin-bottom: 12px;
}

.ps-sub-title { font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 8px; }
.ps-submode-wrap { margin-bottom: 12px; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; }
.ps-radio-opt { display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; padding: 3px 0; }
.ps-radio-opt input { margin: 0; cursor: pointer; }
.ps-sub-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }

/* Phase chips (Sub-phases / Checklist) */
.ps-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border: 1px solid var(--border); border-radius: 999px;
  background: var(--surface); color: var(--muted);
  font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: background .12s, color .12s, border-color .12s; font-family: inherit;
}
.ps-chip-icon { width: 13px; height: 13px; flex-shrink: 0; }
.ps-chip-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 16px; height: 16px; border-radius: 999px;
  color: #fff; font-size: 9px; font-weight: 700; padding: 0 4px; flex-shrink: 0;
}
/* Standalone checklist template card */
.ps-cl-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px;
  padding: 14px 16px; margin-top: 6px;
}
.ps-cl-item-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 6px; margin-bottom: 5px;
}

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
