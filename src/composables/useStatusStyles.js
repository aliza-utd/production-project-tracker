import { watch } from 'vue'
import { useStatusesStore } from '@/stores/statuses'

let _styleEl = null

function ensureStyleEl() {
  if (!_styleEl || !document.getElementById('dynamic-status-styles')) {
    _styleEl = document.getElementById('dynamic-status-styles')
    if (!_styleEl) {
      _styleEl = document.createElement('style')
      _styleEl.id = 'dynamic-status-styles'
      document.head.appendChild(_styleEl)
    }
  }
  return _styleEl
}

function generateCSS(statuses) {
  let css = ''
  for (const st of statuses) {
    const id = st.id
    const lb = st.lightBg   || '#f3f4f6'
    const lt = st.lightText || '#374151'
    const db = st.darkBg    || '#1c1e22'
    const dt = st.darkText  || '#d1d5db'

    // Used on <select> in PhaseCard, PhaseListView (with .ph-list-status-sel override),
    // and checklist item selects. All share the .ph-st-{id} class.
    css += `.ph-st-${id}{background:${lb}!important;color:${lt}!important;border-color:transparent!important}\n`
    // List-view status select gets a visible neutral border to match the
    // adjacent assignee select; all other select uses are border-free.
    css += `.ph-list-status-sel.ph-st-${id}{background:${lb}!important;border-color:var(--border)!important;color:${lt}!important}\n`
    // Phase Progress sidebar widget
    css += `.pd-pp-badge[data-st="${id}"]{background:${lb}!important;color:${lt}!important}\n`
    css += `.pd-pp-icon[data-st="${id}"]{color:${lt}!important}\n`

    // Dark mode overrides
    css += `.dark .ph-st-${id}{background:${db}!important;color:${dt}!important;border-color:transparent!important}\n`
    css += `.dark .ph-list-status-sel.ph-st-${id}{background:${db}!important;border-color:var(--border)!important;color:${dt}!important}\n`
    css += `.dark .pd-pp-badge[data-st="${id}"]{background:${db}!important;color:${dt}!important}\n`
    css += `.dark .pd-pp-icon[data-st="${id}"]{color:${dt}!important}\n`
  }
  return css
}

export function useStatusStyles() {
  const statusesStore = useStatusesStore()

  watch(
    () => statusesStore.statuses,
    (statuses) => {
      if (!statuses.length) return
      ensureStyleEl().textContent = generateCSS(statuses)
    },
    { deep: true, immediate: true }
  )
}

// Derives light/dark tint+text pairs from a single base hex color.
// Used by the status editor when an admin picks or changes a color.
export function deriveStatusColors(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) hex = '#6366f1'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return {
    // Light bg: 14% color blended with white
    lightBg:   `#${h(r * 0.14 + 255 * 0.86)}${h(g * 0.14 + 255 * 0.86)}${h(b * 0.14 + 255 * 0.86)}`,
    // Light text: color darkened to ~52%
    lightText: `#${h(r * 0.52)}${h(g * 0.52)}${h(b * 0.52)}`,
    // Dark bg: 20% color blended with dark surface (#1C1E22 = 28,30,34)
    darkBg:    `#${h(r * 0.20 + 28 * 0.80)}${h(g * 0.20 + 30 * 0.80)}${h(b * 0.20 + 34 * 0.80)}`,
    // Dark text: color lightened to ~62% toward white
    darkText:  `#${h(r * 0.38 + 255 * 0.62)}${h(g * 0.38 + 255 * 0.62)}${h(b * 0.38 + 255 * 0.62)}`,
  }
}
