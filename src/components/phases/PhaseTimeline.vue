<template>
  <div class="ptl-wrap">
    <div class="ptl-track">
      <div
        v-for="(ph, idx) in phaseConfig"
        :key="ph.id"
        class="ptl-step"
        @click="$emit('scroll-to-phase', ph.id)"
        :title="ph.name + ' — ' + statusLabel(phStatus(ph.id))"
      >
        <!-- Horizontal line + dot row -->
        <div class="ptl-row">
          <!-- Left connector — colored based on the PREVIOUS step's status -->
          <div
            v-if="idx > 0"
            class="ptl-line"
            :class="phStatus(phaseConfig[idx - 1].id) === 'done' ? 'ptl-line-done' : ''"
          ></div>

          <!-- Dot -->
          <div class="ptl-dot-wrap">
            <div class="ptl-dot" :class="'ptl-dot-' + phStatus(ph.id)">
              <span v-if="phStatus(ph.id) === 'done'" class="ptl-icon">✓</span>
            </div>
            <div v-if="phStatus(ph.id) === 'active'" class="ptl-pulse"></div>
          </div>

          <!-- Right connector — colored based on THIS step's status -->
          <div
            v-if="idx < phaseConfig.length - 1"
            class="ptl-line"
            :class="phStatus(ph.id) === 'done' ? 'ptl-line-done' : ''"
          ></div>
        </div>

        <!-- Phase label -->
        <div class="ptl-label" :class="phStatus(ph.id) === 'active' ? 'ptl-label-active' : ''">
          {{ ph.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  phaseData:   { type: Object, default: () => ({}) },
  phaseConfig: { type: Array,  default: () => [] },
})
defineEmits(['scroll-to-phase'])

const STATUS_LABELS = {
  'not-started': 'Not Started',
  'active':      'Active',
  'blocked':     'Blocked',
  'done':        'Done',
}

function phStatus(phId) {
  return props.phaseData?.[phId]?.status || 'not-started'
}
function statusLabel(s) { return STATUS_LABELS[s] || 'Not Started' }
</script>

<style scoped>
.ptl-wrap {
  overflow-x: auto;
  padding-bottom: 2px;
}

.ptl-track {
  display: flex;
  align-items: flex-start;
  min-width: max-content;
}

.ptl-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  min-width: 52px;
  transition: opacity .15s;
}
.ptl-step:hover { opacity: .8; }

.ptl-row {
  display: flex;
  align-items: center;
  width: 100%;
}

.ptl-line {
  flex: 1;
  height: 2px;
  background: var(--border);
  transition: background .3s;
  min-width: 8px;
}
.ptl-line-done { background: #22c55e; }

.ptl-dot-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ptl-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  transition: transform .15s;
  flex-shrink: 0;
}
.ptl-step:hover .ptl-dot { transform: scale(1.2); }

.ptl-dot-not-started {
  background: var(--surface);
  border: 2px solid #cbd5e1;
}
.ptl-dot-active {
  background: var(--primary);
  box-shadow: 0 0 0 3px rgba(99,102,241,.2);
}
.ptl-dot-done    { background: #22c55e; }
.ptl-dot-blocked { background: #f59e0b; }

.ptl-icon {
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

/* Pulse ring for the active phase dot */
.ptl-pulse {
  position: absolute;
  top: -5px;
  left: -5px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0;
  animation: ptlPulse 2s ease-out infinite;
  z-index: 0;
}
@keyframes ptlPulse {
  0%   { transform: scale(1);   opacity: .4; }
  100% { transform: scale(2);   opacity: 0;  }
}

.ptl-label {
  font-size: 10px;
  color: var(--muted);
  margin-top: 7px;
  text-align: center;
  line-height: 1.3;
  max-width: 66px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.ptl-label-active {
  color: var(--primary);
  font-weight: 700;
}
</style>
