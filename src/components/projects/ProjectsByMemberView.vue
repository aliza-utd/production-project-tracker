<template>
  <div>
    <div v-if="loading"
      style="display:flex;align-items:center;justify-content:center;padding:60px;gap:12px;color:var(--muted)">
      <span style="font-size:22px;animation:spin 1s linear infinite">⏳</span>
      <span>Loading projects…</span>
    </div>

    <div v-else-if="!visibleMembers.length" class="empty">
      <div class="empty-icon">👥</div>
      <div class="empty-title">No team members</div>
      <div class="empty-desc">No team members match the current role filter.</div>
    </div>

    <div v-else class="kanban-wrap">
      <div v-for="member in visibleMembers" :key="member.id" class="kb-col">
        <!-- Column header -->
        <div class="kb-col-hdr" style="background:var(--bg);border-radius:var(--r) var(--r) 0 0;border-bottom:1px solid var(--border)">
          <div class="kb-col-title" style="gap:7px;min-width:0;overflow:hidden">
            <div class="avatar avatar-sm" style="flex-shrink:0;font-size:10px;font-weight:700;color:#fff"
              :style="{ background: member.avatarColor || '#6366f1' }">
              {{ member.initials || member.name?.[0] || '?' }}
            </div>
            <span style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              {{ member.name }}
            </span>
          </div>
          <span class="kb-count" style="flex-shrink:0">{{ projectsByMember[member.id]?.length || 0 }}</span>
        </div>

        <!-- Project cards -->
        <div class="kb-cards">
          <div
            v-for="p in projectsByMember[member.id]"
            :key="p.id"
            class="kb-card"
            style="cursor:pointer"
            :class="{ urgent: isUrgent(p.liveDate) }"
            @click="$emit('open-project', p)"
          >
            <div class="kb-name">{{ p.name }}</div>

            <!-- Phase badges -->
            <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">
              <span
                v-for="info in phaseInfos(p)"
                :key="info.id"
                class="badge"
                :style="'background:' + info.bg + ';color:' + info.color"
              >
                <span class="phase-dot" :style="'background:' + info.color"></span>
                {{ info.name }}
              </span>
            </div>

            <!-- Live Date -->
            <div v-if="p.liveDate" class="kb-date" :style="liveDateStyle(p.liveDate)" style="margin-top:6px">
              📅 {{ fmtDate(p.liveDate) }}
            </div>

            <!-- Preview Date (only if upcoming) -->
            <div v-if="isUpcoming(p.previewDate)" style="font-size:11px;color:var(--muted);margin-top:3px">
              👁 Preview: {{ fmtDate(p.previewDate) }}
            </div>
          </div>

          <div v-if="!projectsByMember[member.id]?.length" class="kb-empty">No projects</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore }  from '@/stores/auth'
import { usePhasesStore } from '@/stores/phases'

const props = defineProps({
  projects:    { type: Array,   default: () => [] },
  phaseConfig: { type: Array,   default: () => [] },
  teamMembers: { type: Array,   default: () => [] },
  loading:     { type: Boolean, default: false },
  roleFilter:  { type: String,  default: 'all' },
})
defineEmits(['open-project'])

const authStore   = useAuthStore()
const phasesStore = usePhasesStore()

// Role ordering: managers first, then developers, multimedia, qa, external
const ROLE_ORDER = { admin: 0, manager: 0, developer: 1, multimedia: 2, qa: 3, external: 4 }

const canViewAll = computed(() =>
  authStore.currentUser?.permissions?.canViewAllProjects !== false
)

// All active members sorted by role order, then alphabetically within each role
const sortedMembers = computed(() =>
  [...props.teamMembers]
    .filter(m => m.active !== false)
    .sort((a, b) => {
      const oa = ROLE_ORDER[a.roleId] ?? 5
      const ob = ROLE_ORDER[b.roleId] ?? 5
      if (oa !== ob) return oa - ob
      return (a.name || '').localeCompare(b.name || '')
    })
)

// Precompute projects per member once, keyed by member id
const projectsByMember = computed(() => {
  const map = {}
  for (const m of sortedMembers.value) {
    const mid = m.id
    map[mid] = props.projects.filter(p => {
      const ids = [
        p.leadDeveloperId,
        ...(Array.isArray(p.developersInvolvedIds) ? p.developersInvolvedIds : []),
        p.webServicesAssigneeId,
        p.multimediaAssigneeId,
        p.qaAssigneeId,
      ].filter(Boolean)
      const amIds = (p.assignedMembers || []).map(am => am.id)
      return ids.includes(mid) || amIds.includes(mid)
    })
  }
  return map
})

const visibleMembers = computed(() => {
  if (!canViewAll.value) {
    // Non-managers see only their own column
    const myId = authStore.currentUser?.memberId
    if (!myId) return []
    return sortedMembers.value.filter(m => m.id === myId)
  }
  return sortedMembers.value.filter(m => {
    // Apply role filter; always show all matching members regardless of project count
    if (props.roleFilter === 'developer'  && m.roleId !== 'developer')  return false
    if (props.roleFilter === 'multimedia' && m.roleId !== 'multimedia') return false
    if (props.roleFilter === 'qa'         && m.roleId !== 'qa')         return false
    return true
  })
})

// ── Display helpers ──────────────────────────────────────────────────────────

function phaseInfos(proj) {
  const cfg = props.phaseConfig.length ? props.phaseConfig : phasesStore.phaseConfig
  const aps = proj.activePhases
  const entries = (aps && aps.length) ? aps : [{ phase: proj.currentPhase || 'kickstart', subPhase: null }]
  return entries.map(ap => {
    const ph = cfg.find(x => x.id === ap.phase)
    if (!ph) return { id: ap.phase, name: ap.phase || '—', color: '#6b7280', bg: '#f3f4f6' }
    if (ap.subPhase && ph.subPhases) {
      const sp = ph.subPhases.find(s => s.id === ap.subPhase)
      return { ...ph, name: `${ph.name}: ${sp ? sp.name : ap.subPhase}` }
    }
    return { ...ph }
  })
}

function isUpcoming(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr + 'T00:00:00') >= new Date()
}

function isUrgent(dateStr) {
  if (!dateStr) return false
  const diff = new Date(dateStr + 'T00:00:00') - new Date()
  return diff >= 0 && diff <= 7 * 86400000
}

function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function liveDateStyle(d) {
  if (!d) return { color: 'var(--muted)' }
  const diff = (new Date(d + 'T00:00:00') - new Date()) / 86400000
  if (diff < 0)  return { color: 'var(--muted)' }
  if (diff < 7)  return { color: 'var(--danger)', fontWeight: '600' }
  if (diff < 14) return { color: '#d97706', fontWeight: '600' }
  return { color: '#16a34a' }
}
</script>
