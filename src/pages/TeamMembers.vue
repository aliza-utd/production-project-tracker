<template>
  <div class="content">

    <!-- ── Page header ──────────────────────────────────────────────── -->
    <div class="page-top">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">Team Members</h1>

      <div class="tab-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'members' }"
          @click="activeTab = 'members'">Members</button>
        <button class="tab-btn" :class="{ active: activeTab === 'roles' }"
          @click="activeTab = 'roles'">Roles &amp; Permissions</button>
      </div>

      <button v-if="authStore.isManager && activeTab === 'members'"
        class="btn btn-primary btn-sm" @click="openAdd">+ Add Member</button>
      <button v-if="authStore.isManager && activeTab === 'roles'"
        class="btn btn-primary btn-sm" @click="openNewRole">+ New Role</button>
    </div>

    <!-- ── Members tab ───────────────────────────────────────────────── -->
    <template v-if="activeTab === 'members'">

      <!-- Roles still loading: show a fallback that lists all active members -->
      <template v-if="!rolesStore.loaded">
        <div class="dept-group">
          <div class="dept-header">Active Members ({{ active.length }})</div>
          <div v-if="!active.length" style="font-size:13px;color:var(--muted)">Loading…</div>
          <div class="tm-grid">
            <div v-for="m in active" :key="m.id" class="tm-card">
              <div class="tm-card-top">
                <div class="tm-avatar" :style="'background:' + (m.avatarColor || '#6366f1')">
                  {{ m.initials || '?' }}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
                  <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }}</div>
                  <div style="font-size:12px;color:var(--muted)">{{ m.email }}</div>
                </div>
                <span class="status-badge status-badge--active">Active</span>
              </div>
              <div v-if="authStore.isManager" class="tm-actions">
                <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
                <button class="btn btn-ghost btn-sm" @click="deactivate(m)">Deactivate</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Roles loaded: group by role -->
      <template v-else>
        <div v-for="role in sortedRoles" :key="role.id" class="dept-group">
          <div class="dept-header">{{ role.name }} ({{ byRole(role).length }})</div>
          <div class="tm-grid">
            <div v-for="m in byRole(role)" :key="m.id" class="tm-card">
              <div class="tm-card-top">
                <div class="tm-avatar" :style="'background:' + (m.avatarColor || '#6366f1')">
                  {{ m.initials || '?' }}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
                  <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }}</div>
                  <div style="font-size:12px;color:var(--muted)">{{ m.email || '' }}</div>
                </div>
                <span class="status-badge status-badge--active">Active</span>
              </div>
              <div v-if="authStore.isManager" class="tm-actions">
                <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
                <button class="btn btn-ghost btn-sm" @click="deactivate(m)">Deactivate</button>
              </div>
            </div>
            <div v-if="!byRole(role).length"
              style="font-size:13px;color:var(--muted);padding:4px 0">
              No {{ role.name }} members yet.
            </div>
          </div>
        </div>

        <!-- Members with a role not found in the roles store (legacy / unmatched) -->
        <div v-if="unmatched.length" class="dept-group">
          <div class="dept-header">Other ({{ unmatched.length }})</div>
          <div class="tm-grid">
            <div v-for="m in unmatched" :key="m.id" class="tm-card">
              <div class="tm-card-top">
                <div class="tm-avatar" :style="'background:' + (m.avatarColor || '#6366f1')">
                  {{ m.initials || '?' }}
                </div>
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
                  <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }}</div>
                  <div style="font-size:12px;color:var(--muted)">{{ m.email || '' }}</div>
                </div>
                <span class="status-badge status-badge--active">Active</span>
              </div>
              <div v-if="authStore.isManager" class="tm-actions">
                <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
                <button class="btn btn-ghost btn-sm" @click="deactivate(m)">Deactivate</button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Invited -->
      <div v-if="invited.length" style="margin-top:24px">
        <div class="dept-header">Invited ({{ invited.length }})</div>
        <div class="tm-grid">
          <div v-for="m in invited" :key="m.id" class="tm-card">
            <div class="tm-card-top">
              <div class="tm-avatar" :style="'background:' + (m.avatarColor || '#6366f1')">
                {{ m.initials || '?' }}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px">{{ m.name }}</div>
                <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }}</div>
                <div style="font-size:12px;color:var(--muted)">{{ m.email || '' }}</div>
              </div>
              <span v-if="isExpired(m)" class="status-badge status-badge--blocked">Expired</span>
              <span v-else class="status-badge status-badge--pending">Invited</span>
            </div>
            <div v-if="authStore.isManager" class="tm-actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
              <button class="btn btn-ghost btn-sm" @click="handleResend(m)">
                {{ resendingId === m.id ? 'Resending…' : isExpired(m) ? 'Resend Invite' : 'Copy Link' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Inactive -->
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
                <div style="font-size:12px;color:var(--muted)">{{ m.role || '—' }}</div>
              </div>
              <span class="status-badge status-badge--inactive">Inactive</span>
            </div>
            <div v-if="authStore.isManager" class="tm-actions">
              <button class="btn btn-ghost btn-sm" @click="openEdit(m)">Edit</button>
              <button class="btn btn-ghost btn-sm" @click="activate(m)">Re-activate</button>
            </div>
          </div>
        </div>
      </div>

    </template>

    <!-- ── Roles & Permissions tab ───────────────────────────────────── -->
    <template v-else-if="activeTab === 'roles'">
      <div v-if="!rolesStore.loaded" style="font-size:14px;color:var(--muted);padding:24px 0">
        Loading roles…
      </div>
      <div v-else class="roles-table-wrap">
        <table class="roles-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Members</th>
              <th title="View all projects">View all</th>
              <th title="Edit phases">Edit phases</th>
              <th title="Manage team members">Manage team</th>
              <th title="Access settings">Settings</th>
              <th title="Read-only access">Read-only</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in sortedRoles" :key="role.id">
              <td class="role-name-cell">
                {{ role.name }}
                <span v-if="role.permissions?.isAdmin" class="protected-badge">Protected</span>
              </td>
              <td>{{ memberCountForRole(role.id) }}</td>
              <td><span :class="role.permissions?.canViewAllProjects ? 'perm-yes' : 'perm-no'">
                {{ role.permissions?.canViewAllProjects ? '✓' : '—' }}</span></td>
              <td><span :class="role.permissions?.canEditPhases ? 'perm-yes' : 'perm-no'">
                {{ role.permissions?.canEditPhases ? '✓' : '—' }}</span></td>
              <td><span :class="role.permissions?.canManageTeam ? 'perm-yes' : 'perm-no'">
                {{ role.permissions?.canManageTeam ? '✓' : '—' }}</span></td>
              <td><span :class="role.permissions?.canAccessSettings ? 'perm-yes' : 'perm-no'">
                {{ role.permissions?.canAccessSettings ? '✓' : '—' }}</span></td>
              <td><span :class="role.permissions?.isReadOnly ? 'perm-yes' : 'perm-no'">
                {{ role.permissions?.isReadOnly ? '✓' : '—' }}</span></td>
              <td>
                <button v-if="authStore.isManager"
                  class="btn btn-ghost btn-sm" @click="openEditRole(role)">
                  {{ role.permissions?.isAdmin ? 'View' : 'Edit' }}
                </button>
              </td>
            </tr>
            <tr v-if="!rolesStore.roles.length">
              <td colspan="8" style="text-align:center;color:var(--muted);padding:24px">
                No roles found. Click "+ New Role" to create one.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── Add / Edit Member modal ───────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="memberModalOpen" class="confirm-wrap" @mousedown.self="closeMemberModal">
        <div class="confirm-box" style="max-width:480px;overflow-y:auto;max-height:90vh">

          <template v-if="memberModalStep === 'form'">
            <div class="confirm-title">{{ editingMemberId ? 'Edit Member' : 'Add Member' }}</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div>
                <label class="form-label">Name *</label>
                <input class="form-input" v-model="memberForm.name" placeholder="Full Name">
              </div>
              <div>
                <label class="form-label">Role *</label>
                <select class="form-select" v-model="memberForm.roleId">
                  <option value="">— Select role —</option>
                  <option v-for="r in sortedRoles" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
                <div v-if="!rolesStore.roles.length" style="font-size:11px;color:var(--muted);margin-top:4px">
                  Roles are loading…
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div>
                <label class="form-label">Email *</label>
                <input class="form-input" v-model="memberForm.email" type="email"
                  placeholder="email@company.com"
                  :readonly="!!editingMemberId && !!editingMemberDoc?.status">
              </div>
              <div>
                <label class="form-label">Initials</label>
                <input class="form-input" v-model="memberForm.initials" placeholder="AB" maxlength="3"
                  @input="initialsManuallyEdited = true">
              </div>
            </div>

            <div style="margin-bottom:16px">
              <label class="form-label">Avatar Color</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                <div v-for="c in AVATAR_COLORS" :key="c"
                  style="width:22px;height:22px;border-radius:50%;cursor:pointer"
                  :style="'background:' + c + (memberForm.avatarColor === c ? ';outline:2px solid var(--text);outline-offset:2px' : '')"
                  @click="memberForm.avatarColor = c"></div>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:var(--r);margin-bottom:16px">
              <div class="tm-avatar" :style="'background:' + (memberForm.avatarColor || '#6366f1')">
                {{ memberForm.initials || '?' }}
              </div>
              <div>
                <div style="font-weight:600;font-size:14px">{{ memberForm.name || 'Preview' }}</div>
                <div style="font-size:12px;color:var(--muted)">{{ roleNameFor(memberForm.roleId) }}</div>
              </div>
            </div>

            <p v-if="memberSaveError" style="font-size:13px;color:var(--danger);margin-bottom:10px">
              {{ memberSaveError }}
            </p>

            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" @click="closeMemberModal">Cancel</button>
              <button class="btn btn-primary btn-sm"
                :disabled="memberSaving || !memberForm.name.trim() || (!editingMemberId && !memberForm.email.trim())"
                @click="saveMemberModal">
                {{ memberSaving ? 'Saving…' : editingMemberId ? 'Save Changes' : 'Send Invite' }}
              </button>
            </div>
          </template>

          <template v-else-if="memberModalStep === 'invite_sent'">
            <div style="text-align:center;padding:8px 0 16px">
              <div style="font-size:36px;margin-bottom:12px">📩</div>
              <div class="confirm-title" style="margin-bottom:8px">Invite Link Created</div>
              <p style="font-size:14px;color:var(--muted);margin-bottom:20px">
                Share this link with <strong>{{ invitedName }}</strong>.<br>
                It expires in 7 days.
              </p>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:20px">
              <input class="form-input" :value="inviteLink" readonly
                style="flex:1;font-size:12px;font-family:monospace;color:var(--muted)">
              <button class="btn btn-primary btn-sm" @click="copyInviteLink">
                {{ copied ? '✓ Copied' : 'Copy' }}
              </button>
            </div>
            <div style="display:flex;justify-content:flex-end">
              <button class="btn btn-ghost btn-sm" @click="closeMemberModal">Done</button>
            </div>
          </template>

        </div>
      </div>
    </Teleport>

    <!-- ── Create / Edit / View Role modal ─────────────────────────── -->
    <Teleport to="body">
      <div v-if="roleModalOpen" class="confirm-wrap" @mousedown.self="closeRoleModal">
        <div class="confirm-box" style="max-width:500px;overflow-y:auto;max-height:90vh;position:relative">

          <!-- × close button — always visible top-right -->
          <button class="modal-close-btn" @click="closeRoleModal" aria-label="Close">×</button>

          <div class="confirm-title">
            {{ isAdminRole ? 'Admin' : (editingRoleId ? 'Edit Role' : 'New Role') }}
          </div>

          <!-- Admin protected banner -->
          <div v-if="isAdminRole" class="protected-banner">
            This is a protected role. It cannot be modified or deleted.
          </div>

          <!-- Manager protection warning (non-admin roles only) -->
          <div v-if="!isAdminRole && editingRoleId === 'manager' && managerWarning"
            style="background:#fef9c3;border:1px solid #fef08a;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#78350f">
            Warning: Removing both "Manage team" and "Access settings" from the Manager role will lock all managers out of admin features.
          </div>

          <div style="margin-bottom:16px">
            <label class="form-label">Role name{{ isAdminRole ? '' : ' *' }}</label>
            <input class="form-input" v-model="roleForm.name" placeholder="e.g. Senior Developer"
              :readonly="isAdminRole || ['manager','developer','multimedia','qa','external'].includes(editingRoleId)">
          </div>

          <div class="perm-list">
            <div v-for="perm in PERMISSIONS" :key="perm.key" class="perm-row">
              <div class="perm-text">
                <span class="perm-label">{{ perm.label }}</span>
                <span class="perm-desc">{{ perm.desc }}</span>
              </div>
              <button class="toggle"
                :class="{ 'toggle--on': roleForm.permissions[perm.key], 'toggle--disabled': isAdminRole }"
                @click="!isAdminRole && (roleForm.permissions[perm.key] = !roleForm.permissions[perm.key])"
                type="button">
                <span class="toggle-thumb"></span>
              </button>
            </div>
          </div>

          <p v-if="!isAdminRole && roleSaveError" style="font-size:13px;color:var(--danger);margin:12px 0 0">
            {{ roleSaveError }}
          </p>

          <!-- Button row — hidden for Admin (only × dismisses) -->
          <div v-if="!isAdminRole"
            style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px;align-items:center">
            <button v-if="editingRoleId" class="btn btn-ghost btn-sm"
              style="margin-right:auto;color:var(--danger)"
              @click="deleteRole">
              {{ roleSaving ? '…' : 'Delete role' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="closeRoleModal">Cancel</button>
            <button class="btn btn-primary btn-sm"
              :disabled="roleSaving || !roleForm.name.trim()"
              @click="saveRole">
              {{ roleSaving ? 'Saving…' : editingRoleId ? 'Save Changes' : 'Create Role' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, reactive, watch } from 'vue'
import { useAuthStore }  from '@/stores/auth'
import { useTeamStore }  from '@/stores/team'
import { useRolesStore } from '@/stores/roles'
import { createInvitedMember, resendInvite } from '@/firebase-service'

const authStore  = useAuthStore()
const teamStore  = useTeamStore()
const rolesStore = useRolesStore()

const AVATAR_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#f59e0b','#10b981','#14b8a6','#0ea5e9','#3b82f6',
  '#64748b','#374151',
]

const PERMISSIONS = [
  { key: 'canViewAllProjects', label: 'View all projects',      desc: 'See every project, not just assigned ones' },
  { key: 'canEditPhases',      label: 'Edit phases',            desc: 'Mark phases as active or done' },
  { key: 'canManageTeam',      label: 'Manage team members',    desc: 'Add, invite, or remove team members' },
  { key: 'canAccessSettings',  label: 'Access settings',        desc: 'Edit app-wide settings' },
  { key: 'canEditAllNotes',    label: 'Edit all notes',            desc: 'Can edit weekly notes for any team member. When off, they can only edit their own row.' },
  { key: 'isReadOnly',         label: 'Read-only',              desc: 'View only, no edits. For external users.' },
]

// ── Tabs ────────────────────────────────────────────────────────────────────
const activeTab   = ref('members')
const showInactive = ref(false)

// ── Member lists ────────────────────────────────────────────────────────────
const active = computed(() =>
  teamStore.teamMembers.filter(m =>
    m.status === 'active' || (m.active !== false && !m.status)
  )
)
const invited  = computed(() => teamStore.teamMembers.filter(m => m.status === 'invited'))
const inactive = computed(() => teamStore.teamMembers.filter(m => m.active === false && m.status !== 'invited'))

// Members grouped under a specific role
function byRole(role) {
  return active.value.filter(m => {
    if (m.roleId) return m.roleId === role.id
    const name = (m.role || m.department || '').toLowerCase()
    return name === role.name.toLowerCase()
  })
}

// Active members whose role doesn't match any known role doc
const unmatched = computed(() => {
  if (!rolesStore.loaded) return []
  return active.value.filter(m => {
    if (m.roleId) return !rolesStore.getRoleById(m.roleId)
    const name = (m.role || m.department || '').toLowerCase()
    return !rolesStore.roles.some(r => r.name.toLowerCase() === name)
  })
})

function isExpired(m) {
  if (!m.inviteExpiry) return false
  return new Date(m.inviteExpiry) < new Date()
}

function roleNameFor(roleId) {
  return rolesStore.roles.find(r => r.id === roleId)?.name || '—'
}

function memberCountForRole(roleId) {
  const role = rolesStore.getRoleById(roleId)
  return teamStore.teamMembers.filter(m => {
    if (m.status === 'invited' || m.active === false) return false
    if (m.roleId) return m.roleId === roleId
    // Legacy fallback: match by role/department name for members without roleId
    if (role) {
      const name = (m.role || m.department || '').toLowerCase()
      return name === role.name.toLowerCase()
    }
    return false
  }).length
}

// ── Member modal ────────────────────────────────────────────────────────────
const memberModalOpen  = ref(false)
const memberModalStep  = ref('form')
const editingMemberId  = ref(null)
const editingMemberDoc = ref(null)
const memberSaving     = ref(false)
const memberSaveError  = ref('')
const resendingId      = ref(null)
const inviteLink       = ref('')
const invitedName      = ref('')
const copied           = ref(false)

const memberForm = reactive({
  name: '', roleId: '', email: '', initials: '', avatarColor: '#6366f1',
})

const initialsManuallyEdited = ref(false)

watch(() => memberForm.name, (newName) => {
  if (initialsManuallyEdited.value) return
  const words = newName.trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) {
    memberForm.initials = ''
  } else if (words.length === 1) {
    memberForm.initials = words[0][0].toUpperCase()
  } else {
    memberForm.initials = (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
})

function openAdd() {
  editingMemberId.value        = null
  editingMemberDoc.value       = null
  memberModalStep.value        = 'form'
  memberSaveError.value        = ''
  initialsManuallyEdited.value = false
  Object.assign(memberForm, { name: '', roleId: '', email: '', initials: '', avatarColor: '#6366f1' })
  memberModalOpen.value = true
}

function openEdit(m) {
  editingMemberId.value        = m.id
  editingMemberDoc.value       = m
  memberModalStep.value        = 'form'
  memberSaveError.value        = ''
  initialsManuallyEdited.value = true  // preserve existing initials when editing
  Object.assign(memberForm, {
    name:        m.name        || '',
    roleId:      m.roleId      || '',
    email:       m.email       || '',
    initials:    m.initials    || '',
    avatarColor: m.avatarColor || '#6366f1',
  })
  memberModalOpen.value = true
}

function closeMemberModal() {
  memberModalOpen.value = false
  editingMemberId.value = null
}

async function saveMemberModal() {
  memberSaveError.value = ''
  if (!memberForm.name.trim()) return
  memberSaving.value = true
  try {
    const initials = memberForm.initials.trim().toUpperCase()
      || memberForm.name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const roleName = roleNameFor(memberForm.roleId)

    if (editingMemberId.value) {
      await teamStore.editMember(editingMemberId.value, {
        name:        memberForm.name.trim(),
        roleId:      memberForm.roleId || null,
        role:        roleName !== '—' ? roleName : undefined,
        initials,
        avatarColor: memberForm.avatarColor,
      })
      closeMemberModal()
    } else {
      if (!memberForm.email.trim()) {
        memberSaveError.value = 'Email is required to send an invite.'
        return
      }
      const created = await createInvitedMember({
        name:        memberForm.name.trim(),
        email:       memberForm.email.trim().toLowerCase(),
        roleId:      memberForm.roleId || null,
        role:        roleName !== '—' ? roleName : '',
        department:  roleName !== '—' ? roleName : '',
        initials,
        avatarColor: memberForm.avatarColor,
      })
      teamStore.teamMembers.push(created)
      const base = import.meta.env.BASE_URL.replace(/\/$/, '')
      inviteLink.value  = `${window.location.origin}${base}/join/${created.inviteCode}`
      invitedName.value = memberForm.name.trim()
      copied.value      = false
      memberModalStep.value = 'invite_sent'
    }
  } catch (err) {
    memberSaveError.value = 'Save failed: ' + err.message
  } finally {
    memberSaving.value = false
  }
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (_) {}
}

async function handleResend(m) {
  resendingId.value = m.id
  try {
    const { inviteCode, inviteExpiry } = await resendInvite(m.id, m.email)
    const idx = teamStore.teamMembers.findIndex(tm => tm.id === m.id)
    if (idx !== -1) Object.assign(teamStore.teamMembers[idx], { inviteCode, inviteExpiry })
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    inviteLink.value  = `${window.location.origin}${base}/join/${inviteCode}`
    invitedName.value = m.name
    copied.value      = false
    memberModalStep.value = 'invite_sent'
    memberModalOpen.value = true
  } catch (err) {
    alert('Resend failed: ' + err.message)
  } finally {
    resendingId.value = null
  }
}

async function deactivate(m) {
  if (!confirm(`Deactivate ${m.name}?`)) return
  await teamStore.editMember(m.id, { active: false, status: 'inactive' })
}

async function activate(m) {
  await teamStore.editMember(m.id, { active: true, status: 'active' })
}

// ── Role modal ──────────────────────────────────────────────────────────────
const roleModalOpen  = ref(false)
const editingRoleId  = ref(null)
const roleSaving     = ref(false)
const roleSaveError  = ref('')

const roleForm = reactive({
  name: '',
  permissions: {
    canViewAllProjects: false, canEditPhases: false, canManageTeam: false,
    canAccessSettings: false, canEditAllNotes: false, isReadOnly: false,
  },
})

const managerWarning = computed(() =>
  editingRoleId.value === 'manager' &&
  !roleForm.permissions.canManageTeam &&
  !roleForm.permissions.canAccessSettings
)

// True when the role being viewed/edited has isAdmin: true (protected, read-only in UI)
const isAdminRole = computed(() =>
  editingRoleId.value != null &&
  rolesStore.getRoleById(editingRoleId.value)?.permissions?.isAdmin === true
)

const sortedRoles = computed(() =>
  rolesStore.roles.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
)

function openNewRole() {
  editingRoleId.value = null
  roleSaveError.value = ''
  roleForm.name = ''
  Object.assign(roleForm.permissions, {
    canViewAllProjects: false, canEditPhases: false, canManageTeam: false,
    canAccessSettings: false, canEditAllNotes: false, isReadOnly: false,
    // isAdmin is always false for user-created roles; it is NOT exposed as a toggle
  })
  roleModalOpen.value = true
}

function openEditRole(role) {
  editingRoleId.value = role.id
  roleSaveError.value = ''
  roleForm.name = role.name
  Object.assign(roleForm.permissions, {
    canViewAllProjects: role.permissions?.canViewAllProjects ?? false,
    canEditPhases:      role.permissions?.canEditPhases      ?? false,
    canManageTeam:      role.permissions?.canManageTeam      ?? false,
    canAccessSettings:  role.permissions?.canAccessSettings  ?? false,
    canEditAllNotes:    role.permissions?.canEditAllNotes    ?? false,
    isReadOnly:         role.permissions?.isReadOnly         ?? false,
  })
  roleModalOpen.value = true
}

function closeRoleModal() {
  roleModalOpen.value = false
  editingRoleId.value = null
}

async function saveRole() {
  roleSaveError.value = ''
  if (!roleForm.name.trim()) return
  roleSaving.value = true
  try {
    if (editingRoleId.value) {
      // Merge with existing permissions so system fields (isAdmin, etc.) are preserved
      const existing = rolesStore.getRoleById(editingRoleId.value)?.permissions || {}
      await rolesStore.editRole(editingRoleId.value, {
        name:        roleForm.name.trim(),
        permissions: { ...existing, ...roleForm.permissions },
      })
    } else {
      // New roles always have isAdmin: false — it's a system field, not user-configurable
      await rolesStore.addRole({
        name:        roleForm.name.trim(),
        permissions: { ...roleForm.permissions, isAdmin: false },
      })
    }
    closeRoleModal()
  } catch (err) {
    roleSaveError.value = 'Save failed: ' + err.message
  } finally {
    roleSaving.value = false
  }
}

async function deleteRole() {
  if (!editingRoleId.value || isAdminRole.value) return
  const count = memberCountForRole(editingRoleId.value)
  if (count > 0) {
    roleSaveError.value = `Remove all members from this role before deleting. (${count} member${count > 1 ? 's' : ''} assigned)`
    return
  }
  if (!confirm(`Delete the "${roleForm.name}" role? This cannot be undone.`)) return
  roleSaving.value = true
  try {
    await rolesStore.removeRole(editingRoleId.value)
    closeRoleModal()
  } catch (err) {
    roleSaveError.value = 'Delete failed: ' + err.message
  } finally {
    roleSaving.value = false
  }
}
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────── */
.page-top {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 24px; flex-wrap: wrap;
}
.page-top h1 { flex-shrink: 0; }

.tab-bar { display: flex; gap: 2px; flex: 1; }
.tab-btn {
  padding: 6px 16px; border: none; border-radius: 6px;
  background: transparent; color: var(--muted);
  font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.15s, color 0.15s;
}
.tab-btn:hover { background: var(--bg); color: var(--text); }
.tab-btn.active { background: var(--bg); color: var(--primary); font-weight: 700; }

/* ── Member cards ─────────────────────────────────────────────────── */
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

/* ── Status badges ────────────────────────────────────────────────── */
.status-badge {
  flex-shrink: 0; font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
}
.status-badge--active   { background: #dcfce7; color: #16a34a; }
.status-badge--pending  { background: #fef9c3; color: #92400e; }
.status-badge--blocked  { background: #fef2f2; color: #dc2626; }
.status-badge--inactive { background: #f1f5f9; color: #64748b; }

/* ── Roles table ──────────────────────────────────────────────────── */
.roles-table-wrap { overflow-x: auto; }
.roles-table {
  width: 100%; border-collapse: collapse;
  font-size: 13px; background: var(--surface);
  border: 1px solid var(--border); border-radius: var(--r); overflow: hidden;
}
.roles-table th {
  text-align: left; padding: 10px 14px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--muted); background: var(--bg); border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.roles-table td {
  padding: 12px 14px; border-bottom: 1px solid var(--border); color: var(--text);
}
.roles-table tr:last-child td { border-bottom: none; }
.roles-table tr:hover td { background: var(--bg); }
.role-name-cell { font-weight: 600; }
.perm-yes { color: #16a34a; font-weight: 700; }
.perm-no  { color: var(--muted); }

/* ── Permission toggle list ───────────────────────────────────────── */
.perm-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }
.perm-row {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.perm-row:last-child { border-bottom: none; }
.perm-text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.perm-label { font-size: 13px; font-weight: 500; color: var(--text); }
.perm-desc  { font-size: 12px; color: var(--muted); }

.toggle {
  position: relative; width: 40px; height: 22px; flex-shrink: 0;
  background: var(--border); border: none; border-radius: 999px;
  cursor: pointer; transition: background 0.2s; padding: 0;
}
.toggle--on { background: var(--primary); }
.toggle--disabled { opacity: 0.45; pointer-events: none; cursor: default; }
.toggle-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}
.toggle--on .toggle-thumb { transform: translateX(18px); }

/* ── Admin / protected role UI ────────────────────────────────────── */
.protected-badge {
  display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .04em;
  background: #dbeafe; color: #1d4ed8; border-radius: 999px;
  padding: 1px 7px; margin-left: 8px; vertical-align: middle;
}
.protected-banner {
  background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;
  padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #1d4ed8; line-height: 1.5;
}
.modal-close-btn {
  position: absolute; top: 14px; right: 16px;
  background: none; border: none; font-size: 22px; line-height: 1;
  color: var(--muted); cursor: pointer; padding: 2px 6px; border-radius: 4px;
}
.modal-close-btn:hover { background: var(--bg); color: var(--text); }
</style>
