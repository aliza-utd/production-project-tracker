<template>
  <Teleport to="body">
    <div class="confirm-wrap" @mousedown.self="$emit('cancel')">
      <div class="confirm-box" style="max-width:460px">
        <div class="confirm-title">🌐 Activation Complete</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:16px">
          Which languages are ready to go live?
        </div>
        <div v-for="lang in languages" :key="lang"
          style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <input type="checkbox" :id="'act-lang-' + lang" v-model="checked[lang]"
            style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary)">
          <label :for="'act-lang-' + lang"
            style="font-size:14px;font-weight:600;cursor:pointer">{{ lang }}</label>
        </div>
        <div class="confirm-btns" style="margin-top:18px">
          <button class="btn btn-secondary btn-sm" @click="$emit('cancel')">Not yet</button>
          <button class="btn btn-primary btn-sm" :disabled="!hasChecked" @click="confirm">
            Confirm
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({
  languages: { type: Array, default: () => [] },
})
const emit = defineEmits(['confirm', 'cancel'])

const checked = reactive(Object.fromEntries(props.languages.map(l => [l, false])))

const hasChecked = computed(() => props.languages.some(l => checked[l]))

function confirm() {
  if (!hasChecked.value) return
  emit('confirm', { ...checked })
}
</script>
