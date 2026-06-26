<template>
  <div class="pd-onhold-banner">
    <div>
      <span style="font-weight:700">
        ⚠ On-Hold<template v-if="since"> since {{ fmtDate(since) }}</template>
      </span>
      <template v-if="reason"> — {{ reason }}</template>
      <span style="font-weight:400;opacity:.75;margin-left:8px">All editing is locked.</span>
    </div>
    <button
      v-if="canReactivate"
      class="btn btn-sm"
      style="background:#d97706;color:#fff;border:none;padding:5px 14px;font-weight:600"
      @click="$emit('reactivate')"
    >
      Reactivate
    </button>
  </div>
</template>

<script setup>
defineProps({
  since:          { type: String,  default: '' },
  reason:         { type: String,  default: '' },
  projectId:      { type: String,  default: '' },
  canReactivate:  { type: Boolean, default: false },
})
defineEmits(['reactivate'])

function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
</script>
