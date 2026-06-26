<template>
  <span class="pd-status-badge" :class="cfg.cls">
    <span class="status-dot"></span>
    {{ cfg.label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'development' },
})

const MAP = {
  'development': { label: 'Development', cls: 'pd-status-dev'       },
  'live':        { label: 'Live',         cls: 'pd-status-live'      },
  'on-hold':     { label: 'On-Hold',      cls: 'pd-status-hold'      },
  'cancelled':   { label: 'Cancelled',    cls: 'pd-status-cancelled' },
}

const cfg = computed(() => MAP[props.status] ?? MAP['development'])
</script>

<style scoped>
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
  flex-shrink: 0;
}
</style>
