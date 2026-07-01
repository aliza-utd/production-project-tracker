const HEADERS = [
  'Project Name', 'Site URL', 'Original URL', 'Platform', 'Type',
  'Language(s)', 'Developer(s)', 'Kickstart Date', 'Live Date',
  'Site Status', 'Current Phase',
  'Kickstart Status', 'Setup Status', 'Production Status', 'QA Status',
  'Go-Live Status', 'Activation Status',
  'Total Hours', 'Phase Notes', 'Google Sheet Links',
]

const TYPE_LABELS = {
  new_site: 'New Site', redesign: 'Redesign', smart_blog: 'Smart Blog',
  others: 'Others', website: 'Website', blog: 'Blog', other: 'Others',
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s.length > 10 ? s : s + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function phaseIdByName(phaseConfig, name) {
  const n = name.toLowerCase()
  const ph = phaseConfig.find(p => p.name.toLowerCase().includes(n))
  return ph?.id || null
}

function phaseStatus(project, phId) {
  if (!phId) return ''
  return project.phaseData?.[phId]?.status || 'not-started'
}

function currentPhaseName(project, phaseConfig) {
  const ph = phaseConfig.find(p => p.id === project.currentPhase)
  if (!ph) return project.currentPhase || ''
  if (project.currentSubPhase && ph.subPhases) {
    const sp = ph.subPhases.find(s => s.id === project.currentSubPhase)
    return sp ? `${ph.name}: ${sp.name}` : ph.name
  }
  return ph.name
}

function developers(project) {
  if (project.assignedMembers?.length) {
    return project.assignedMembers.map(m => m.name).join(', ')
  }
  return project.developer || ''
}

function totalHours(project) {
  const pd = project.phaseData || {}
  let total = 0
  for (const ph of Object.values(pd)) {
    total += (ph.timeLogs || []).reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
    if (ph.subPhases) {
      for (const sp of Object.values(ph.subPhases)) {
        total += (sp.timeLogs || []).reduce((s, l) => s + (parseFloat(l.hours) || 0), 0)
      }
    }
  }
  return total > 0 ? total.toFixed(1) : '0'
}

function phaseNotes(project, phaseConfig) {
  const pd = project.phaseData || {}
  const notes = []
  for (const [phId, ph] of Object.entries(pd)) {
    if (ph.notes?.trim()) {
      const name = phaseConfig.find(p => p.id === phId)?.name || phId
      notes.push(`${name}: ${ph.notes.trim()}`)
    }
  }
  return notes.join(' | ')
}

function sheetsUrls(project) {
  const src = project.links?.length ? project.links : (project.googleSheets || [])
  return src.filter(l => l.url).map(l => l.url).join(' | ')
}

function getPhaseIds(phaseConfig) {
  return {
    kickstart:  phaseIdByName(phaseConfig, 'kickstart'),
    setup:      phaseIdByName(phaseConfig, 'setup'),
    production: phaseIdByName(phaseConfig, 'production'),
    qa:         phaseIdByName(phaseConfig, 'qa'),
    golive:     phaseIdByName(phaseConfig, 'go-live') || phaseIdByName(phaseConfig, 'go live') || phaseIdByName(phaseConfig, 'golive'),
    activation: phaseIdByName(phaseConfig, 'activation'),
  }
}

function buildRow(project, phaseConfig, pids) {
  return [
    project.name || '',
    project.url || '',
    project.originalSite || '',
    project.platform || '',
    TYPE_LABELS[project.projectType] || project.projectType || '',
    project.language || '',
    developers(project),
    fmtDate(project.kickstartDate),
    fmtDate(project.liveDate),
    project.siteStatus || '',
    currentPhaseName(project, phaseConfig),
    phaseStatus(project, pids.kickstart),
    phaseStatus(project, pids.setup),
    phaseStatus(project, pids.production),
    phaseStatus(project, pids.qa),
    phaseStatus(project, pids.golive),
    phaseStatus(project, pids.activation),
    totalHours(project),
    phaseNotes(project, phaseConfig),
    sheetsUrls(project),
  ]
}

function csvCell(val) {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function tsvCell(val) {
  return String(val ?? '').replace(/\t/g, ' ').replace(/\n|\r/g, ' ')
}

export function buildCSV(projects, phaseConfig) {
  const pids = getPhaseIds(phaseConfig)
  const rows = projects.map(p => buildRow(p, phaseConfig, pids))
  return [HEADERS.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n')
}

export function buildTSV(projects, phaseConfig) {
  const pids = getPhaseIds(phaseConfig)
  const rows = projects.map(p => buildRow(p, phaseConfig, pids))
  return [HEADERS.join('\t'), ...rows.map(r => r.map(tsvCell).join('\t'))].join('\n')
}

export function downloadCSV(projects, phaseConfig) {
  const csv = buildCSV(projects, phaseConfig)
  const today = new Date().toISOString().slice(0, 10)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `projects-export-${today}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function copyTSV(projects, phaseConfig) {
  return navigator.clipboard.writeText(buildTSV(projects, phaseConfig))
}
