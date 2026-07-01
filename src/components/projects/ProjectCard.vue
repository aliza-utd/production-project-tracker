<template>
  <div class="kb-card" @click="$emit('click')">

    <!-- Name row — when kanban, live date sits right-aligned on the same line -->
    <div :style="kanban ? 'display:flex;align-items:flex-start;justify-content:space-between;gap:6px' : ''">
      <div class="kb-name" :style="kanban ? 'flex:1;min-width:0' : ''">{{ project.name }}</div>
      <div v-if="kanban" class="kb-date" :style="[dateStyle, { fontSize:'10px', whiteSpace:'nowrap', flexShrink:'0', marginTop:'1px' }]">
        📅 {{ project.liveDate ? fmtDate(project.liveDate) : 'No live date' }}
      </div>
    </div>

    <!-- URL -->
    <div v-if="project.url" style="font-size:11px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      <a :href="project.url" target="_blank" class="ext" @click.stop style="color:var(--muted)">
        {{ truncateUrl(project.url) }}
      </a>
    </div>

    <!-- Platform + Type badges — hidden in kanban (redundant next to column header) -->
    <div v-if="!kanban" class="kb-meta" style="margin-top:6px">
      <span class="badge" :class="project.platform === 'WordPress' ? 'badge-wp' : 'badge-blogger'"
        style="font-size:11px;padding:1px 7px">
        {{ project.platform || '—' }}
      </span>
      <span v-if="project.projectType" class="pd-type-badge" style="font-size:11px">
        {{ projectTypeLabel(project.projectType) }}
      </span>
    </div>

    <!-- Language pills -->
    <div v-if="langPills.length" style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">
      <span v-for="l in langPills" :key="l" class="pd-lang-pill" style="font-size:11px">{{ l }}</span>
    </div>

    <!-- Assigned members: overlapping avatar stack in kanban, gapped row otherwise -->
    <div v-if="project.assignedMembers?.length" style="display:flex;margin-top:6px;align-items:center">
      <div
        v-for="(m, i) in project.assignedMembers" :key="m.id"
        class="pd-team-av"
        :style="{
          background:  avatarColor(m),
          width:       '24px',
          height:      '24px',
          fontSize:    '9px',
          marginLeft:  kanban && i > 0 ? '-6px' : (kanban ? '0' : i > 0 ? '4px' : '0'),
          border:      kanban ? '2px solid var(--surface)' : 'none',
          position:    kanban ? 'relative' : 'static',
          zIndex:      kanban ? String(project.assignedMembers.length - i) : 'auto',
        }"
      >
        {{ avatarInitials(m) }}
        <div class="pd-team-av-tip">{{ m.name }}</div>
      </div>
    </div>

    <!-- Site status + phase badges — hidden in kanban (column already shows the phase) -->
    <div v-if="!kanban" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center">
      <SiteStatusBadge :status="project.siteStatus || 'development'" style="font-size:10px" />
      <span
        v-for="info in phaseInfos" :key="info.id"
        class="kb-subphase"
        :style="'background:' + info.bg + ';color:' + info.color + ';border:none'"
      >
        <span style="width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block;margin-right:3px;flex-shrink:0"></span>
        {{ info.name }}
      </span>
    </div>

    <!-- Language status summary -->
    <div v-if="langStatusSummary" style="font-size:11px;color:var(--muted);margin-top:4px;line-height:1.4">
      {{ langStatusSummary }}
    </div>

    <!-- Live date at bottom — only in non-kanban mode (kanban shows it in the name row) -->
    <div v-if="!kanban" class="kb-date" :style="dateStyle">
      📅 {{ project.liveDate ? fmtDate(project.liveDate) : 'No live date' }}
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePhasesStore } from '@/stores/phases'
import { useTeamStore } from '@/stores/team'
import SiteStatusBadge from '@/components/shared/SiteStatusBadge.vue'

const props = defineProps({
  project:     { type: Object,  required: true },
  phaseConfig: { type: Array,   default: null },
  kanban:      { type: Boolean, default: false },
})
defineEmits(['click'])

const phasesStore = usePhasesStore()
const teamStore   = useTeamStore()
const cfg = computed(() => props.phaseConfig || phasesStore.phaseConfig)

function memberLookup(m) {
  return teamStore.teamMembers.find(tm => tm.id === m.id) || m
}
function avatarColor(m)    { const tm = memberLookup(m); return tm.avatarColor || '#6366f1' }
function avatarInitials(m) { const tm = memberLookup(m); return tm.initials || tm.avatarInitials || m.name?.[0] || '?' }

const langPills = computed(() => {
  const l = props.project.language
  if (!l) return []
  if (Array.isArray(l)) return l.filter(Boolean)
  return l.split(',').map(s => s.trim()).filter(Boolean)
})

const phaseInfos = computed(() => {
  const aps = props.project.activePhases
  const entries = (aps && aps.length) ? aps : [{ phase: props.project.currentPhase || 'kickstart', subPhase: null }]
  return entries.map(ap => {
    const ph = cfg.value.find(x => x.id === ap.phase)
    if (!ph) return { id: ap.phase, name: ap.phase || '—', color: '#6b7280', bg: '#f3f4f6' }
    if (ap.subPhase && ph.subPhases) {
      const sp = ph.subPhases.find(s => s.id === ap.subPhase)
      return { ...ph, name: `${ph.name}: ${sp ? sp.name : ap.subPhase}` }
    }
    return { ...ph }
  })
})

const LANG_STATUS_LABELS = {
  'live':          'Live',
  'in_production': 'In Production',
  'development':   'Development',
  'on-hold':       'On-Hold',
  'cancelled':     'Cancelled',
}

const langStatusSummary = computed(() => {
  const ls = props.project.langStatus
  if (!ls || Object.keys(ls).length < 2) return ''
  const groups = {}
  for (const [lang, status] of Object.entries(ls)) {
    const label = LANG_STATUS_LABELS[status] || status
    if (!groups[label]) groups[label] = []
    groups[label].push(lang)
  }
  return Object.entries(groups)
    .map(([label, langs]) => `${label} (${langs.join(', ')})`)
    .join(' · ')
})

const dateStyle = computed(() => {
  if (!props.project.liveDate) return { color: 'var(--muted)' }
  const diff = (new Date(props.project.liveDate + 'T00:00:00') - new Date()) / 86400000
  if (diff < 0)  return { color: 'var(--muted)' }
  if (diff < 7)  return { color: 'var(--danger)', fontWeight: '600' }
  if (diff < 14) return { color: '#d97706', fontWeight: '600' }
  return { color: '#16a34a' }
})

function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncateUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.length > 32 ? host.slice(0, 32) + '…' : host
  } catch {
    return url.length > 32 ? url.slice(0, 32) + '…' : url
  }
}

function projectTypeLabel(type) {
  const map = { new_site: 'New Site', redesign: 'Redesign', smart_blog: 'Smart Blog', others: 'Others', website: 'Website', blog: 'Blog', other: 'Others' }
  return map[type] || type || ''
}
</script>
