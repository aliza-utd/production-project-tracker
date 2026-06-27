export function usePhaseLogic() {
  function uid() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
  }

  function isoToDateInput(iso) {
    if (!iso) return ''
    return iso.slice(0, 10)
  }

  function fmtDateShort(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function fmtHours(h) {
    const n = parseFloat(h) || 0
    return (n % 1 === 0 ? n : n.toFixed(1)) + 'h'
  }

  function deepCopy(v) {
    return JSON.parse(JSON.stringify(v ?? null))
  }

  function emptyPhaseEntry() {
    return {
      status: 'not-started',
      assignedTo: null,
      dateStarted: null,
      dateCompleted: null,
      notes: '',
      checklist: [],
      timeLogs: [],
    }
  }

  function ensurePhaseEntry(phaseData, phaseId, subId) {
    if (!phaseData[phaseId]) phaseData[phaseId] = emptyPhaseEntry()
    if (subId) {
      if (!phaseData[phaseId].subPhases) phaseData[phaseId].subPhases = {}
      if (!phaseData[phaseId].subPhases[subId]) {
        phaseData[phaseId].subPhases[subId] = emptyPhaseEntry()
      }
    }
  }

  function getPhaseStatus(phaseData, phaseId) {
    return phaseData?.[phaseId]?.status || 'not-started'
  }

  function getSubPhaseStatus(phaseData, phaseId, subId) {
    return phaseData?.[phaseId]?.subPhases?.[subId]?.status || 'not-started'
  }

  function applyStatus(entry, status) {
    const now = new Date().toISOString()
    entry.status = status
    if ((status === 'active' || status === 'blocked') && !entry.dateStarted) {
      entry.dateStarted = now
    }
    if (status === 'done') {
      if (!entry.dateStarted)   entry.dateStarted   = now
      if (!entry.dateCompleted) entry.dateCompleted = now
    }
    if (status === 'not-started') {
      entry.dateStarted   = null
      entry.dateCompleted = null
    }
  }

  function calculatePhaseHours(phaseId, phaseConfig, phaseData) {
    const direct = (phaseData?.[phaseId]?.timeLogs || [])
      .reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
    const phDef  = (phaseConfig || []).find(p => p.id === phaseId)
    if (!phDef?.subPhases?.length) return direct
    const subTotal = phDef.subPhases.reduce((s, sp) => {
      return s + (phaseData?.[phaseId]?.subPhases?.[sp.id]?.timeLogs || [])
        .reduce((ss, l) => ss + (parseFloat(l.hours) || 0), 0)
    }, 0)
    return direct + subTotal
  }

  function autoCompletePreviousPhases(targetPhaseId, phaseData, phaseConfig) {
    const order = phaseConfig.map(p => p.id)
    const tidx  = order.indexOf(targetPhaseId)
    if (tidx < 0) return
    order.forEach((id, i) => {
      if (!phaseData[id]) return
      if (i < tidx) {
        phaseData[id].status = 'done'
        const ph = phaseConfig.find(p => p.id === id)
        if (ph?.subPhases) {
          ph.subPhases.forEach(sp => {
            if (phaseData[id]?.subPhases?.[sp.id]) {
              phaseData[id].subPhases[sp.id].status = 'done'
            }
          })
        }
      } else if (i === tidx && phaseData[id].status === 'not-started') {
        phaseData[id].status = 'active'
      }
    })
  }

  function ptDateRange(entry) {
    if (!entry || entry.status === 'not-started') return ''
    const start = entry.dateStarted   ? fmtDateShort(entry.dateStarted)   : ''
    const end   = entry.dateCompleted ? fmtDateShort(entry.dateCompleted) : ''
    if (start && end) return `${start} – ${end}`
    if (start)        return `${start} –`
    return ''
  }

  function computeActivePhases(phaseData, phaseConfig) {
    const active = []
    phaseConfig.forEach(ph => {
      if (phaseData?.[ph.id]?.status === 'active') {
        active.push({ phase: ph.id, subPhase: null })
      }
    })
    const primary = active[0] || null
    return {
      activePhases:    active,
      currentPhase:    primary?.phase    || null,
      currentSubPhase: primary?.subPhase || null,
    }
  }

  // Normalise a string to a safe Firestore key: lowercase letters, digits, underscore only.
  function sanitizeId(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_|_$/g, '')
  }

  // Language sub-task template (applied per additional language).
  const LANG_SUBTASKS = [
    { suffix: 'development',      label: 'Development' },
    { suffix: 'qa_initial',       label: 'QA Initial' },
    { suffix: 'qa_golive',        label: 'QA Go-Live' },
    { suffix: 'qa_live_checking', label: 'QA Live Checking' },
  ]

  /**
   * Builds sub-phase definitions for the Languages phase card.
   * Uses template (from ph.subPhaseTemplate) when provided, else falls back to LANG_SUBTASKS.
   */
  function generateLanguageSubDefs(additionalLanguages, template) {
    const taskDefs = (template && template.length)
      ? template.map(t => ({ suffix: t.id, label: t.name }))
      : LANG_SUBTASKS
    const defs = []
    for (const lang of (additionalLanguages || [])) {
      const key = sanitizeId(lang)
      for (const { suffix, label } of taskDefs) {
        defs.push({ id: `${key}_${suffix}`, name: `${lang} — ${label}` })
      }
    }
    return defs
  }

  /**
   * Builds the initial phaseData entry for the Languages phase.
   * Accepts an optional template array to determine sub-task IDs.
   */
  function generateLanguagePhaseData(additionalLanguages, template) {
    const taskDefs = (template && template.length)
      ? template.map(t => ({ suffix: t.id }))
      : LANG_SUBTASKS
    const subPhases = {}
    for (const lang of (additionalLanguages || [])) {
      const key = sanitizeId(lang)
      for (const { suffix } of taskDefs) {
        subPhases[`${key}_${suffix}`] = emptyPhaseEntry()
      }
    }
    const entry = emptyPhaseEntry()
    entry.subPhases = subPhases
    return entry
  }

  /**
   * Returns the per-project phase config:
   *  - Languages phase excluded when additionalLanguages is empty.
   *  - Languages phase gets subPhases injected using subPhaseTemplate from the def.
   *  - All other phases returned as-is.
   */
  function generateDynamicPhaseConfig(phaseConfig, additionalLanguages) {
    const langs = additionalLanguages || []
    return phaseConfig
      .filter(ph => ph.id !== 'languages' || langs.length > 0)
      .map(ph => {
        if (ph.id !== 'languages') return ph
        return { ...ph, subPhases: generateLanguageSubDefs(langs, ph.subPhaseTemplate) }
      })
  }

  return {
    uid,
    isoToDateInput,
    fmtDateShort,
    fmtHours,
    deepCopy,
    emptyPhaseEntry,
    ensurePhaseEntry,
    getPhaseStatus,
    getSubPhaseStatus,
    applyStatus,
    calculatePhaseHours,
    autoCompletePreviousPhases,
    ptDateRange,
    computeActivePhases,
    sanitizeId,
    generateLanguageSubDefs,
    generateLanguagePhaseData,
    generateDynamicPhaseConfig,
  }
}
