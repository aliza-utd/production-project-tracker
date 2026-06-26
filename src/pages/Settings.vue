<template>
  <div class="content" style="max-width:720px">

    <h1 style="font-size:20px;font-weight:700;margin-bottom:24px;color:var(--text)">Settings</h1>

    <!-- Appearance -->
    <div class="set-section">
      <div class="set-section-title">Appearance</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:14px;font-weight:500">Dark Mode</div>
          <div style="font-size:12px;color:var(--muted)">Toggle between light and dark theme</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="toggleTheme">
          {{ isDark ? '☀️ Light Mode' : '🌙 Dark Mode' }}
        </button>
      </div>
    </div>

    <!-- Data -->
    <div class="set-section">
      <div class="set-section-title">Data</div>
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

    <!-- Data Migration (Manager only) -->
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

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore }      from '@/stores/auth'
import { useProjectsStore }  from '@/stores/projects'
import { usePhasesStore }    from '@/stores/phases'
import { useTeamStore }      from '@/stores/team'
import {
  migrateTeamMembersToFirestore,
  migrateProjectsToFirestore,
  migrateWeeklyTrackerToFirestore,
  migrateWeeklyDevNotesToFirestore,
  savePhaseConfigToFirestore,
} from '@/firebase-service'
import { DEFAULT_PHASE_CONFIG as DEFAULT_PHASES } from '@/stores/phases'

const authStore     = useAuthStore()
const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const teamStore     = useTeamStore()

const isDark     = ref(document.body.classList.contains('dark'))
const importMsg  = ref('')
const importError = ref(false)

function toggleTheme() {
  isDark.value = !isDark.value
  if (isDark.value) {
    document.body.classList.add('dark')
    localStorage.setItem('pt_theme', 'dark')
  } else {
    document.body.classList.remove('dark')
    localStorage.setItem('pt_theme', 'light')
  }
}

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
      importMsg.value  = '✓ File parsed successfully. Use Migration buttons to import to Firestore.'
      importError.value = false
    } catch {
      importMsg.value  = 'Invalid JSON file.'
      importError.value = true
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

// ── Migration helpers ─────────────────────────────────────────────────────────
const migrations = reactive([
  {
    key:     'team',
    label:   'Team Members',
    desc:    'Migrate pt_team from localStorage to Firestore team_members collection',
    hasData: false,
    running: false,
  },
  {
    key:     'phases',
    label:   'Phase Config',
    desc:    'Migrate pt_phases from localStorage to Firestore phase_config collection',
    hasData: false,
    running: false,
  },
  {
    key:     'projects',
    label:   'Projects',
    desc:    'Migrate pt_projects from localStorage to Firestore projects collection',
    hasData: false,
    running: false,
  },
  {
    key:     'weeklyTracker',
    label:   'Weekly Tracker',
    desc:    'Migrate pt_weekly from localStorage to Firestore weekly_tracker collection',
    hasData: false,
    running: false,
  },
  {
    key:     'devNotes',
    label:   'Developer Notes',
    desc:    'Migrate pt_devnotes from localStorage to Firestore weekly_dev_notes collection',
    hasData: false,
    running: false,
  },
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
      const raw = JSON.parse(localStorage.getItem('pt_team') || '[]')
      await migrateTeamMembersToFirestore(raw)
    } else if (key === 'phases') {
      const raw = JSON.parse(localStorage.getItem('pt_phases') || '[]')
      const phases = raw.length ? raw : DEFAULT_PHASES
      await savePhaseConfigToFirestore(phases, authStore.currentUser?.uid)
    } else if (key === 'projects') {
      const raw = JSON.parse(localStorage.getItem('pt_projects') || '[]')
      await migrateProjectsToFirestore(raw)
    } else if (key === 'weeklyTracker') {
      const raw = JSON.parse(localStorage.getItem('pt_weekly') || '{}')
      await migrateWeeklyTrackerToFirestore(raw)
    } else if (key === 'devNotes') {
      const raw = JSON.parse(localStorage.getItem('pt_devnotes') || '{}')
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

onMounted(checkLegacyData)
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
</style>
