<template>
  <div class="content">

    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">Team Members</h1>
      <button v-if="authStore.isManager" class="btn btn-primary btn-sm" @click="openAdd">+ Add Member</button>
    </div>

    <!-- Department groups -->
    <div v-for="dept in DEPARTMENTS" :key="dept" class="dept-group">
      <div class="dept-header">{{ dept }} ({{ byDept(dept).length }})</div>
      <div class="tm-grid">
        <div v-for="m in byDept(dept)" :key="m.id" class="tm-card">
          <div class="tm-card-top">
            <div class="tm-avatar" :style="'background:' + (m.avatarColor || '#6366f1')">
              {{ m.initials || '?' }}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
              <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }}</div>
              <div style="font-size:12px;color:var(--muted)">{{ m.email || '' }}</div>
            </div>
          </div>
          <div v-if="authStore.isManager" class="tm-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
            <button class="btn btn-ghost btn-sm" @click="deactivate(m)">Deactivate</button>
          </div>
        </div>
        <div v-if="!byDept(dept).length" style="font-size:13px;color:var(--muted);padding:4px 0">
          No {{ dept }} members.
        </div>
      </div>
    </div>

    <!-- Inactive section -->
    <div v-if="inactive.length" style="margin-top:24px">
      <div class="dept-header" style="cursor:pointer;display:flex;align-items:center;gap:8px"
        @click="showInactive = !showInactive">
        <span>{{ showInactive ? '▾' : '▸' }}</span>
        Inactive ({{ inactive.length }})
      </div>
      <div v-if="showInactive" class="tm-grid" style="margin-top:12px">
        <div v-for="m in inactive" :key="m.id" class="tm-card" style="opacity:.6">
          <div class="tm-card-top">
            <div class="tm-avatar" :style="'background:' + (m.avatarColor || '#9ca3af')">
              {{ m.initials || '?' }}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:14px;color:var(--muted)">{{ m.name }}</div>
              <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }} · {{ m.department }}</div>
            </div>
            <span class="badge" style="background:#fef2f2;color:#dc2626;flex-shrink:0">Inactive</span>
          </div>
          <div v-if="authStore.isManager" class="tm-actions">
            <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
            <button class="btn btn-ghost btn-sm" @click="activate(m)">Re-activate</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add / Edit Modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="confirm-wrap" @mousedown.self="closeModal">
        <div class="confirm-box" style="max-width:480px;overflow-y:auto;max-height:90vh">
          <div class="confirm-title">{{ editingId ? 'Edit Member' : 'Add Member' }}</div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>
              <label class="form-label">Name *</label>
              <input class="form-input" v-model="form.name" placeholder="Full Name">
            </div>
            <div>
              <label class="form-label">Role</label>
              <input class="form-input" v-model="form.role" placeholder="e.g. Lead Developer">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div>
              <label class="form-label">Department *</label>
              <select class="form-select" v-model="form.department">
                <option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</option>
              </select>
            </div>
            <div>
              <label class="form-label">Email</label>
              <input class="form-input" v-model="form.email" type="email" placeholder="email@company.com">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div>
              <label class="form-label">Initials</label>
              <input class="form-input" v-model="form.initials" placeholder="AB" maxlength="3">
            </div>
            <div>
              <label class="form-label">Avatar Color</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                <div v-for="c in AVATAR_COLORS" :key="c"
                  style="width:22px;height:22px;border-radius:50%;cursor:pointer"
                  :style="'background:' + c + (form.avatarColor === c ? ';outline:2px solid var(--text);outline-offset:2px' : '')"
                  @click="form.avatarColor = c"></div>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:var(--r);margin-bottom:16px">
            <div class="tm-avatar" :style="'background:' + (form.avatarColor || '#6366f1')">
              {{ form.initials || '?' }}
            </div>
            <div>
              <div style="font-weight:600;font-size:14px">{{ form.name || 'Preview' }}</div>
              <div style="font-size:12px;color:var(--muted)">{{ form.role || form.department }}</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ghost btn-sm" @click="closeModal">Cancel</button>
            <button class="btn btn-primary btn-sm" :disabled="saving || !form.name.trim()"
              @click="saveModal">
              {{ saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Member' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'

const authStore = useAuthStore()
const teamStore = useTeamStore()

const DEPARTMENTS = ['Manager', 'Developer', 'Production', 'Sales', 'Support']

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#f59e0b','#10b981','#14b8a6','#0ea5e9','#3b82f6',
  '#64748b','#374151',
]

const showInactive = ref(false)
const modalOpen    = ref(false)
const editingId    = ref(null)
const saving       = ref(false)

const form = reactive({
  name: '', role: '', department: 'Developer',
  email: '', initials: '', avatarColor: '#6366f1',
})

const active   = computed(() => teamStore.teamMembers.filter(m => m.active !== false))
const inactive = computed(() => teamStore.teamMembers.filter(m => m.active === false))

function byDept(dept) {
  return active.value.filter(m => m.department === dept)
}

function openAdd() {
  editingId.value = null
  Object.assign(form, { name: '', role: '', department: 'Developer', email: '', initials: '', avatarColor: '#6366f1' })
  modalOpen.value = true
}

function openEdit(m) {
  editingId.value = m.id
  Object.assign(form, {
    name:        m.name        || '',
    role:        m.role        || '',
    department:  m.department  || 'Developer',
    email:       m.email       || '',
    initials:    m.initials    || '',
    avatarColor: m.avatarColor || '#6366f1',
  })
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editingId.value = null
}

async function saveModal() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    const initials = form.initials.trim().toUpperCase()
      || form.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const data = {
      name:        form.name.trim(),
      role:        form.role.trim(),
      department:  form.department,
      email:       form.email.trim(),
      initials,
      avatarColor: form.avatarColor,
    }
    if (editingId.value) {
      await teamStore.editMember(editingId.value, data)
    } else {
      await teamStore.addMember({ ...data, active: true, createdAt: new Date().toISOString() })
    }
    closeModal()
  } catch (err) {
    alert('Save failed: ' + err.message)
  } finally {
    saving.value = false
  }
}

async function deactivate(m) {
  if (!confirm(`Deactivate ${m.name}?`)) return
  await teamStore.editMember(m.id, { active: false })
}

async function activate(m) {
  await teamStore.editMember(m.id, { active: true })
}
</script>

<style scoped>
.dept-group  { margin-bottom: 28px; }
.dept-header {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--muted);
  padding-bottom: 8px; border-bottom: 1px solid var(--border); margin-bottom: 12px;
}
.tm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.tm-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 14px; }
.tm-card-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.tm-actions  { display: flex; gap: 6px; border-top: 1px solid var(--border); padding-top: 10px; }
.tm-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 15px; flex-shrink: 0;
}
</style>
