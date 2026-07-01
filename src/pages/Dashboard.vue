<template>
  <div class="content">

    <!-- Page header with notification bell -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <NotificationBell />
    </div>

    <!-- KPI Cards -->
    <div class="dash-stats">
      <div class="stat-card">
        <div class="stat-num">{{ activeCount }}</div>
        <div class="stat-lbl">Active Projects</div>
      </div>
      <div class="stat-card stat-live">
        <div class="stat-num">{{ liveCount }}</div>
        <div class="stat-lbl">Live Sites</div>
      </div>
      <div class="stat-card stat-warn">
        <div class="stat-num">{{ deadlinesThisWeek }}</div>
        <div class="stat-lbl">Deadlines This Week</div>
      </div>
      <div class="stat-card stat-danger">
        <div class="stat-num">{{ overdueCount }}</div>
        <div class="stat-lbl">Overdue</div>
      </div>
    </div>

    <div class="dash-body">

      <!-- Projects by Phase -->
      <div class="dash-card">
        <div class="dash-card-title">Projects by Phase</div>
        <div v-if="!phasesStore.phaseConfig.length" style="color:var(--muted);font-size:13px">
          No phases configured.
        </div>
        <div v-for="ph in phasesStore.phaseConfig" :key="ph.id" style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:13px;display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0"
                :style="'background:' + ph.color"></span>
              {{ ph.name }}
            </span>
            <span style="font-size:12px;color:var(--muted)">{{ countByPhase(ph.id) }}</span>
          </div>
          <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden">
            <div style="height:100%;border-radius:4px;transition:width .4s"
              :style="{ width: pctByPhase(ph.id) + '%', background: ph.color }"></div>
          </div>
        </div>
      </div>

      <!-- Time Calculator -->
      <div class="dash-card" style="align-self:start">
        <TimeCalcWidget />
      </div>

      <!-- Notifications -->
      <div class="dash-card">
        <div class="dash-card-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Notifications</span>
          <span v-if="notifStore.unreadCount > 0"
            style="font-size:11px;background:var(--primary);color:#fff;border-radius:10px;padding:1px 8px">
            {{ notifStore.unreadCount }} unread
          </span>
        </div>
        <div v-if="!recentNotifs.length" style="color:var(--muted);font-size:13px">
          No unread notifications.
        </div>
        <div v-for="n in recentNotifs" :key="n.id"
          style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:13px">{{ n.message }}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:3px">{{ fmtDate(n.createdAt) }}</div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useProjectsStore }     from '@/stores/projects'
import { usePhasesStore }       from '@/stores/phases'
import { useNotificationsStore } from '@/stores/notifications'
import TimeCalcWidget from '@/components/shared/TimeCalcWidget.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'

const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const notifStore    = useNotificationsStore()

const active = computed(() =>
  projectsStore.projects.filter(p => p.siteStatus !== 'cancelled')
)

const activeCount       = computed(() => active.value.length)
const liveCount         = computed(() => projectsStore.projects.filter(p => p.siteStatus === 'live').length)
const deadlinesThisWeek = computed(() => {
  const now  = Date.now()
  const week = 7 * 86400000
  return active.value.filter(p => {
    const dates = [p.previewDate, p.deliveryDate, p.deadline].filter(Boolean)
    return dates.some(d => {
      const diff = new Date(d + 'T00:00:00') - now
      return diff >= 0 && diff <= week
    })
  }).length
})
const overdueCount = computed(() =>
  active.value.filter(p => p.liveDate && new Date(p.liveDate + 'T00:00:00') < new Date()).length
)

function countByPhase(phaseId) {
  return active.value.filter(p => {
    const aps = p.activePhases?.length ? p.activePhases : [{ phase: p.currentPhase }]
    return aps.some(ap => ap.phase === phaseId)
  }).length
}

function pctByPhase(phaseId) {
  const total = active.value.length
  if (!total) return 0
  return Math.round((countByPhase(phaseId) / total) * 100)
}

const recentNotifs = computed(() =>
  notifStore.notifications.filter(n => !n.read).slice(0, 5)
)

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<style scoped>
.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
@media (max-width: 900px) { .dash-stats { grid-template-columns: repeat(2, 1fr); } }

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px 24px;
}
.stat-num  { font-size: 32px; font-weight: 700; color: var(--text); line-height: 1; margin-bottom: 6px; }
.stat-lbl  { font-size: 13px; color: var(--muted); }
.stat-live   .stat-num { color: #16a34a; }
.stat-warn   .stat-num { color: #d97706; }
.stat-danger .stat-num { color: var(--danger); }

.dash-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 900px) { .dash-body { grid-template-columns: 1fr; } }

.dash-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 20px;
}
.dash-card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text);
}
</style>
