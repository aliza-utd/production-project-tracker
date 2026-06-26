<template>
  <div class="content">

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h1 style="font-size:20px;font-weight:700;color:var(--text);margin:0">Archived Projects</h1>
      <button class="btn btn-secondary btn-sm" @click="load" :disabled="loading">
        {{ loading ? 'Loading…' : '↺ Refresh' }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="display:flex;align-items:center;gap:10px;padding:48px;color:var(--muted)">
      <span style="animation:spin 1s linear infinite">⏳</span> Loading archived projects…
    </div>

    <!-- Error -->
    <div v-else-if="error" style="padding:24px;color:var(--danger);background:#fef2f2;border-radius:var(--r)">
      {{ error }}
      <button class="btn btn-ghost btn-sm" style="margin-left:12px" @click="load">Retry</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!projects.length" class="empty">
      <div class="empty-icon">🗄️</div>
      <div class="empty-title">No archived projects</div>
      <div class="empty-desc">Archived and cancelled projects will appear here.</div>
    </div>

    <!-- Table -->
    <div v-else class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>Project Name</th>
            <th>Platform</th>
            <th>Developer</th>
            <th>Status</th>
            <th>Reason</th>
            <th>Archived On</th>
            <th>Archived By</th>
            <th v-if="authStore.isManager">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in projects" :key="p.id">
            <td style="font-weight:600">{{ p.name }}</td>
            <td>
              <span v-if="p.platform" class="badge"
                :class="p.platform === 'WordPress' ? 'badge-wp' : 'badge-blogger'">
                {{ p.platform }}
              </span>
              <span v-else style="color:var(--muted)">—</span>
            </td>
            <td>{{ p.developer || '—' }}</td>
            <td>
              <span class="badge" :style="p.siteStatus === 'cancelled'
                ? 'background:#fef2f2;color:#dc2626'
                : 'background:#f3f4f6;color:#6b7280'">
                {{ p.siteStatus === 'cancelled' ? 'Cancelled' : 'Archived' }}
              </span>
            </td>
            <td style="font-size:12px;color:var(--muted);max-width:180px">
              {{ p.cancelledReason || p.archivedReason || '—' }}
            </td>
            <td style="font-size:12px">{{ fmtDate(p.archivedAt || p.cancelledAt) || '—' }}</td>
            <td style="font-size:12px">{{ p.archivedBy || '—' }}</td>
            <td v-if="authStore.isManager">
              <div style="display:flex;gap:6px">
                <button class="btn btn-ghost btn-sm" @click="restore(p)" :disabled="restoring === p.id">
                  {{ restoring === p.id ? '…' : '♻ Restore' }}
                </button>
                <button class="btn btn-sm"
                  style="background:var(--danger);color:#fff;border:none;font-size:12px"
                  @click="permanentDelete(p)">
                  🗑 Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Delete confirm modal -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="confirm-wrap" @mousedown.self="deleteTarget = null">
        <div class="confirm-box" style="max-width:420px">
          <div class="confirm-title">Permanently Delete?</div>
          <div class="confirm-desc">
            <strong>{{ deleteTarget.name }}</strong> will be permanently removed and cannot be recovered.
          </div>
          <div style="margin-bottom:14px">
            <label class="form-label" style="font-size:12px">Type the project name to confirm:</label>
            <input class="form-input" v-model="deleteConfirmText" :placeholder="deleteTarget.name">
          </div>
          <div class="confirm-btns">
            <button class="btn btn-ghost btn-sm" @click="deleteTarget = null; deleteConfirmText = ''">Cancel</button>
            <button class="btn btn-sm"
              style="background:var(--danger);color:#fff;border:none"
              :disabled="deleteConfirmText !== deleteTarget.name || deleting"
              @click="confirmDelete">
              {{ deleting ? 'Deleting…' : 'Delete Permanently' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getArchivedProjects, updateProjectInFirestore, deleteProjectPermanently } from '@/firebase-service'

const authStore = useAuthStore()

const projects          = ref([])
const loading           = ref(false)
const error             = ref('')
const restoring         = ref(null)
const deleteTarget      = ref(null)
const deleteConfirmText = ref('')
const deleting          = ref(false)

async function load() {
  loading.value = true
  error.value   = ''
  try {
    projects.value = await getArchivedProjects()
    projects.value.sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || ''))
  } catch (err) {
    error.value = 'Failed to load archived projects: ' + err.message
  } finally {
    loading.value = false
  }
}

async function restore(p) {
  if (!confirm(`Restore "${p.name}" to active projects?`)) return
  restoring.value = p.id
  try {
    await updateProjectInFirestore(p.id, {
      archived:        false,
      archivedAt:      null,
      archivedBy:      null,
      siteStatus:      'development',
      cancelledAt:     null,
      cancelledReason: '',
      updatedAt:       new Date().toISOString(),
    })
    projects.value = projects.value.filter(x => x.id !== p.id)
  } catch (err) {
    alert('Restore failed: ' + err.message)
  } finally {
    restoring.value = null
  }
}

function permanentDelete(p) {
  deleteTarget.value      = p
  deleteConfirmText.value = ''
}

async function confirmDelete() {
  if (!deleteTarget.value || deleteConfirmText.value !== deleteTarget.value.name) return
  deleting.value = true
  try {
    await deleteProjectPermanently(deleteTarget.value.id)
    projects.value = projects.value.filter(x => x.id !== deleteTarget.value.id)
    deleteTarget.value      = null
    deleteConfirmText.value = ''
  } catch (err) {
    alert('Delete failed: ' + err.message)
  } finally {
    deleting.value = false
  }
}

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

onMounted(load)
</script>
