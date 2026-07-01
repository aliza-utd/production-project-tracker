<template>
  <span class="status-pill" :class="cfg.cls">{{ cfg.label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: 'not-started' },
})

const MAP = {
  'not-started': { label: 'Not started', cls: 'sp-pending'  },
  'active':      { label: 'In progress', cls: 'sp-progress' },
  'blocked':     { label: 'Blocked',     cls: 'sp-blocked'  },
  'done':        { label: 'Done',        cls: 'sp-done'     },
}

const cfg = computed(() => MAP[props.status] ?? MAP['not-started'])
</script>
