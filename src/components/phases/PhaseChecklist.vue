<template>
  <div class="pc-wrap">
    <div v-if="siteStatus === 'live'" class="pc-banner pc-banner-live">
      ✓ This site is live. Phase history is read-only.
    </div>
    <div v-if="siteStatus === 'on-hold'" class="pc-banner pc-banner-hold">
      ⚠ Project is On-Hold. Phases are locked.
    </div>

    <template v-for="ph in phaseConfig" :key="'pc-' + ph.id">
      <!-- Main phase row -->
      <div class="pc-row" @click="$emit('scroll-to-phase', ph.id)">
        <span class="pc-icon" :class="iconClass(phStatus(ph.id))">
          {{ iconChar(phStatus(ph.id)) }}
        </span>
        <span class="pc-name">{{ ph.name }}</span>
        <span class="pc-av-wrap">
          <template v-if="phAssignee(ph.id)">
            <span class="pc-av" :style="{ background: phAssignee(ph.id).avatarColor || '#6366f1' }">
              {{ phAssignee(ph.id).initials }}
              <span class="pc-av-tip">{{ phAssignee(ph.id).name }}</span>
            </span>
          </template>
          <span v-else class="pc-av-empty"></span>
        </span>
        <span class="pc-badge" :class="badgeClass(phStatus(ph.id))">
          {{ statusLabel(phStatus(ph.id)) }}
        </span>
        <span class="pc-date">{{ mainDateRange(ph.id) }}</span>
      </div>

      <!-- Sub-phase rows -->
      <template v-if="ph.subPhases && ph.subPhases.length">
        <div
          v-for="sp in ph.subPhases"
          :key="'pc-sp-' + ph.id + sp.id"
          class="pc-row pc-row-sub"
          @click="$emit('scroll-to-phase', ph.id)"
        >
          <span class="pc-sub-corner">└</span>
          <span class="pc-icon" :class="iconClass(spStatus(ph.id, sp.id))">
            {{ iconChar(spStatus(ph.id, sp.id)) }}
          </span>
          <span class="pc-name pc-name-sub">{{ sp.name }}</span>
          <span class="pc-av-wrap">
            <template v-if="spAssignee(ph.id, sp.id)">
              <span class="pc-av" :style="{ background: spAssignee(ph.id, sp.id).avatarColor || '#6366f1' }">
                {{ spAssignee(ph.id, sp.id).initials }}
                <span class="pc-av-tip">{{ spAssignee(ph.id, sp.id).name }}</span>
              </span>
            </template>
            <span v-else class="pc-av-empty"></span>
          </span>
          <span class="pc-badge" :class="badgeClass(spStatus(ph.id, sp.id))">
            {{ statusLabel(spStatus(ph.id, sp.id)) }}
          </span>
          <span class="pc-date">{{ subDateRange(ph.id, sp.id) }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { usePhaseLogic } from '@/composables/usePhaseLogic'

const props = defineProps({
  phaseData:   { type: Object, default: () => ({}) },
  phaseConfig: { type: Array,  default: () => [] },
  teamMembers: { type: Array,  default: () => [] },
  siteStatus:  { type: String, default: '' },
  readonly:    { type: Boolean, default: false },
})
defineEmits(['scroll-to-phase'])

const { ptDateRange } = usePhaseLogic()

const STATUS = {
  'not-started': { icon: '○', label: 'Not Started', iconCls: 'pc-icon-ns',      badgeCls: 'pc-badge-ns'      },
  'active':      { icon: '◉', label: 'Active',      iconCls: 'pc-icon-active',  badgeCls: 'pc-badge-active'  },
  'blocked':     { icon: '⊘', label: 'Blocked',     iconCls: 'pc-icon-blocked', badgeCls: 'pc-badge-blocked' },
  'done':        { icon: '✓', label: 'Done',         iconCls: 'pc-icon-done',    badgeCls: 'pc-badge-done'    },
}

function cfg(s)         { return STATUS[s] || STATUS['not-started'] }
function iconChar(s)    { return cfg(s).icon }
function iconClass(s)   { return cfg(s).iconCls }
function statusLabel(s) { return cfg(s).label }
function badgeClass(s)  { return cfg(s).badgeCls }

function phStatus(phId)        { return props.phaseData?.[phId]?.status || 'not-started' }
function spStatus(phId, spId)  { return props.phaseData?.[phId]?.subPhases?.[spId]?.status || 'not-started' }

function memberById(id) {
  return id ? (props.teamMembers.find(m => m.id === id) || null) : null
}
function phAssignee(phId)       { return memberById(props.phaseData?.[phId]?.assignedTo) }
function spAssignee(phId, spId) { return memberById(props.phaseData?.[phId]?.subPhases?.[spId]?.assignedTo) }

function mainDateRange(phId)       { return ptDateRange(props.phaseData?.[phId]) }
function subDateRange(phId, spId)  { return ptDateRange(props.phaseData?.[phId]?.subPhases?.[spId]) }
</script>
