<template>
  <span v-if="state === 'saving'" class="si-saving">
    <span class="si-spinner"></span> Saving…
  </span>
  <span v-else-if="state === 'saved'" class="si-saved">Saved ✓</span>
  <span v-else-if="state === 'error'" class="si-error">Save failed</span>
</template>

<script setup>
import { watch } from 'vue'

const props = defineProps({
  state: { type: String, default: 'idle' }, // idle | saving | saved | error
})
const emit = defineEmits(['update:state'])

watch(() => props.state, (val) => {
  if (val === 'saved') {
    setTimeout(() => emit('update:state', 'idle'), 2000)
  }
})
</script>

<style scoped>
.si-saving, .si-saved, .si-error {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
}
.si-saving { color: var(--muted); }
.si-saved  { color: #16a34a; }
.si-error  { color: var(--danger); }

.si-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin .6s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
