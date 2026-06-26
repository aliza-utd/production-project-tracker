<template>
  <div>
    <!-- Log Time toggle -->
    <div v-if="!readonly" style="margin-bottom:10px">
      <button
        v-if="!formOpen"
        class="btn btn-secondary btn-sm"
        @click="openForm"
      >
        + Log Time
      </button>
    </div>

    <!-- Entry form -->
    <div v-if="formOpen" class="ph-tl-form">
      <div class="ph-tl-form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Date</label>
          <input type="date" class="form-input" v-model="form.date" style="width:150px" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Hours</label>
          <input
            type="number"
            class="form-input"
            min="0.25"
            step="0.25"
            v-model="form.hours"
            placeholder="2.5"
            style="width:90px"
          />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Description</label>
          <input class="form-input" v-model="form.desc" placeholder="What was done…" />
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-sm" @click="submitForm">Add</button>
        <button class="btn btn-ghost btn-sm" @click="formOpen = false">Cancel</button>
      </div>
    </div>

    <!-- Log table -->
    <template v-if="timeLogs.length">
      <table class="ph-tl-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Hours</th>
            <th>Description</th>
            <th>By</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in timeLogs" :key="log.id">
            <td style="white-space:nowrap">{{ fmtDate(log.date) }}</td>
            <td style="white-space:nowrap">{{ fmtHours(log.hours) }}</td>
            <td>{{ log.description }}</td>
            <td style="white-space:nowrap;color:var(--muted)">
              {{ log.loggedBy?.name || '—' }}
            </td>
            <td>
              <button
                v-if="!readonly"
                class="btn-icon"
                @click="$emit('delete-log', log.id)"
                title="Delete"
              >🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="ph-tl-subtotal">
        <span>Sub-total</span>
        <span>{{ fmtHours(directHours) }}</span>
      </div>
    </template>

    <div
      v-else-if="!formOpen"
      style="font-size:13px;color:var(--muted);padding:4px 0 8px"
    >
      No time logged yet.
    </div>

    <!-- Sub-phase breakdown -->
    <template v-if="hasSubTotals && grandTotal > 0">
      <div class="ph-tl-breakdown">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">
          From sub-phases
        </div>
        <div
          v-for="(hrs, name) in subPhaseTotals"
          :key="name"
          class="ph-tl-breakdown-row"
        >
          <span>{{ name }}</span>
          <span>{{ fmtHours(hrs) }}</span>
        </div>
      </div>
      <div class="ph-tl-total">
        <span>{{ phaseName || 'Phase' }} total</span>
        <span>{{ fmtHours(grandTotal) }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  timeLogs:      { type: Array,  default: () => [] },
  subPhaseTotals:{ type: Object, default: () => ({}) }, // { subPhaseName: hours }
  phaseName:     { type: String, default: '' },
  readonly:      { type: Boolean, default: false },
})
const emit = defineEmits(['add-log', 'delete-log'])

const formOpen = ref(false)
const form     = ref({ date: '', hours: '', desc: '' })

function openForm() {
  form.value = {
    date:  new Date().toISOString().slice(0, 10),
    hours: '',
    desc:  '',
  }
  formOpen.value = true
}

function submitForm() {
  const hrs = parseFloat(form.value.hours)
  if (!hrs || hrs <= 0) return
  emit('add-log', {
    date:        form.value.date || new Date().toISOString().slice(0, 10),
    hours:       hrs,
    description: form.value.desc || '',
  })
  formOpen.value = false
}

const directHours = computed(() =>
  props.timeLogs.reduce((sum, l) => sum + (parseFloat(l.hours) || 0), 0)
)

const hasSubTotals = computed(() =>
  props.subPhaseTotals && Object.keys(props.subPhaseTotals).length > 0
)

const subTotal = computed(() =>
  Object.values(props.subPhaseTotals).reduce((s, h) => s + (parseFloat(h) || 0), 0)
)

const grandTotal = computed(() => directHours.value + subTotal.value)

function fmtDate(s) {
  if (!s) return ''
  return new Date(s + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtHours(h) {
  const n = parseFloat(h) || 0
  return (n % 1 === 0 ? n : n.toFixed(1)) + 'h'
}
</script>
