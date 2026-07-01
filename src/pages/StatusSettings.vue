<template>
  <div>
    <div style="margin-bottom:20px">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0 0 4px">Statuses</h1>
      <div style="font-size:13px;color:var(--muted)">
        Manage phase and checklist item statuses. Drag to reorder. Changes save immediately.
      </div>
    </div>

    <div v-if="!authStore.isManager" style="font-size:13px;color:var(--muted);padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r)">
      Status management is available to managers only.
    </div>

    <template v-else>
      <div class="ss-list">
        <div
          v-for="(st, sIdx) in stDraft"
          :key="st.id"
          class="ss-status-item"
        >
          <!-- Main row -->
          <div
            class="ss-row"
            :class="{
              'ss-drag-over':   stDragOverIdx === sIdx,
              'ss-row-expanded': openColorKey === sIdx,
            }"
            draggable="true"
            @dragstart="onStDragStart(sIdx, $event)"
            @dragover.prevent="onStDragOver(sIdx)"
            @dragleave="onStDragLeave"
            @drop.prevent="onStDrop(sIdx)"
          >
            <div class="ss-handle" title="Drag to reorder">⠿</div>

            <div
              class="ss-color-swatch"
              :style="{ background: st.baseColor, outline: openColorKey === sIdx ? '2px solid var(--primary)' : 'none', outlineOffset: '2px' }"
              @click="toggleColorPanel(sIdx)"
              title="Click to change color"
            ></div>

            <input
              class="form-input ss-name-input"
              v-model="st.name"
              placeholder="Status name"
              @blur="saveStEdit(st)"
              @keyup.enter="$event.target.blur()"
            >

            <span
              class="ph-status-badge"
              :class="'ph-st-' + st.id"
              style="pointer-events:none;min-width:76px;text-align:center;flex-shrink:0;font-size:11px"
            >{{ st.name }}</span>

            <label
              class="ss-complete-label"
              :title="st.isComplete ? 'This status marks phases as complete' : 'Set as the complete status'"
            >
              <input
                type="radio"
                name="ss-complete-grp"
                :checked="st.isComplete"
                @click="setStComplete(sIdx)"
                style="cursor:pointer;width:13px;height:13px;flex-shrink:0"
              >
              <span>Complete</span>
            </label>

            <button
              class="btn-icon"
              :style="{
                color:   st.isDefault ? 'var(--muted)' : 'var(--danger)',
                opacity: st.isDefault ? '.4' : '1',
                cursor:  st.isDefault ? 'not-allowed' : 'pointer',
              }"
              :title="st.isDefault ? 'Default statuses cannot be deleted' : 'Delete status'"
              @click="deleteStRow(st)"
            >✕</button>
          </div>

          <!-- Inline color picker (expands below the row) -->
          <div v-if="openColorKey === sIdx" class="ss-color-inline">
            <div class="ss-cp-presets">
              <div
                v-for="c in STATUS_SWATCHES"
                :key="c"
                class="ss-cp-preset"
                :style="{ background: c, outline: cpHexInput === c ? '2px solid #111' : 'none', outlineOffset: '1px' }"
                @click="applyPreset(c)"
              ></div>
            </div>

            <div class="ss-cp-gradient" :style="gradientStyle" @mousedown.prevent="startGradientDrag">
              <div class="ss-cp-thumb" :style="thumbStyle"></div>
            </div>

            <div class="ss-cp-hue" @mousedown.prevent="startHueDrag">
              <div class="ss-cp-hue-thumb" :style="{ left: (cpHue / 360 * 100) + '%', background: 'hsl(' + cpHue + ',100%,50%)' }"></div>
            </div>

            <div class="ss-cp-footer">
              <span style="font-size:11px;color:var(--muted);flex-shrink:0">Hex</span>
              <input
                class="form-input ss-cp-hex"
                v-model="cpHexInput"
                spellcheck="false"
                @blur="applyHex"
                @keyup.enter="$event.target.blur()"
              >
              <button class="btn btn-sm ss-cp-done" @click="closeColorPanel(sIdx)">Done</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Add new status -->
      <div style="margin-top:12px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <input
            class="form-input"
            style="max-width:190px;font-size:13px"
            placeholder="New status name…"
            v-model="newStName"
            @keyup.enter="addStRow"
          >
          <div
            class="ss-color-swatch"
            :style="{ background: newStColor, outline: openColorKey === 'new' ? '2px solid var(--primary)' : 'none', outlineOffset: '2px' }"
            @click="toggleColorPanel('new')"
            title="Pick color"
          ></div>
          <button
            class="btn btn-secondary btn-sm"
            :disabled="!newStName.trim() || stSaving"
            @click="addStRow"
          >+ Add Status</button>
        </div>

        <div v-if="openColorKey === 'new'" class="ss-color-inline" style="margin-top:8px;border-radius:var(--r);border-top:1px solid var(--border)">
          <div class="ss-cp-presets">
            <div
              v-for="c in STATUS_SWATCHES"
              :key="c"
              class="ss-cp-preset"
              :style="{ background: c, outline: cpHexInput === c ? '2px solid #111' : 'none', outlineOffset: '1px' }"
              @click="applyPreset(c)"
            ></div>
          </div>

          <div class="ss-cp-gradient" :style="gradientStyle" @mousedown.prevent="startGradientDrag">
            <div class="ss-cp-thumb" :style="thumbStyle"></div>
          </div>

          <div class="ss-cp-hue" @mousedown.prevent="startHueDrag">
            <div class="ss-cp-hue-thumb" :style="{ left: (cpHue / 360 * 100) + '%', background: 'hsl(' + cpHue + ',100%,50%)' }"></div>
          </div>

          <div class="ss-cp-footer">
            <span style="font-size:11px;color:var(--muted);flex-shrink:0">Hex</span>
            <input
              class="form-input ss-cp-hex"
              v-model="cpHexInput"
              spellcheck="false"
              @blur="applyHex"
              @keyup.enter="$event.target.blur()"
            >
            <button class="btn btn-sm ss-cp-done" @click="openColorKey = null">Done</button>
          </div>
        </div>
      </div>

      <div
        v-if="stMsg"
        style="margin-top:10px;padding:7px 13px;border-radius:var(--r);font-size:13px"
        :style="stMsgError
          ? 'background:#fef2f2;border:1px solid #fecaca;color:#dc2626'
          : 'background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a'"
      >{{ stMsg }}</div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useAuthStore }     from '@/stores/auth'
import { useStatusesStore } from '@/stores/statuses'
import { useProjectsStore } from '@/stores/projects'
import { deriveStatusColors } from '@/composables/useStatusStyles'

const authStore     = useAuthStore()
const statusesStore = useStatusesStore()
const projectsStore = useProjectsStore()

const STATUS_SWATCHES = [
  '#94a3b8','#f59e0b','#ef4444','#22c55e',
  '#6366f1','#8b5cf6','#ec4899','#f97316',
  '#10b981','#0ea5e9','#374151',
]

// ── State ─────────────────────────────────────────────────────────────────────
const stDraft       = ref([])
const stDragging    = ref(false)
const stDragSrc     = ref(null)
const stDragOverIdx = ref(null)
const newStName     = ref('')
const newStColor    = ref('#6366f1')
const stSaving      = ref(false)
const stMsg         = ref('')
const stMsgError    = ref(false)
let   _stMsgTimer   = null

watch(() => statusesStore.statuses, (val) => {
  if (!stDragging.value) stDraft.value = val.map(s => ({ ...s }))
}, { deep: true, immediate: true })

// ── Inline color picker ───────────────────────────────────────────────────────
const openColorKey = ref(null)   // null | row-index (number) | 'new'
const cpHue        = ref(0)      // 0–360
const cpSat        = ref(100)    // 0–100
const cpVal        = ref(100)    // 0–100
const cpHexInput   = ref('')

// ── Color math ────────────────────────────────────────────────────────────────
function hsvToRgb(h, s, v) {
  s /= 100; v /= 100
  const k = n => (n + h / 60) % 6
  const f = n => v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)))
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)]
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  if (h.length !== 6) return [0, 0, 0]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), diff = max - min
  let h = 0
  if (diff) {
    if (max === r)      h = ((g - b) / diff) % 6
    else if (max === g) h = (b - r) / diff + 2
    else                h = (r - g) / diff + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return [h, max ? Math.round(diff / max * 100) : 0, Math.round(max * 100)]
}
function hexToHsv(hex)  { return rgbToHsv(...hexToRgb(hex)) }
function currentHex()   { return rgbToHex(...hsvToRgb(cpHue.value, cpSat.value, cpVal.value)) }

const gradientStyle = computed(() => {
  const pureHue = rgbToHex(...hsvToRgb(cpHue.value, 100, 100))
  return {
    backgroundImage:
      `linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, ${pureHue})`,
  }
})

const thumbStyle = computed(() => ({
  left:       cpSat.value + '%',
  top:        (100 - cpVal.value) + '%',
  background: currentHex(),
}))

function initFromHex(hex) {
  const [h, s, v] = hexToHsv(hex)
  cpHue.value = h; cpSat.value = s; cpVal.value = v
  cpHexInput.value = hex
}

function syncOut() {
  const hex = currentHex()
  cpHexInput.value = hex
  if (openColorKey.value === 'new') {
    newStColor.value = hex
  } else {
    const idx = openColorKey.value
    if (idx !== null && stDraft.value[idx]) stDraft.value[idx].baseColor = hex
  }
}

function toggleColorPanel(key) {
  if (openColorKey.value === key) { openColorKey.value = null; return }
  openColorKey.value = key
  const hex = key === 'new'
    ? newStColor.value
    : (stDraft.value[key]?.baseColor || '#6366f1')
  initFromHex(hex)
}

function closeColorPanel(sIdx) {
  if (typeof sIdx === 'number' && stDraft.value[sIdx]) {
    saveStEdit(stDraft.value[sIdx])
  }
  openColorKey.value = null
}

function applyPreset(color) {
  initFromHex(color)
  syncOut()
  if (openColorKey.value !== 'new') {
    const idx = openColorKey.value
    if (idx !== null && stDraft.value[idx]) saveStEdit(stDraft.value[idx])
  }
}

function applyHex() {
  const raw = cpHexInput.value.trim()
  const hex = raw.startsWith('#') ? raw : '#' + raw
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    initFromHex(hex)
    syncOut()
    if (openColorKey.value !== 'new') {
      const idx = openColorKey.value
      if (idx !== null && stDraft.value[idx]) saveStEdit(stDraft.value[idx])
    }
  } else {
    cpHexInput.value = currentHex()
  }
}

// ── Gradient + hue drag ───────────────────────────────────────────────────────
let _gradientRect = null, _hueRect = null

function startGradientDrag(e) {
  _gradientRect = e.currentTarget.getBoundingClientRect()
  updateGradient(e.clientX, e.clientY)
  const onMove = ev => { ev.preventDefault(); updateGradient(ev.clientX, ev.clientY) }
  const onUp   = ()  => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup',   onUp)
    _gradientRect = null
    if (openColorKey.value !== 'new') {
      const idx = openColorKey.value
      if (idx !== null && stDraft.value[idx]) saveStEdit(stDraft.value[idx])
    }
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup',   onUp)
}
function updateGradient(cx, cy) {
  if (!_gradientRect) return
  const x = Math.max(0, Math.min(1, (cx - _gradientRect.left)  / _gradientRect.width))
  const y = Math.max(0, Math.min(1, (cy - _gradientRect.top)   / _gradientRect.height))
  cpSat.value = Math.round(x * 100)
  cpVal.value = Math.round((1 - y) * 100)
  syncOut()
}

function startHueDrag(e) {
  _hueRect = e.currentTarget.getBoundingClientRect()
  updateHue(e.clientX)
  const onMove = ev => { ev.preventDefault(); updateHue(ev.clientX) }
  const onUp   = ()  => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup',   onUp)
    _hueRect = null
    if (openColorKey.value !== 'new') {
      const idx = openColorKey.value
      if (idx !== null && stDraft.value[idx]) saveStEdit(stDraft.value[idx])
    }
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup',   onUp)
}
function updateHue(cx) {
  if (!_hueRect) return
  const x = Math.max(0, Math.min(1, (cx - _hueRect.left) / _hueRect.width))
  cpHue.value = Math.round(x * 360)
  syncOut()
}

// ── Drag-to-reorder ───────────────────────────────────────────────────────────
function onStDragStart(idx, evt) {
  openColorKey.value = null
  stDragging.value   = true
  stDragSrc.value    = idx
  evt.dataTransfer.effectAllowed = 'move'
}
function onStDragOver(idx)  { stDragOverIdx.value = idx }
function onStDragLeave()    { stDragOverIdx.value = null }

async function onStDrop(targetIdx) {
  const src = stDragSrc.value
  stDragOverIdx.value = null
  if (src === null || src === targetIdx) { stDragging.value = false; return }
  const arr = [...stDraft.value]
  const [moved] = arr.splice(src, 1)
  arr.splice(targetIdx, 0, moved)
  stDraft.value    = arr
  stDragging.value = false
  try {
    for (let i = 0; i < arr.length; i++) {
      await statusesStore.editStatus(arr[i].id, { order: i + 1 })
    }
  } catch (err) {
    showStMsg('Failed to save order: ' + (err.message || ''), true)
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
async function saveStEdit(st) {
  if (!st.id) return
  try {
    const derived = deriveStatusColors(st.baseColor)
    await statusesStore.editStatus(st.id, { name: st.name, baseColor: st.baseColor, ...derived })
  } catch (err) {
    showStMsg('Save failed: ' + (err.message || ''), true)
  }
}

async function setStComplete(targetIdx) {
  const target = stDraft.value[targetIdx]
  if (target.isComplete) return
  try {
    for (const s of stDraft.value) {
      if (s.isComplete) await statusesStore.editStatus(s.id, { isComplete: false })
    }
    await statusesStore.editStatus(target.id, { isComplete: true })
    showStMsg('Complete status updated.')
  } catch (err) {
    showStMsg('Failed to update: ' + (err.message || ''), true)
  }
}

function isStInUse(statusId) {
  return projectsStore.projects.some(proj => {
    for (const ph of Object.values(proj.phaseData || {})) {
      if (ph.status === statusId) return true
      for (const sp of Object.values(ph.subPhases || {})) {
        if (sp.status === statusId) return true
      }
    }
    for (const items of Object.values(proj.checklists || {})) {
      if (Array.isArray(items) && items.some(i => i.status === statusId)) return true
    }
    return false
  })
}

async function deleteStRow(st) {
  if (st.isDefault) { showStMsg('Default statuses cannot be deleted.', true); return }
  if (st.isComplete && stDraft.value.filter(s => s.isComplete).length <= 1) {
    showStMsg('Cannot delete: mark another status as Complete first.', true); return
  }
  if (isStInUse(st.id)) {
    const ok = window.confirm(
      `"${st.name}" is in use by existing projects or checklist items.\n\n` +
      `Those items will show an unrecognized status after deletion. Continue?`
    )
    if (!ok) return
  }
  openColorKey.value = null
  try {
    await statusesStore.removeStatus(st.id)
    showStMsg(`"${st.name}" deleted.`)
  } catch (err) {
    showStMsg('Delete failed: ' + (err.message || ''), true)
  }
}

async function addStRow() {
  const name = newStName.value.trim()
  if (!name) return
  stSaving.value = true
  try {
    const color    = newStColor.value
    const derived  = deriveStatusColors(color)
    const maxOrder = Math.max(0, ...stDraft.value.map(s => s.order || 0))
    await statusesStore.addStatus({
      name, baseColor: color, ...derived,
      order: maxOrder + 1, isComplete: false, isDefault: false,
    })
    newStName.value    = ''
    newStColor.value   = '#6366f1'
    openColorKey.value = null
    showStMsg(`"${name}" added.`)
  } catch (err) {
    showStMsg('Add failed: ' + (err.message || ''), true)
  } finally {
    stSaving.value = false
  }
}

function showStMsg(msg, isError = false) {
  stMsg.value = msg; stMsgError.value = isError
  clearTimeout(_stMsgTimer)
  _stMsgTimer = setTimeout(() => { stMsg.value = ''; stMsgError.value = false }, 3500)
}
</script>

<style scoped>
.ss-list { display: flex; flex-direction: column; gap: 6px; }

.ss-status-item { display: flex; flex-direction: column; }

.ss-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  cursor: grab;
  transition: background .15s, border-radius .1s;
}
.ss-row:active   { cursor: grabbing; }
.ss-drag-over    { border-color: var(--primary); background: var(--nav-active-bg); }
.ss-row-expanded {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
}

.ss-handle { font-size: 18px; color: var(--muted); cursor: grab; flex-shrink: 0; }

.ss-color-swatch {
  width: 24px; height: 24px; border-radius: 6px;
  cursor: pointer; border: 2px solid transparent; flex-shrink: 0;
  transition: transform .1s;
}
.ss-color-swatch:hover { transform: scale(1.15); }

/* ── Inline color picker ──────────────────────────────────────────────── */
.ss-color-inline {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--r) var(--r);
  padding: 12px 14px 14px;
  cursor: default;
}

.ss-cp-presets { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }

.ss-cp-preset {
  width: 20px; height: 20px; border-radius: 50%;
  cursor: pointer; transition: transform .1s;
}
.ss-cp-preset:hover { transform: scale(1.2); }

.ss-cp-gradient {
  width: 100%;
  height: 120px;
  position: relative;
  cursor: crosshair;
  border-radius: 4px;
  margin-bottom: 8px;
  user-select: none;
}

.ss-cp-thumb {
  position: absolute;
  width: 12px; height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.ss-cp-hue {
  width: 100%;
  height: 12px;
  border-radius: 6px;
  position: relative;
  cursor: ew-resize;
  margin-bottom: 10px;
  user-select: none;
  background: linear-gradient(to right,
    hsl(0,100%,50%), hsl(30,100%,50%), hsl(60,100%,50%),
    hsl(90,100%,50%), hsl(120,100%,50%), hsl(150,100%,50%),
    hsl(180,100%,50%), hsl(210,100%,50%), hsl(240,100%,50%),
    hsl(270,100%,50%), hsl(300,100%,50%), hsl(330,100%,50%),
    hsl(360,100%,50%));
}

.ss-cp-hue-thumb {
  position: absolute;
  top: 50%;
  width: 16px; height: 16px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgba(0,0,0,.4);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.ss-cp-footer { display: flex; align-items: center; gap: 8px; }

.ss-cp-hex {
  flex: 1;
  max-width: 110px;
  font-size: 12px;
  font-family: monospace;
}

.ss-cp-done {
  background: var(--primary);
  color: #fff;
  border: none;
  font-size: 12px;
  padding: 4px 14px;
}
.ss-cp-done:hover { opacity: .85; }

.ss-name-input { flex: 1; max-width: 220px; min-width: 90px; background: var(--bg); }

.ss-complete-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 12px; color: var(--muted);
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
}
</style>
