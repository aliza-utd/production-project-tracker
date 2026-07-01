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

        <!-- Row 2: Main Language | Platform | Type -->
        <div class="np-row np-row-3">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Main Language *</label>
            <select class="form-select" v-model="mainLanguage">
              <option v-for="lang in LANGUAGE_OPTIONS" :key="lang" :value="lang">{{ lang }}</option>
              <option value="Other">Other…</option>
            </select>
            <input v-if="mainLanguage === 'Other'"
              class="form-input" v-model="mainLanguageOther"
              placeholder="Language code (e.g. DE)"
              style="margin-top:5px">
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

        <!-- Additional Languages -->
        <div class="np-row">
          <div class="form-group" style="margin-bottom:0;flex:1">
            <label class="form-label">Additional Languages</label>
            <TagInput v-model="additionalLanguages" placeholder="Add languages…" />
            <div style="font-size:11px;color:var(--muted);margin-top:4px">
              These will generate a Languages phase after Activation
            </div>
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
            <option v-for="ph in phasesStore.phaseConfig.filter(p => p.id !== 'languages')" :key="ph.id" :value="ph.id">
              {{ ph.name }}
            </option>
          </select>
        </div>

        <!-- Developer Assignments -->
        <div class="np-row" style="margin-top:4px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Lead Developer</label>
            <select class="form-select" v-model="leadDeveloperId">
              <option value="">— None —</option>
              <option v-for="m in developerMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;flex:1">
            <label class="form-label">Developers Involved</label>
            <TeamMemberPicker v-model="developersInvolvedIds" :members="developersInvolvedOptions" />
          </div>
        </div>
        <div class="np-row np-row-3" style="margin-top:8px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Web Services</label>
            <select class="form-select" v-model="webServicesAssigneeId">
              <option value="">— None —</option>
              <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Multimedia</label>
            <select class="form-select" v-model="multimediaAssigneeId">
              <option value="">— None —</option>
              <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Quality Check</label>
            <select class="form-select" v-model="qaAssigneeId">
              <option value="">— None —</option>
              <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
            </select>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input class="form-input" v-model="form.notes" placeholder="Notes…">
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TagInput from '@/components/shared/TagInput.vue'
import TeamMemberPicker from '@/components/shared/TeamMemberPicker.vue'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore } from '@/stores/phases'
import { useAuthStore } from '@/stores/auth'
import { useTeamStore } from '@/stores/team'
import { useRolesStore } from '@/stores/roles'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { useActivityLog } from '@/composables/useActivityLog'
import { useChecklistTemplatesStore } from '@/stores/checklistTemplates'
import { useLinkTemplatesStore }      from '@/stores/linkTemplates'

const emit = defineEmits(['created', 'cancel'])
const router = useRouter()
const projectsStore              = useProjectsStore()
const phasesStore                = usePhasesStore()
const authStore                  = useAuthStore()
const teamStore                  = useTeamStore()
const rolesStore                 = useRolesStore()
const checklistTemplatesStore = useChecklistTemplatesStore()
const linkTemplatesStore      = useLinkTemplatesStore()
const { emptyPhaseEntry, autoCompletePreviousPhases, generateLanguagePhaseData } = usePhaseLogic()
const { logActivity } = useActivityLog()

function uidShort() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36) }

onMounted(() => {
  checklistTemplatesStore.fetchTemplates()
  linkTemplatesStore.fetchTemplates()
})

const LANGUAGE_OPTIONS = ['NL', 'EN', 'FR', 'DE', 'ES', 'IT', 'PT', 'PL', 'CS', 'HU', 'RO', 'TR', 'AR', 'ZH', 'JA', 'KO', 'RU']

const form = reactive({
  name: '', url: '', originalSite: '',
  platform: 'WordPress', projectType: 'new_site',
  kickstartDate: new Date().toISOString().slice(0, 10), liveDate: '',
  notes: '',
})
const mainLanguage        = ref('NL')
const mainLanguageOther   = ref('')
const additionalLanguages = ref([])
const phaseOn             = ref(false)
const phaseId             = ref('kickstart')
const errors              = reactive({})
const saving              = ref(false)

// ── Role-specific assignment fields ──────────────────────────────────────────
const leadDeveloperId      = ref('')
const developersInvolvedIds = ref([])

// Pre-fill from phase config defaults (only for new projects).
// Sub-phases inherit the parent phase default when their own defaultAssigneeId is null.
const _prodPhase  = phasesStore.phaseConfig.find(p => p.id === 'production')
const _wsSp       = (_prodPhase?.subPhases || []).find(s => s.id === 'web_services')
const _mmSp       = (_prodPhase?.subPhases || []).find(s => s.id === 'multimedia')
const _qaPhase    = phasesStore.phaseConfig.find(p => p.id === 'qa')
const webServicesAssigneeId = ref(_wsSp?.defaultAssigneeId || _prodPhase?.defaultAssigneeId || '')
const multimediaAssigneeId  = ref(_mmSp?.defaultAssigneeId || _prodPhase?.defaultAssigneeId || '')
const qaAssigneeId          = ref(_qaPhase?.defaultAssigneeId || '')

const developerMembers = computed(() =>
  teamStore.teamMembers.filter(m => {
    if (!m.active) return false
    const roleId = m.roleId || m.role
    const role   = rolesStore.roles.find(r => r.id === roleId)
    return role ? role.permissions?.canViewAllProjects === false : false
  })
)

const developersInvolvedOptions = computed(() =>
  leadDeveloperId.value
    ? developerMembers.value.filter(m => m.id !== leadDeveloperId.value)
    : developerMembers.value
)

const allActiveMembers = computed(() =>
  teamStore.teamMembers.filter(m => m.active !== false)
)

function effectiveMainLanguage() {
  return mainLanguage.value === 'Other'
    ? (mainLanguageOther.value.trim() || 'Other')
    : mainLanguage.value
}

function buildDefaultPhaseData() {
  const pd         = {}
  const checklists = {}

  console.log('[Checklist Debug] all templates:', checklistTemplatesStore.templates)

  for (const ph of phasesStore.phaseConfig) {
    if (ph.id === 'languages') continue
    pd[ph.id] = emptyPhaseEntry()
    const phTplItems = checklistTemplatesStore.getTemplateItems(ph.id)
    console.log('[Checklist Debug] getTemplateItems(' + ph.id + '):', checklistTemplatesStore.getTemplateItems(ph.id))
    if (phTplItems.length) {
      checklists[ph.id] = phTplItems.map(item => ({
        itemId: item.id, name: item.name, status: 'not-started',
      }))
    }
    if (ph.subPhases?.length) {
      pd[ph.id].subPhases = {}
      for (const sp of ph.subPhases) {
        pd[ph.id].subPhases[sp.id] = emptyPhaseEntry()
        const spTplItems = checklistTemplatesStore.getTemplateItems(sp.id)
        console.log('[Checklist Debug] getTemplateItems(' + sp.id + '):', checklistTemplatesStore.getTemplateItems(sp.id))
        if (spTplItems.length) {
          checklists[sp.id] = spTplItems.map(item => ({
            itemId: item.id, name: item.name, status: 'not-started',
          }))
        }
      }
    }
  }
  if (additionalLanguages.value.length > 0) {
    pd.languages = generateLanguagePhaseData(additionalLanguages.value)
  }
  console.log('[Checklist Debug] checklists map to be written:', JSON.stringify(checklists))
  return { phaseData: pd, checklists }
}

function validate() {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.name.trim())   errors.name         = 'Project name is required.'
  if (!form.platform)      errors.platform     = 'Platform is required.'
  if (!form.projectType)   errors.projectType  = 'Type is required.'
  if (!form.kickstartDate) errors.kickstartDate = 'Kickstart date is required.'
  return !Object.keys(errors).length
}

async function create() {
  saving.value = true
  if (!validate()) { saving.value = false; return }
  try {
    const now         = new Date().toISOString()
    const targetPhase = phaseOn.value ? phaseId.value : 'kickstart'
    // Ensure templates are loaded from Firestore before snapshotting
    await checklistTemplatesStore.fetchTemplates()
    await linkTemplatesStore.fetchTemplates()
    const { phaseData, checklists } = buildDefaultPhaseData()
    // Instantiate links from current link_templates (blank URLs)
    const links = linkTemplatesStore.templates.map((tpl, i) => ({
      id: uidShort(),
      name: tpl.name,
      url: '',
      order: tpl.order || i + 1,
    }))
    // Exclude Languages phase from auto-complete (it activates separately after Activation)
    autoCompletePreviousPhases(targetPhase, phaseData, phasesStore.phaseConfig.filter(p => p.id !== 'languages'))

    const allMemberIds = [
      leadDeveloperId.value,
      ...developersInvolvedIds.value,
      webServicesAssigneeId.value,
      multimediaAssigneeId.value,
      qaAssigneeId.value,
    ].filter(Boolean)
    const uniqueIds = [...new Set(allMemberIds)]
    const assignedMembers = uniqueIds
      .map(id => teamStore.teamMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => ({
        id: m.id, name: m.name,
        initials: m.initials || m.avatarInitials || '',
        avatarColor: m.avatarColor || '#6366f1',
      }))

    const leadMember = teamStore.teamMembers.find(m => m.id === leadDeveloperId.value)

    const docData = {
      name:                     form.name.trim(),
      url:                      form.url.trim(),
      originalSite:             form.originalSite.trim(),
      mainLanguage:             effectiveMainLanguage(),
      additionalLanguages:      additionalLanguages.value,
      platform:                 form.platform,
      projectType:              form.projectType,
      kickstartDate:            form.kickstartDate,
      liveDate:                 form.liveDate,
      siteStatus:               'development',
      currentPhase:             targetPhase,
      currentSubPhase:          null,
      activePhases:             [{ phase: targetPhase, subPhase: null }],
      phaseData,
      leadDeveloperId:          leadDeveloperId.value || null,
      developersInvolvedIds:    developersInvolvedIds.value,
      webServicesAssigneeId:    webServicesAssigneeId.value || null,
      multimediaAssigneeId:     multimediaAssigneeId.value || null,
      qaAssigneeId:             qaAssigneeId.value || null,
      assignedMembers,
      developer:                leadMember?.name || '',
      notes:               form.notes.trim(),
      checklists:          checklists,
      links:               links,
      langStatus:          {},
      phaseHistory:        [],
      onHoldSince:         null,
      onHoldReason:        '',
      cancelledAt:         null,
      cancelledReason:     '',
      archived:            false,
      shareToken:          null,
      templateId:          null,
      createdBy:           authStore.currentUser?.name || '',
      createdAt:           now,
      updatedAt:           now,
    }

    console.log('[Checklist Debug] full docData:', docData)
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
