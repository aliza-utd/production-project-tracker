<template>
  <div class="content">

    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h1 style="font-size:20px;font-weight:700;color:var(--text)">Settings</h1>
      <NotificationBell />
    </div>

    <!-- Tab bar -->
    <div class="app-tab-bar">
      <button :class="['app-tab', { active: activeTab === 'data' }]" @click="activeTab = 'data'">Data</button>
      <button :class="['app-tab', { active: activeTab === 'phases' }]" @click="activeTab = 'phases'">Phases</button>
      <button :class="['app-tab', { active: activeTab === 'links' }]" @click="activeTab = 'links'">Links</button>
      <button :class="['app-tab', { active: activeTab === 'status' }]" @click="activeTab = 'status'">Status</button>
      <button :class="['app-tab', { active: activeTab === 'weekly' }]" @click="activeTab = 'weekly'">Weekly notes</button>
    </div>

    <!-- Data -->
    <template v-if="activeTab === 'data'">
      <div style="max-width:720px">
        <div class="set-section">
          <div class="set-section-title">Backup &amp; Restore</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" @click="exportData">⬇ Export Backup (JSON)</button>
            <label class="btn btn-secondary btn-sm" style="cursor:pointer">
              ⬆ Import JSON
              <input type="file" accept=".json" style="display:none" @change="importData">
            </label>
          </div>
          <div v-if="importMsg" style="font-size:13px;margin-top:8px"
            :style="importError ? 'color:var(--danger)' : 'color:#16a34a'">
            {{ importMsg }}
          </div>
        </div>

        <div v-if="authStore.isManager" class="set-section">
          <div class="set-section-title">Data Migration</div>
          <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:var(--r);padding:12px;margin-bottom:16px;font-size:13px;color:#92400e">
            ⚠️ Run each migration once only. Migrations move data from localStorage to Firestore. Only needed for legacy data.
          </div>
          <div v-for="mig in migrations" :key="mig.key" class="set-mig-row">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:500">{{ mig.label }}</div>
              <div style="font-size:12px;color:var(--muted)">{{ mig.desc }}</div>
            </div>
            <button class="btn btn-secondary btn-sm" :disabled="mig.running || !mig.hasData"
              @click="runMigration(mig.key)">
              <span v-if="mig.running">⏳ Migrating…</span>
              <span v-else-if="!mig.hasData" style="color:var(--muted)">✓ No legacy data</span>
              <span v-else>☁️ Migrate</span>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Phases -->
    <template v-if="activeTab === 'phases'">
      <PhaseSettings />
    </template>

    <!-- Links -->
    <template v-if="activeTab === 'links'">
      <div style="max-width:720px">
        <div class="set-section">
          <div class="set-section-title">Link Templates</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.6">
            Default links instantiated on each new project. Changes only affect new projects — existing project links are not updated.
          </div>
          <div v-if="!linkTemplatesStore.loaded" style="font-size:13px;color:var(--muted)">Loading…</div>
          <template v-else>
            <div v-for="(tpl, idx) in linkTemplatesStore.templates" :key="tpl.id" class="wnf-row">
              <input
                class="form-input wnf-name-input"
                :defaultValue="tpl.name"
                @blur="ltRename(tpl.id, $event)"
                @keyup.enter="$event.target.blur()"
              />
              <button class="btn-icon" :disabled="idx === 0" @click="linkTemplatesStore.moveTemplate(idx, -1)" title="Move up">↑</button>
              <button class="btn-icon" :disabled="idx === linkTemplatesStore.templates.length - 1" @click="linkTemplatesStore.moveTemplate(idx, 1)" title="Move down">↓</button>
              <button class="btn-icon" style="color:var(--danger)" @click="ltRemove(tpl.id)" title="Remove">✕</button>
            </div>
            <div v-if="!linkTemplatesStore.templates.length"
              style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:10px">
              No link templates configured.
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <input
                class="form-input"
                style="flex:1;font-size:13px"
                v-model="newLinkTemplateName"
                placeholder="New link name…"
                @keyup.enter="ltAdd"
              />
              <button class="btn btn-secondary btn-sm" @click="ltAdd" :disabled="!newLinkTemplateName.trim()">
                + Add Link
              </button>
            </div>
          </template>
        </div>

        <div class="set-section">
          <div class="set-section-title">Bulk sync</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.6">
            Push missing link templates to every active project. Existing links and URLs are never changed — only absent templates are added.
          </div>
          <button class="btn btn-secondary btn-sm" :disabled="bulkSyncing || !linkTemplatesStore.loaded"
            @click="bulkSyncLinks">
            {{ bulkSyncing ? '⏳ Syncing…' : '⟳ Apply to All Projects' }}
          </button>
          <div v-if="bulkSyncResult" style="margin-top:12px;font-size:13px;line-height:1.7">
            <span style="color:#16a34a;font-weight:500">Done.</span>
            {{ bulkSyncResult.updated }} project{{ bulkSyncResult.updated !== 1 ? 's' : '' }} updated,
            {{ bulkSyncResult.alreadyOk }} already had all templates.
          </div>
        </div>
      </div>
    </template>

    <!-- Status -->
    <template v-if="activeTab === 'status'">
      <StatusSettings />
    </template>

    <!-- Weekly notes -->
    <template v-if="activeTab === 'weekly'">
      <div style="max-width:720px">
        <div v-if="authStore.currentUser?.permissions?.isAdmin" class="set-section">
          <div class="set-section-title">Weekly Notes Fields</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.6">
            Controls the fields shown on each member's standup card.
            Removing a field hides it from cards but does not delete historical data already saved under it.
          </div>
          <div v-if="!wnFieldsStore.loaded" style="font-size:13px;color:var(--muted)">Loading…</div>
          <template v-else>
            <div v-for="(field, idx) in wnFieldsStore.fields" :key="field.id" class="wnf-row">
              <span v-if="field.isDefault" class="wnf-default-chip">Default</span>
              <input
                class="form-input wnf-name-input"
                :defaultValue="field.name"
                @blur="wnfRename(field.id, $event)"
                @keyup.enter="$event.target.blur()"
              />
              <button class="btn-icon" :disabled="idx === 0" @click="wnfMove(idx, -1)" title="Move up">↑</button>
              <button class="btn-icon" :disabled="idx === wnFieldsStore.fields.length - 1" @click="wnfMove(idx, 1)" title="Move down">↓</button>
              <button class="btn-icon" style="color:var(--danger)" @click="wnfRemove(field)" title="Remove field">✕</button>
            </div>
            <div v-if="!wnFieldsStore.fields.length"
              style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:10px">
              No fields configured.
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
              <input
                class="form-input"
                style="flex:1;font-size:13px"
                v-model="newFieldName"
                placeholder="New field name…"
                @keyup.enter="wnfAddField"
              />
              <button class="btn btn-secondary btn-sm" @click="wnfAddField" :disabled="!newFieldName.trim()">
                + Add Field
              </button>
            </div>
          </template>
        </div>

        <div v-if="authStore.currentUser?.permissions?.canEditAllNotes" class="set-section">
          <div class="set-section-title">Weekly Notes Edit Requests</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px">
            Team members can request edit access to their own past-week standup cards.
          </div>
          <div v-if="pendingRequests.length === 0"
            style="font-size:13px;color:var(--muted);font-style:italic">
            No pending requests.
          </div>
          <div v-for="req in pendingRequests" :key="req.id" class="set-mig-row">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:500">{{ req.userName }}</div>
              <div style="font-size:12px;color:var(--muted)">{{ req.weekLabel || req.week }}</div>
            </div>
            <button class="btn btn-sm er-approve-btn" @click="approveRequest(req)">Approve</button>
            <button class="btn btn-sm er-deny-btn"    @click="denyRequest(req)">Deny</button>
          </div>
        </div>

        <div v-if="!authStore.currentUser?.permissions?.isAdmin && !authStore.currentUser?.permissions?.canEditAllNotes"
          class="set-section">
          <p style="font-size:13px;color:var(--muted);margin:0">No weekly notes settings available for your role.</p>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore }              from '@/stores/auth'
import { useProjectsStore }          from '@/stores/projects'
import { usePhasesStore }            from '@/stores/phases'
import { useTeamStore }              from '@/stores/team'
import { useWeeklyNotesFieldsStore } from '@/stores/weeklyNotesFields'
import { useLinkTemplatesStore }     from '@/stores/linkTemplates'
import {
  migrateTeamMembersToFirestore,
  migrateProjectsToFirestore,
  migrateWeeklyTrackerToFirestore,
  migrateWeeklyDevNotesToFirestore,
  savePhaseConfigToFirestore,
  subscribeToPendingEditRequests,
  respondToWeeklyNotesEditRequest,
  createNotification,
} from '@/firebase-service'
import { DEFAULT_PHASE_CONFIG as DEFAULT_PHASES } from '@/stores/phases'
import PhaseSettings  from '@/pages/PhaseSettings.vue'
import StatusSettings from '@/pages/StatusSettings.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const route               = useRoute()
const authStore           = useAuthStore()
const projectsStore       = useProjectsStore()
const phasesStore         = usePhasesStore()
const teamStore           = useTeamStore()
const wnFieldsStore       = useWeeklyNotesFieldsStore()
const linkTemplatesStore  = useLinkTemplatesStore()

const activeTab   = ref(['data','phases','links','status','weekly'].includes(route.query.tab) ? route.query.tab : 'data')
const importMsg   = ref('')
const importError = ref(false)

function exportData() {
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
  a.download = `pt-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      JSON.parse(ev.target.result)
      importMsg.value   = '✓ File parsed successfully. Use Migration buttons to import to Firestore.'
      importError.value = false
    } catch {
      importMsg.value   = 'Invalid JSON file.'
      importError.value = true
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

const migrations = reactive([
  { key: 'team',          label: 'Team Members',   desc: 'Migrate pt_team from localStorage to Firestore team_members collection',         hasData: false, running: false },
  { key: 'phases',        label: 'Phase Config',    desc: 'Migrate pt_phases from localStorage to Firestore phase_config collection',       hasData: false, running: false },
  { key: 'projects',      label: 'Projects',        desc: 'Migrate pt_projects from localStorage to Firestore projects collection',         hasData: false, running: false },
  { key: 'weeklyTracker', label: 'Weekly Tracker',  desc: 'Migrate pt_weekly from localStorage to Firestore weekly_tracker collection',     hasData: false, running: false },
  { key: 'devNotes',      label: 'Developer Notes', desc: 'Migrate pt_devnotes from localStorage to Firestore weekly_dev_notes collection', hasData: false, running: false },
])

function checkLegacyData() {
  migrations[0].hasData = !!localStorage.getItem('pt_team')
  migrations[1].hasData = !!localStorage.getItem('pt_phases')
  migrations[2].hasData = !!localStorage.getItem('pt_projects')
  migrations[3].hasData = !!localStorage.getItem('pt_weekly')
  migrations[4].hasData = !!localStorage.getItem('pt_devnotes')
}

async function runMigration(key) {
  const mig = migrations.find(m => m.key === key)
  if (!mig) return
  mig.running = true
  try {
    if (key === 'team') {
      await migrateTeamMembersToFirestore(JSON.parse(localStorage.getItem('pt_team') || '[]'))
    } else if (key === 'phases') {
      const raw = JSON.parse(localStorage.getItem('pt_phases') || '[]')
      await savePhaseConfigToFirestore(raw.length ? raw : DEFAULT_PHASES, authStore.currentUser?.uid)
    } else if (key === 'projects') {
      await migrateProjectsToFirestore(JSON.parse(localStorage.getItem('pt_projects') || '[]'))
    } else if (key === 'weeklyTracker') {
      await migrateWeeklyTrackerToFirestore(JSON.parse(localStorage.getItem('pt_weekly') || '{}'))
    } else if (key === 'devNotes') {
      const raw       = JSON.parse(localStorage.getItem('pt_devnotes') || '{}')
      const memberMap = Object.fromEntries(teamStore.teamMembers.map(m => [m.id, m.name]))
      await migrateWeeklyDevNotesToFirestore(raw, memberMap)
    }
    mig.hasData = false
    alert(`✓ ${mig.label} migration complete.`)
  } catch (err) {
    alert(`Migration failed: ${err.message}`)
  } finally {
    mig.running = false
  }
}

const newFieldName        = ref('')
const renamingSaving      = ref(false)
const newLinkTemplateName = ref('')

async function ltAdd() {
  const name = newLinkTemplateName.value.trim()
  if (!name) return
  await linkTemplatesStore.addTemplate(name)
  newLinkTemplateName.value = ''
}

async function ltRename(id, event) {
  const name = (event.target.value || '').trim()
  if (!name) { event.target.value = linkTemplatesStore.templates.find(t => t.id === id)?.name || ''; return }
  await linkTemplatesStore.renameTemplate(id, name).catch(() => {})
}

async function ltRemove(id) {
  if (!confirm('Remove this link template? Existing project links are not affected.')) return
  await linkTemplatesStore.removeTemplate(id)
}

function uidShort() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36) }

function buildSyncedLinks(existing, templates) {
  const templateNames = new Set(templates.map(t => t.name.toLowerCase()))
  const matched = (existing || []).filter(l => templateNames.has(l.name.toLowerCase()))
  const custom  = (existing || []).filter(l => !templateNames.has(l.name.toLowerCase()))
  const merged  = templates.map(tpl => {
    const found = matched.find(l => l.name.toLowerCase() === tpl.name.toLowerCase())
    return found
      ? { ...found, order: tpl.order }
      : { id: uidShort(), name: tpl.name, url: '', order: tpl.order }
  })
  const maxOrder = templates.reduce((m, t) => Math.max(m, t.order || 0), 0)
  custom.forEach((l, i) => merged.push({ ...l, order: maxOrder + i + 1 }))
  return merged
}

function projectNeedsSync(project, templates) {
  const existingNames = new Set((project.links || []).map(l => l.name.toLowerCase()))
  return templates.some(t => !existingNames.has(t.name.toLowerCase()))
}

const bulkSyncing    = ref(false)
const bulkSyncResult = ref(null)  // { updated, alreadyOk } | null

async function bulkSyncLinks() {
  const templates = linkTemplatesStore.templates
  if (!templates.length) { alert('No link templates configured.'); return }
  const projects = projectsStore.projects
  if (!projects.length) { alert('No projects loaded.'); return }
  if (!confirm(`Apply missing link templates to all ${projects.length} active projects?\n\nThis will add any missing template entries (with blank URLs) to every project. Existing links and URLs are never changed.`)) return

  bulkSyncing.value    = true
  bulkSyncResult.value = null
  let updated = 0, alreadyOk = 0
  const now = new Date().toISOString()

  for (const project of projects) {
    if (!projectNeedsSync(project, templates)) { alreadyOk++; continue }
    const merged = buildSyncedLinks(project.links, templates)
    await projectsStore.updateProject(project.id, { links: merged, updatedAt: now }).catch(e =>
      console.error(`[BulkSync] Failed for ${project.id}:`, e)
    )
    updated++
  }

  bulkSyncing.value    = false
  bulkSyncResult.value = { updated, alreadyOk }
}

async function wnfAddField() {
  const name = newFieldName.value.trim()
  if (!name) return
  await wnFieldsStore.addField(name)
  newFieldName.value = ''
}

async function wnfRename(id, event) {
  const name = (event.target.value || '').trim()
  if (!name) { event.target.value = wnFieldsStore.fields.find(f => f.id === id)?.name || ''; return }
  renamingSaving.value = true
  await wnFieldsStore.updateField(id, { name }).catch(() => {})
  renamingSaving.value = false
}

async function wnfMove(idx, dir) {
  const arr  = [...wnFieldsStore.fields]
  const dest = idx + dir
  if (dest < 0 || dest >= arr.length) return
  const a = arr[idx]
  const b = arr[dest]
  await Promise.all([
    wnFieldsStore.updateField(a.id, { order: b.order }),
    wnFieldsStore.updateField(b.id, { order: a.order }),
  ])
}

async function wnfRemove(field) {
  if (!confirm(`Remove "${field.name}"?\n\nHistorical standup data saved under this field is NOT deleted — it stays in Firestore but won't be shown on cards.`)) return
  await wnFieldsStore.removeField(field.id)
}

const pendingRequests   = ref([])
let   unsubEditRequests = null

async function approveRequest(req) {
  await respondToWeeklyNotesEditRequest(req.id, 'approved', authStore.currentUser?.name || '')
  createNotification({ userId: req.userId, type: 'weekly_notes_request_approved', message: `Your edit request for ${req.weekLabel || req.week} was approved`, weekKey: req.week, read: false }).catch(() => {})
}

async function denyRequest(req) {
  await respondToWeeklyNotesEditRequest(req.id, 'denied', authStore.currentUser?.name || '')
  createNotification({ userId: req.userId, type: 'weekly_notes_request_denied', message: `Your edit request for ${req.weekLabel || req.week} was denied`, weekKey: req.week, read: false }).catch(() => {})
}

onMounted(() => {
  checkLegacyData()
  wnFieldsStore.fetchFields()
  linkTemplatesStore.fetchTemplates()
  if (authStore.currentUser?.permissions?.canEditAllNotes) {
    unsubEditRequests = subscribeToPendingEditRequests((snap) => {
      pendingRequests.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    })
  }
})

onUnmounted(() => { if (unsubEditRequests) unsubEditRequests() })
</script>

<style scoped>
.set-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px;
  margin-bottom: 16px;
}
.set-section-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--muted);
  margin-bottom: 14px;
}
.set-mig-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}
.set-mig-row:last-child { border-bottom: none; }
.wnf-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}
.wnf-row:last-of-type { border-bottom: none; }
.wnf-name-input { flex: 1; font-size: 13px; }
.er-approve-btn { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
.er-approve-btn:hover { background: #dcfce7; }
.er-deny-btn    { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.er-deny-btn:hover { background: #fee2e2; }
.wnf-default-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--badge-dev-bg);
  color: var(--badge-dev-text);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
