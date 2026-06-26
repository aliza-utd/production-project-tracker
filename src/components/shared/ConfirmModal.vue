<template>
  <Teleport to="body">
    <div class="confirm-wrap" @mousedown.self="$emit('cancel')">
      <div class="confirm-box">
        <div class="confirm-title">{{ title }}</div>
        <div v-if="message" class="confirm-msg">{{ message }}</div>
        <div class="confirm-btns">
          <button class="btn btn-secondary btn-sm" @click="$emit('cancel')">
            {{ cancelText }}
          </button>
          <button class="btn btn-sm" :class="confirmCls" @click="$emit('confirm')">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title:       { type: String, default: 'Confirm' },
  message:     { type: String, default: '' },
  confirmText: { type: String, default: 'Confirm' },
  cancelText:  { type: String, default: 'Cancel' },
  variant:     { type: String, default: 'default' }, // default | danger | warning
})
defineEmits(['confirm', 'cancel'])

const confirmCls = computed(() => {
  if (props.variant === 'danger')  return 'btn-danger'
  if (props.variant === 'warning') return 'btn-warning'
  return 'btn-primary'
})
</script>

<style scoped>
.btn-warning {
  background: #d97706;
  color: #fff;
  border: none;
  font-weight: 600;
}
.btn-warning:hover { background: #b45309; }
</style>
