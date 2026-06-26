<template>
  <span class="status-badge-pill" :class="cfg.cls">
    {{ cfg.icon }} {{ cfg.label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'not-started' },
})

const MAP = {
  'not-started': { icon: '○', label: 'Not Started', cls: 'sb-ns'      },
  'active':      { icon: '◉', label: 'Active',      cls: 'sb-active'  },
  'blocked':     { icon: '⊘', label: 'Blocked',     cls: 'sb-blocked' },
  'done':        { icon: '✓', label: 'Done',         cls: 'sb-done'    },
}

const cfg = computed(() => MAP[props.status] ?? MAP['not-started'])
</script>

<style scoped>
.status-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 100px;
  white-space: nowrap;
}
.sb-ns      { background: #f1f5f9; color: #64748b; }
.sb-active  { background: #eef2ff; color: #4338ca; }
.sb-blocked { background: #fef3c7; color: #92400e; }
.sb-done    { background: #dcfce7; color: #16a34a; }
</style>
