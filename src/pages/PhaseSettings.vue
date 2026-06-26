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

          <!-- Per-language toggle (parent level) -->
          <label class="ps-lang-toggle"
            :title="ph.languageDynamic ? 'All sub-phases duplicated per language' : 'Enable per-language mode'"
          >
            <input type="checkbox" v-model="ph.languageDynamic" style="margin:0">
            <span :style="ph.languageDynamic ? 'color:var(--primary);font-weight:600' : ''">Per-lang</span>
          </label>

          <!-- Sub-phases expand button -->
          <button class="btn btn-ghost btn-sm" style="white-space:nowrap" @click="toggleExpanded(idx)">
            <template v-if="ph.subPhases?.length">
              {{ ph.subPhases.length }} sub-phase{{ ph.subPhases.length !== 1 ? 's' : '' }}
            </template>
            <template v-else>+ Sub-phases</template>
            {{ expandedIdx === idx ? '▾' : '▸' }}
          </button>

          <!-- Delete phase -->
          <button class="btn-icon" style="color:var(--danger)" @click="removePhase(idx)" title="Delete phase">✕</button>
        </div>

        <!-- Sub-phases panel -->
        <div v-show="expandedIdx === idx" class="ps-sub-panel">

          <!-- Info banner when parent is languageDynamic -->
          <div v-if="ph.languageDynamic" class="ps-lang-note">
            🌐 All sub-phases below are templates — each will be duplicated per language in multi-language projects.
          </div>

          <div class="ps-sub-title">Sub-phases for <strong>{{ ph.name }}</strong></div>

          <div v-for="(sp, spIdx) in (ph.subPhases || [])" :key="sp.id" class="ps-sub-row">
            <input class="form-input" style="flex:1" v-model="sp.name" placeholder="Sub-phase name">
            <select class="form-select" style="width:110px" v-model="sp.type">
              <option value="">Type</option>
              <option value="content">Content</option>
              <option value="design">Design</option>
              <option value="dev">Dev</option>
              <option value="qa">QA</option>
            </select>
            <!-- Per-sub-phase language toggle (only meaningful when parent is NOT languageDynamic) -->
            <label v-if="!ph.languageDynamic"
              class="ps-lang-toggle"
              style="font-size:11px"
              :title="sp.languageDynamic ? 'Duplicated per language' : 'Duplicate this sub-phase per language'"
            >
              <input type="checkbox" v-model="sp.languageDynamic" style="margin:0">
              <span :style="sp.languageDynamic ? 'color:var(--primary);font-weight:600' : ''">Per-lang</span>
            </label>
            <button class="btn-icon" style="color:var(--danger)" @click="removeSubPhase(idx, spIdx)">✕</button>
          </div>

          <button class="btn btn-ghost btn-sm" style="margin-top:8px" @click="addSubPhase(idx)">+ Add Sub-phase</button>

          <!-- Preview (only shown if there are sub-phases and any are dynamic) -->
          <div
            v-if="(ph.subPhases || []).length && (ph.languageDynamic || ph.subPhases.some(sp => sp.languageDynamic))"
            class="ps-preview"
          >
            <div class="ps-preview-title">Preview (with NL, EN):</div>
            <div class="ps-preview-phase">{{ ph.name }}</div>
            <div
              v-for="item in previewSubPhases(ph)"
              :key="item.id"
              class="ps-preview-sp"
            >
              <span class="ps-preview-corner">└</span>
              <span v-if="item._lang" class="ps-preview-lang-pill"
                :style="{ background: ph.color + '22', color: ph.color }">{{ item._lang }}</span>
              {{ item.name }}
            </div>
          </div>

        </div><!-- end sub-phases panel -->

      </div><!-- end phase item -->
    </div><!-- end ps-list -->

    <!-- Add phase -->
    <button class="btn btn-secondary btn-sm" style="margin-top:12px" @click="addPhase">+ Add Phase</button>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { usePhasesStore }  from '@/stores/phases'
import { useAuthStore }    from '@/stores/auth'
import { usePhaseLogic }   from '@/composables/usePhaseLogic'

const phasesStore = usePhasesStore()
const authStore   = useAuthStore()
const { generateDynamicPhaseConfig } = usePhaseLogic()

const PREVIEW_LANGS = ['NL', 'EN']

const COLOR_SWATCHES = [
  '#6366f1','#8b5cf6','#a855f7','#ec4899','#ef4444',
  '#f97316','#f59e0b','#eab308','#10b981','#14b8a6',
  '#0ea5e9','#3b82f6','#6b7280','#374151',
]

const phases       = reactive([])
const saving       = ref(false)
const savedMsg     = ref(false)
const colorPickerIdx = ref(null)
const expandedIdx  = ref(null)
const dragSrcIdx   = ref(null)
const dragOverIdx  = ref(null)

function loadFromStore() {
  phases.length = 0
  phasesStore.phaseConfig.forEach(ph => {
    phases.push(JSON.parse(JSON.stringify(ph)))
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
    id:              Math.random().toString(36).slice(2),
    name:            'New Phase',
    color:           '#6366f1',
    subPhases:       [],
    languageDynamic: false,
    order:           phases.length,
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
    id:              Math.random().toString(36).slice(2),
    name:            '',
    type:            '',
    languageDynamic: false,
  })
}

function removeSubPhase(phaseIdx, spIdx) {
  phases[phaseIdx].subPhases.splice(spIdx, 1)
}

/** Generate a preview of sub-phases using PREVIEW_LANGS. */
function previewSubPhases(ph) {
  const expanded = generateDynamicPhaseConfig([ph], PREVIEW_LANGS)
  return expanded[0]?.subPhases || []
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
    const clean = phases.map((ph, i) => ({
      id:              ph.id,
      name:            ph.name,
      color:           ph.color,
      order:           i,
      languageDynamic: !!ph.languageDynamic,
      subPhases:       (ph.subPhases || [])
        .filter(sp => sp.name.trim())
        .map(sp => ({
          id:              sp.id,
          name:            sp.name,
          type:            sp.type || '',
          languageDynamic: !!sp.languageDynamic,
        })),
    }))
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

.ps-name-input { flex: 1; min-width: 0; }
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
