<template>
  <div class="content">

    <!-- Manager guard -->
    <div v-if="!authStore.isManager"
      style="text-align:center;padding:80px;color:var(--muted)">
      <div style="font-size:32px;margin-bottom:12px">🔒</div>
      <div style="font-size:15px;font-weight:600">Manager access required</div>
    </div>

    <template v-else>
      <!-- Page header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">Reports</h1>
        <NotificationBell />
      </div>

      <!-- Controls -->
      <div class="rpt-controls">
        <div class="rpt-date-row">
          <label class="form-label" style="margin-bottom:0">From</label>
          <input type="date" class="form-input" v-model="dateFrom" style="width:160px">
          <label class="form-label" style="margin-bottom:0">To</label>
          <input type="date" class="form-input" v-model="dateTo" style="width:160px">
        </div>
        <div class="rpt-toggles">
          <label class="rpt-toggle-item">
            <input type="checkbox" v-model="showByPhase"> Projects by Phase
          </label>
          <label class="rpt-toggle-item">
            <input type="checkbox" v-model="showUpcoming"> Upcoming Deadlines
          </label>
          <label class="rpt-toggle-item">
            <input type="checkbox" v-model="showStatus"> By Status
          </label>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" @click="generateReport">Generate</button>
          <button class="btn btn-secondary btn-sm" @click="printReport" :disabled="!reportHtml">🖨 Print</button>
          <button class="btn btn-secondary btn-sm" @click="copyReport" :disabled="!reportHtml">📋 Copy HTML</button>
          <button class="btn btn-secondary btn-sm" @click="exportJson">⬇ Export JSON</button>
        </div>
      </div>

      <!-- Preview -->
      <div v-if="reportHtml" class="rpt-preview">
        <div class="rpt-preview-hdr">Report Preview</div>
        <div v-html="reportHtml" class="rpt-html-content"></div>
      </div>
      <div v-else style="text-align:center;padding:48px;color:var(--muted);font-size:14px">
        Configure the report above and click Generate.
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useProjectsStore }  from '@/stores/projects'
import { usePhasesStore }    from '@/stores/phases'
import { useTeamStore }      from '@/stores/team'
import { useAuthStore }      from '@/stores/auth'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const teamStore     = useTeamStore()
const authStore     = useAuthStore()

const now   = new Date()
const start = new Date(now.getFullYear(), now.getMonth(), 1)
const end30 = new Date(now); end30.setDate(end30.getDate() + 30)

const dateFrom   = ref(start.toISOString().slice(0, 10))
const dateTo     = ref(end30.toISOString().slice(0, 10))
const showByPhase  = ref(true)
const showUpcoming = ref(true)
const showStatus   = ref(true)
const reportHtml   = ref('')

const active = computed(() =>
  projectsStore.projects.filter(p => p.siteStatus !== 'cancelled' && !p.archived)
)

function generateReport() {
  const from = dateFrom.value ? new Date(dateFrom.value + 'T00:00:00') : null
  const to   = dateTo.value   ? new Date(dateTo.value   + 'T23:59:59') : null
  const inRange = (p) => {
    const d = p.kickstartDate || p.liveDate
    if (!d) return true
    const pd = new Date(d + 'T00:00:00')
    if (from && pd < from) return false
    if (to   && pd > to  ) return false
    return true
  }
  const ranged = active.value.filter(inRange)

  let html = `<h2 style="margin:0 0 16px">Report: ${fmtDate(dateFrom.value)} – ${fmtDate(dateTo.value)}</h2>`

  if (showByPhase.value) {
    html += `<h3 style="margin:20px 0 8px">Projects by Phase</h3>`
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px">`
    html += `<thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb">Phase</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #e5e7eb">Count</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #e5e7eb">%</th></tr></thead><tbody>`
    for (const ph of phasesStore.phaseConfig) {
      const count = ranged.filter(p => {
        const aps = p.activePhases?.length ? p.activePhases : [{ phase: p.currentPhase }]
        return aps.some(ap => ap.phase === ph.id)
      }).length
      const pct = ranged.length ? Math.round(count / ranged.length * 100) : 0
      html += `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${ph.color};margin-right:6px"></span>${ph.name}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb">${count}</td>
        <td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb">${pct}%</td></tr>`
    }
    html += `</tbody></table>`
  }

  if (showStatus.value) {
    const statusGroups = { development: 0, live: 0, 'on-hold': 0 }
    ranged.forEach(p => { if (p.siteStatus in statusGroups) statusGroups[p.siteStatus]++ })
    html += `<h3 style="margin:20px 0 8px">By Status</h3>`
    html += `<table style="width:100%;border-collapse:collapse;font-size:13px">`
    html += `<thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb">Status</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #e5e7eb">Count</th></tr></thead><tbody>`
    for (const [st, cnt] of Object.entries(statusGroups)) {
      html += `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-transform:capitalize">${st.replace('-', ' ')}</td><td style="text-align:right;padding:6px 8px;border-bottom:1px solid #e5e7eb">${cnt}</td></tr>`
    }
    html += `</tbody></table>`
  }

  if (showUpcoming.value) {
    const upcoming = active.value
      .filter(p => {
        if (!p.liveDate) return false
        const d = new Date(p.liveDate + 'T00:00:00')
        return d >= now && d <= end30
      })
      .sort((a, b) => a.liveDate.localeCompare(b.liveDate))
    html += `<h3 style="margin:20px 0 8px">Upcoming Deadlines (next 30 days)</h3>`
    if (!upcoming.length) {
      html += `<p style="color:#6b7280;font-size:13px">No upcoming deadlines.</p>`
    } else {
      html += `<table style="width:100%;border-collapse:collapse;font-size:13px">`
      html += `<thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb">Project</th><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb">Developer</th><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #e5e7eb">Live Date</th></tr></thead><tbody>`
      upcoming.forEach(p => {
        html += `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${p.name}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${p.developer || '—'}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${fmtDate(p.liveDate)}</td></tr>`
      })
      html += `</tbody></table>`
    }
  }

  reportHtml.value = html
}

function fmtDate(s) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function printReport() {
  const win = window.open('', '_blank')
  win.document.write(`<html><head><title>Report</title><style>body{font-family:sans-serif;padding:32px;max-width:900px;margin:0 auto}table{border-collapse:collapse}@media print{button{display:none}}</style></head><body>${reportHtml.value}<script>window.print()<\/script></body></html>`)
  win.document.close()
}

async function copyReport() {
  await navigator.clipboard.writeText(reportHtml.value)
}

function exportJson() {
  const data = {
    exportedAt: new Date().toISOString(),
    projects:   projectsStore.projects,
    team:       teamStore.teamMembers,
    phases:     phasesStore.phaseConfig,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `pt-export-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.rpt-controls {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 16px 20px;
  margin-bottom: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}
.rpt-date-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rpt-toggles  { display: flex; gap: 16px; flex-wrap: wrap; }
.rpt-toggle-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; color: var(--text);
}

.rpt-preview {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
}
.rpt-preview-hdr {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  margin-bottom: 16px;
}
.rpt-html-content { font-size: 14px; color: var(--text); line-height: 1.6; }
</style>
