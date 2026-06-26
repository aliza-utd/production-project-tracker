<template>
  <div class="np-tag-field" @click="inputRef?.focus()">
    <span v-for="tag in modelValue" :key="tag" class="np-tag">
      {{ tag }}
      <button type="button" class="np-tag-x" @click.stop="removeTag(tag)">×</button>
    </span>
    <input
      ref="inputRef"
      class="np-tag-text"
      v-model="inputText"
      :placeholder="modelValue.length ? '' : placeholder"
      @keydown="onKeydown"
      @blur="commitInput"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  modelValue:  { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Add tag…' },
  defaultTags: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const inputRef  = ref(null)
const inputText = ref('')

onMounted(() => {
  if (!props.modelValue.length && props.defaultTags.length) {
    emit('update:modelValue', [...props.defaultTags])
  }
})

function commitInput() {
  const v = inputText.value.trim().replace(/,$/, '')
  if (v && !props.modelValue.includes(v)) {
    emit('update:modelValue', [...props.modelValue, v])
  }
  inputText.value = ''
}

function onKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    commitInput()
  } else if (e.key === 'Backspace' && !inputText.value) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function removeTag(tag) {
  emit('update:modelValue', props.modelValue.filter(t => t !== tag))
}
</script>
