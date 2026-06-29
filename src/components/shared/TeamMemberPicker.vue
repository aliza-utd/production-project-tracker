<template>
  <div style="position:relative">
    <div class="np-tag-field" @click="inputRef?.focus()">
      <!-- Selected members as avatar pills -->
      <span
        v-for="m in selectedMembers"
        :key="m.id"
        class="np-member-tag"
      >
        <span
          class="np-member-av"
          :style="{ background: m.avatarColor || '#6366f1' }"
        >{{ m.initials || '?' }}</span>
        {{ m.name }}
        <button type="button" class="np-tag-x" @click.stop="removeMember(m.id)">×</button>
      </span>

      <!-- Search input -->
      <input
        ref="inputRef"
        class="np-tag-text"
        v-model="search"
        :placeholder="selectedMembers.length ? '' : 'Search members…'"
        :disabled="atMax"
        @focus="isOpen = true"
        @blur="onBlur"
        @input="isOpen = true"
      />
    </div>

    <!-- Dropdown -->
    <div v-if="isOpen && filteredMembers.length" class="np-dropdown">
      <div
        v-for="m in filteredMembers"
        :key="m.id"
        class="np-dropdown-item"
        @mousedown.prevent="addMember(m)"
      >
        <span
          class="np-member-av"
          :style="{ background: m.avatarColor || '#6366f1' }"
        >{{ m.initials || '?' }}</span>
        {{ m.name }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTeamStore } from '@/stores/team'

const props = defineProps({
  modelValue: { type: Array, default: () => [] }, // array of member IDs
  maxCount:   { type: Number, default: Infinity },
  members:    { type: Array, default: null },      // if provided, use instead of all active members
})
const emit = defineEmits(['update:modelValue'])

const teamStore = useTeamStore()
const inputRef  = ref(null)
const search    = ref('')
const isOpen    = ref(false)

onMounted(async () => {
  if (!teamStore.teamMembers.length) {
    await teamStore.fetchTeamMembers()
  }
})

const memberPool = computed(() =>
  props.members ?? teamStore.teamMembers.filter(m => m.active)
)

const selectedMembers = computed(() =>
  props.modelValue
    .map(id => memberPool.value.find(m => m.id === id) ?? teamStore.teamMembers.find(m => m.id === id))
    .filter(Boolean)
)

const atMax = computed(() =>
  props.modelValue.length >= props.maxCount
)

const filteredMembers = computed(() => {
  const s   = search.value.toLowerCase()
  const sel = new Set(props.modelValue)
  return memberPool.value.filter(
    m => !sel.has(m.id) && (!s || m.name.toLowerCase().includes(s))
  )
})

function addMember(m) {
  if (atMax.value) return
  emit('update:modelValue', [...props.modelValue, m.id])
  search.value = ''
  isOpen.value = false
}

function removeMember(id) {
  emit('update:modelValue', props.modelValue.filter(x => x !== id))
}

function onBlur() {
  setTimeout(() => { isOpen.value = false; search.value = '' }, 150)
}
</script>
