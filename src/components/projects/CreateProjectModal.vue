<template>
  <Teleport to="body">
    <div class="confirm-wrap" @mousedown.self="$emit('cancel')">
      <div class="np-card" style="max-width:680px;width:100%;max-height:90vh;overflow-y:auto;margin:0 16px">

        <div class="np-title">New Project</div>

        <!-- Project Name -->
        <div class="np-name-wrap">
          <input
            class="np-name-input"
            :class="{ 'np-field-err': errors.name }"
            v-model="form.name"
            placeholder="Project Name"
            @input="form.name.trim() && delete errors.name"
          >
          <div v-if="errors.name" class="np-error">{{ errors.name }}</div>
        </div>

        <!-- Row 1: Site URL | Original Site URL -->
        <div class="np-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Site URL</label>
            <input class="form-input" v-model="form.url" placeholder="https://…">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Original Site URL</label>
            <input class="form-input" v-model="form.originalSite" placeholder="https://…">
          </div>
        </div>

        <!-- Row 2: Language | Platform | Type -->
        <div class="np-row np-row-3">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Language *</label>
            <TagInput v-model="langTags" placeholder="Add language…" />
            <div v-if="errors.language" class="np-error">{{ errors.language }}</div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Platform *</label>
            <select class="form-select" :class="{ 'np-field-err': errors.platform }"
              v-model="form.platform" @change="delete errors.platform">
              <option value="">Select…</option>
              <option>WordPress</option>
              <option>Blogger</option>
            </select>
            <div v-if="errors.platform" class="np-error">{{ errors.platform }}</div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Type *</label>
            <select class="form-select" :class="{ 'np-field-err': errors.projectType }"
              v-model="form.projectType" @change="delete errors.projectType">
              <option value="">Select…</option>
              <option value="new_site">New Site</option>
              <option value="redesign">Redesign</option>
              <option value="smart_blog">Smart Blog</option>
              <option value="others">Others</option>
            </select>
            <div v-if="errors.projectType" class="np-error">{{ errors.projectType }}</div>
          </div>
        </div>

        <!-- Row 3: Kickstart Date | Live Date -->
        <div class="np-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Kickstart Date *</label>
            <input type="date" class="form-input" :class="{ 'np-field-err': errors.kickstartDate }"
              v-model="form.kickstartDate" @change="delete errors.kickstartDate">
            <div v-if="errors.kickstartDate" class="np-error">{{ errors.kickstartDate }}</div>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Live Date</label>
            <input type="date" class="form-input" v-model="form.liveDate">
          </div>
        </div>

        <!-- Starting Phase toggle -->
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:7px;cursor:pointer">
            <input type="checkbox" v-model="phaseOn" style="margin:0">
            Starting Phase
          </label>
          <select v-if="phaseOn" class="form-select" v-model="phaseId" style="margin-top:8px">
            <option v-for="ph in phasesStore.phaseConfig" :key="ph.id" :value="ph.id">
              {{ ph.name }}
            </option>
          </select>
        </div>

        <!-- Team Members -->
        <div class="form-group">
          <label class="form-label">Team Members</label>
          <TeamMemberPicker v-model="assignedMemberIds" />
        </div>

        <!-- Additional Details accordion -->
        <div>
          <div class="np-accord-hdr" @click="detailsOpen = !detailsOpen">
            Additional Details
            <span class="np-accord-arrow" :class="{ open: detailsOpen }">▶</span>
          </div>
          <div v-if="detailsOpen" class="np-accord-body">
            <div class="np-row">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Sitemap URL</label>
                <input class="form-input" v-model="form.sitemapUrl" placeholder="https://…">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Builder Link</label>
                <input class="form-input" v-model="form.builderLink" placeholder="Builder URL…">
              </div>
            </div>
            <div class="np-row" style="margin-top:8px">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Briefing</label>
                <input class="form-input" v-model="form.briefingUrl" placeholder="Briefing link…">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Google Keep</label>
                <input class="form-input" v-model="form.googleKeepUrl" placeholder="https://keep.google.com/…">
              </div>
            </div>
            <div class="np-row" style="margin-top:8px">
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Google Drive</label>
                <input class="form-input" v-model="form.logoSetUrl" placeholder="Drive folder link…">
              </div>
              <div class="form-group" style="margin-bottom:0">
                <label class="form-label">Notes</label>
                <input class="form-input" v-model="form.notes" placeholder="Notes…">
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="np-actions">
          <button class="btn btn-ghost btn-sm" @click="$emit('cancel')" :disabled="saving">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="create" :disabled="saving">
            <span v-if="saving" style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;flex-shrink:0"></span>
            {{ saving ? 'Creating…' : 'Create Project' }}
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import TagInput from '@/components/shared/TagInput.vue'
import TeamMemberPicker from '@/components/shared/TeamMemberPicker.vue'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore } from '@/stores/phases'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { useActivityLog } from '@/composables/useActivityLog'

const emit = defineEmits(['created', 'cancel'])
const router = useRouter()
const projectsStore = useProjectsStore()
const phasesStore   = usePhasesStore()
const authStore     = useAuthStore()
const teamStore     = useTeamStore()
const { emptyPhaseEntry, autoCompletePreviousPhases } = usePhaseLogic()
const { logActivity } = useActivityLog()

const form = reactive({
  name: '', url: '', originalSite: '',
  platform: 'WordPress', projectType: 'new_site',
  kickstartDate: new Date().toISOString().slice(0, 10), liveDate: '',
  sitemapUrl: '', builderLink: '', briefingUrl: '',
  googleKeepUrl: '', logoSetUrl: '', notes: '',
})
const langTags         = ref(['NL'])
const phaseOn          = ref(false)
const phaseId          = ref('kickstart')
const assignedMemberIds = ref([])
const detailsOpen      = ref(true)
const errors           = reactive({})
const saving           = ref(false)

function buildDefaultPhaseData() {
  const pd = {}
  for (const ph of phasesStore.phaseConfig) {
    pd[ph.id] = emptyPhaseEntry()
    if (ph.subPhases?.length) {
      pd[ph.id].subPhases = {}
      for (const sp of ph.subPhases) {
        pd[ph.id].subPhases[sp.id] = emptyPhaseEntry()
      }
    }
  }
  return pd
}

function validate() {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.name.trim())       errors.name         = 'Project name is required.'
  if (!langTags.value.length)  errors.language     = 'At least one language is required.'
  if (!form.platform)          errors.platform     = 'Platform is required.'
  if (!form.projectType)       errors.projectType  = 'Type is required.'
  if (!form.kickstartDate)     errors.kickstartDate = 'Kickstart date is required.'
  return !Object.keys(errors).length
}

async function create() {
  saving.value = true
  if (!validate()) { saving.value = false; return }
  try {
    const now         = new Date().toISOString()
    const targetPhase = phaseOn.value ? phaseId.value : 'kickstart'
    const phaseData   = buildDefaultPhaseData()
    autoCompletePreviousPhases(targetPhase, phaseData, phasesStore.phaseConfig)

    const assignedMembers = assignedMemberIds.value
      .map(id => teamStore.teamMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => ({
        id: m.id, name: m.name,
        initials: m.initials || m.avatarInitials || '',
        avatarColor: m.avatarColor || '#6366f1',
      }))

    const docData = {
      name:            form.name.trim(),
      url:             form.url.trim(),
      originalSite:    form.originalSite.trim(),
      language:        langTags.value.join(', '),
      platform:        form.platform,
      projectType:     form.projectType,
      kickstartDate:   form.kickstartDate,
      liveDate:        form.liveDate,
      siteStatus:      'development',
      currentPhase:    targetPhase,
      currentSubPhase: null,
      activePhases:    [{ phase: targetPhase, subPhase: null }],
      phaseData,
      assignedMembers,
      developer:       assignedMembers[0]?.name || '',
      sitemapUrl:      form.sitemapUrl.trim(),
      builderLink:     form.builderLink.trim(),
      briefingUrl:     form.briefingUrl.trim(),
      googleKeepUrl:   form.googleKeepUrl.trim(),
      logoSetUrl:      form.logoSetUrl.trim(),
      notes:           form.notes.trim(),
      googleSheets:    [],
      langStatus:      {},
      phaseHistory:    [],
      onHoldSince:     null,
      onHoldReason:    '',
      cancelledAt:     null,
      cancelledReason: '',
      archived:        false,
      createdBy:       authStore.currentUser?.name || '',
      createdAt:       now,
      updatedAt:       now,
    }

    const created = await projectsStore.createProject(docData)
    logActivity(created.id, 'project_created', { name: docData.name }).catch(() => {})

    emit('created', created)
    router.push('/projects/' + created.id)
  } catch (err) {
    console.error('Create project error:', err)
    saving.value = false
  }
}
</script>
