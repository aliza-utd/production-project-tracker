<template>
  <div class="tcw">
    <div class="tcw-hdr">
      <span class="tcw-title">⏱ Working Day Calculator</span>
      <button v-if="closeable" class="btn-icon tcw-close" @click="$emit('close')" title="Close">✕</button>
    </div>

    <!-- Mode tabs -->
    <div class="tcw-tabs">
      <button :class="['tcw-tab', { active: mode === 'duration' }]" @click="mode = 'duration'">Duration</button>
      <button :class="['tcw-tab', { active: mode === 'enddate' }]" @click="mode = 'enddate'">End Date</button>
    </div>

    <!-- Inputs -->
    <div class="tcw-inputs">
      <div class="tcw-field">
        <label class="tcw-label">Start Date</label>
        <input type="date" class="form-input tcw-date-in" v-model="startDate">
      </div>
      <div class="tcw-field">
        <label class="tcw-label">{{ mode === 'duration' ? 'End Date' : 'Working Days' }}</label>
        <input v-if="mode === 'duration'" type="date" class="form-input tcw-date-in" v-model="endDate">
        <input v-else type="number" class="form-input tcw-date-in" v-model.number="wdInput" min="1" max="999" placeholder="e.g. 30">
      </div>
    </div>

    <!-- Holiday options -->
    <div class="tcw-options">
      <label class="tcw-check">
        <input type="checkbox" v-model="excludePH" style="margin:0">
        Exclude Philippine public holidays
      </label>
      <div class="tcw-custom-row">
        <input type="date" class="form-input" style="font-size:12px;padding:4px 8px;height:30px" v-model="customHolInput">
        <button class="btn btn-ghost btn-sm" @click="addCustom"
          :disabled="!customHolInput || customHolidays.includes(customHolInput)">+ Add holiday</button>
      </div>
      <div v-if="customHolidays.length" class="tcw-hol-chips">
        <span v-for="(h, i) in customHolidays" :key="h" class="tcw-hol-chip">
          {{ displayDate(h) }}
          <button @click="removeCustom(i)">✕</button>
        </span>
      </div>
    </div>

    <!-- Results -->
    <div v-if="result" class="tcw-results">
      <template v-if="mode === 'duration'">
        <div class="tcw-res-row">
          <span>Calendar days</span>
          <strong>{{ result.calendar }}</strong>
        </div>
        <div class="tcw-res-row">
          <span>Working days (Mon–Fri)</span>
          <strong>{{ result.working }}</strong>
        </div>
        <div class="tcw-res-row">
          <span>Full weeks</span>
          <strong>{{ result.weeks }}</strong>
        </div>
        <div v-if="excludePH && result.phExcluded > 0" class="tcw-res-row tcw-res-note">
          <span>PH holidays excluded</span>
          <strong>{{ result.phExcluded }}</strong>
        </div>
      </template>
      <template v-else>
        <div class="tcw-res-row tcw-res-big">
          <span>Expected end date</span>
          <strong>{{ result.endDate }}</strong>
        </div>
        <div class="tcw-res-row">
          <span>Calendar days</span>
          <strong>{{ result.calendar }}</strong>
        </div>
      </template>
    </div>
    <div v-else-if="startDate" class="tcw-empty">
      {{ mode === 'duration' ? 'Pick an end date to see results.' : 'Enter number of working days.' }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

defineProps({ closeable: { type: Boolean, default: false } })
defineEmits(['close'])

// Philippine public holidays 2025–2026 (regular + special non-working)
const PH_HOLIDAYS = [
  // 2025
  '2025-01-01', // New Year's Day
  '2025-04-09', // Day of Valor
  '2025-04-17', // Maundy Thursday
  '2025-04-18', // Good Friday
  '2025-05-01', // Labor Day
  '2025-06-12', // Independence Day
  '2025-08-25', // National Heroes Day (last Monday of August)
  '2025-11-01', // All Saints' Day
  '2025-11-02', // All Souls' Day (special)
  '2025-11-30', // Bonifacio Day
  '2025-12-08', // Immaculate Conception (special)
  '2025-12-24', // Christmas Eve (special)
  '2025-12-25', // Christmas Day
  '2025-12-30', // Rizal Day
  '2025-12-31', // New Year's Eve (special)
  // 2026
  '2026-01-01', // New Year's Day
  '2026-04-02', // Maundy Thursday
  '2026-04-03', // Good Friday
  '2026-04-09', // Day of Valor
  '2026-05-01', // Labor Day
  '2026-06-12', // Independence Day
  '2026-08-31', // National Heroes Day (last Monday of August)
  '2026-11-01', // All Saints' Day
  '2026-11-02', // All Souls' Day (special)
  '2026-11-30', // Bonifacio Day
  '2026-12-08', // Immaculate Conception (special)
  '2026-12-24', // Christmas Eve (special)
  '2026-12-25', // Christmas Day
  '2026-12-30', // Rizal Day
  '2026-12-31', // New Year's Eve (special)
]

const mode         = ref('duration')
const startDate    = ref('')
const endDate      = ref('')
const wdInput      = ref(null)
const excludePH    = ref(true)
const customHolInput = ref('')
const customHolidays = ref(JSON.parse(localStorage.getItem('pt_custom_holidays') || '[]'))

watch(customHolidays, v => {
  localStorage.setItem('pt_custom_holidays', JSON.stringify(v))
}, { deep: true })

function addCustom() {
  const d = customHolInput.value
  if (!d || customHolidays.value.includes(d)) return
  customHolidays.value.push(d)
  customHolidays.value.sort()
  customHolInput.value = ''
}
function removeCustom(i) { customHolidays.value.splice(i, 1) }

const allHolidays = computed(() => {
  const base = excludePH.value ? [...PH_HOLIDAYS] : []
  return [...new Set([...base, ...customHolidays.value])]
})

function displayDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function calDays(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(0, Math.round((e - s) / 86400000))
}

function workingDays(start, end, holidays) {
  const hs  = new Set(holidays)
  const s   = new Date(start + 'T00:00:00')
  const e   = new Date(end + 'T00:00:00')
  if (s > e) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6 && !hs.has(cur.toISOString().slice(0, 10))) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

function phHolidaysInRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return PH_HOLIDAYS.filter(h => {
    const d = new Date(h + 'T00:00:00')
    const wd = d.getDay()
    return d >= s && d <= e && wd !== 0 && wd !== 6
  }).length
}

function addWorkingDays(start, days, holidays) {
  const hs  = new Set(holidays)
  const cur = new Date(start + 'T00:00:00')
  let rem   = Math.max(0, parseInt(days) || 0)
  while (rem > 0) {
    cur.setDate(cur.getDate() + 1)
    const day = cur.getDay()
    if (day !== 0 && day !== 6 && !hs.has(cur.toISOString().slice(0, 10))) rem--
  }
  return cur.toISOString().slice(0, 10)
}

const result = computed(() => {
  const hols = allHolidays.value
  if (mode.value === 'duration') {
    if (!startDate.value || !endDate.value || startDate.value > endDate.value) return null
    const cal     = calDays(startDate.value, endDate.value)
    const working = workingDays(startDate.value, endDate.value, hols)
    return {
      calendar:   cal,
      working,
      weeks:      (cal / 7).toFixed(1),
      phExcluded: excludePH.value ? phHolidaysInRange(startDate.value, endDate.value) : 0,
    }
  } else {
    if (!startDate.value || !wdInput.value) return null
    const endStr = addWorkingDays(startDate.value, wdInput.value, hols)
    return {
      endDate:  displayDate(endStr),
      calendar: calDays(startDate.value, endStr),
    }
  }
})
</script>

<style scoped>
.tcw { background: var(--surface); border-radius: var(--r); padding: 16px; min-width: 280px; }
.tcw-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.tcw-title { font-size: 13px; font-weight: 700; color: var(--text); }
.tcw-close { font-size: 13px; }

.tcw-tabs { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
.tcw-tab { flex: 1; padding: 5px; font-size: 12px; font-weight: 600; border: none; background: var(--surface); color: var(--muted); cursor: pointer; font-family: inherit; transition: all .15s; }
.tcw-tab.active { background: var(--primary); color: #fff; }

.tcw-inputs { display: flex; gap: 10px; margin-bottom: 12px; }
.tcw-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.tcw-label { font-size: 11px; font-weight: 600; color: var(--muted); }
.tcw-date-in { font-size: 13px; padding: 5px 8px; }

.tcw-options { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding-top: 10px; border-top: 1px solid var(--border); }
.tcw-check { display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: var(--text); }
.tcw-custom-row { display: flex; gap: 6px; align-items: center; }
.tcw-hol-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.tcw-hol-chip { display: inline-flex; align-items: center; gap: 4px; background: var(--bg); border: 1px solid var(--border); border-radius: 100px; font-size: 11px; padding: 1px 8px; color: var(--text); }
.tcw-hol-chip button { background: none; border: none; cursor: pointer; font-size: 10px; color: var(--muted); padding: 0; line-height: 1; }

.tcw-results { background: var(--bg); border-radius: var(--r); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.tcw-res-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--text); }
.tcw-res-row span { color: var(--muted); }
.tcw-res-row strong { color: var(--text); }
.tcw-res-big strong { font-size: 16px; color: var(--primary); }
.tcw-res-note span, .tcw-res-note strong { font-size: 12px; color: var(--muted); }
.tcw-empty { font-size: 12px; color: var(--muted); text-align: center; padding: 10px 0; }
</style>
