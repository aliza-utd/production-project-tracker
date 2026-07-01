<template>
  <div class="content">
    <!-- Loading / Not Found -->
    <div v-if="pageLoading && !localProject"
      style="display:flex;align-items:center;justify-content:center;padding:80px;gap:12px;color:var(--muted)">
      <span style="font-size:22px;animation:spin 1s linear infinite">⏳</span>
      <span>Loading project…</span>
    </div>

    <div v-else-if="!localProject && !pageLoading"
      style="text-align:center;padding:80px;color:var(--muted)">
      <div style="font-size:36px;margin-bottom:12px">🔍</div>
      <div style="font-size:16px;font-weight:600">Project not found</div>
      <button class="btn btn-secondary btn-sm" style="margin-top:16px" @click="router.push('/projects')">
        ← Back to Projects
      </button>
    </div>

    <div v-else-if="localProject" class="pd-wrap">

      <!-- ── Back button + bell ── -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <button class="pd-back-btn" @click="router.push('/projects')">← Back to Projects</button>
        <NotificationBell />
      </div>

      <!-- ── Header card ── -->
      <div class="pd-header">

        <!-- Top row: project name + action buttons -->
        <div class="pd-header-top">
          <div class="pd-header-title">{{ localProject.name }}</div>
          <div class="pd-header-actions">
            <!-- Share -->
            <div style="position:relative">
              <button class="btn btn-secondary btn-sm" @click="shareProject" title="Copy project link">🔗 Share</button>
              <span v-if="shareCopied" class="pd-tip">Link copied!</span>
            </div>
            <!-- Export -->
            <button class="btn btn-secondary btn-sm" @click="exportCurrentCSV" title="Download as CSV">⬇ CSV</button>
            <div style="position:relative">
              <button class="btn btn-secondary btn-sm" @click="copyCurrentTSV" title="Copy as TSV for Google Sheets">⎘ TSV</button>
              <span v-if="tsvCopied" class="pd-tip">Copied!</span>
            </div>
            <!-- Time Calculator -->
            <div style="position:relative">
              <button class="btn btn-secondary btn-sm" @click="showTimeCalc = !showTimeCalc" title="Working day calculator">⏱</button>
              <div v-if="showTimeCalc" class="pd-timecalc-popup">
                <TimeCalcWidget :closeable="true" @close="showTimeCalc = false" />
              </div>
            </div>
            <!-- Archive -->
            <button v-if="localProject.id" class="btn btn-secondary btn-sm" @click="showArchiveConfirm = true">
              🗂️ Archive
            </button>
          </div>
        </div>

        <!-- Site URL -->
        <div v-if="localProject.url" class="pd-header-url">
          <a :href="safeUrl(localProject.url)" target="_blank" class="ext"
            style="font-size:13px;color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:4px">
            🔗 {{ localProject.url }}
          </a>
        </div>

        <!-- Badges row -->
        <div class="pd-badge-row" style="margin-top:10px">
          <span class="badge" :class="localProject.platform === 'WordPress' ? 'badge-wp' : 'badge-blogger'">
            {{ localProject.platform }}
          </span>
          <span v-if="localProject.projectType" class="pd-type-badge">
            {{ projectTypeLabel(localProject.projectType) }}
          </span>
          <span v-for="lang in langPills(localProject)" :key="lang" class="pd-lang-pill">
            {{ lang }}
          </span>
          <SiteStatusBadge :status="localProject.siteStatus || 'development'" />
          <span v-if="isUrgent(localProject.liveDate)" class="urgent-pill">⚡ Urgent</span>
          <span v-if="localProject.liveDate" style="font-size:12px;color:var(--muted)">
            📅 {{ fmtDate(localProject.liveDate) }}
          </span>
        </div>

        <!-- Language status row (multi-language projects only) -->
        <div v-if="langStatusGroups.length" class="pd-lang-status-row">
          <template v-for="(group, gi) in langStatusGroups" :key="group.status">
            <span v-if="gi > 0" class="pd-lang-status-sep">·</span>
            <span class="pd-lang-status-item">
              <span class="pd-lang-dot" :data-status="group.status"></span>
              {{ langStatusText(group.status) }} ({{ group.langs.join(', ') }})
            </span>
          </template>
        </div>


      </div>

      <!-- ── On-Hold Banner ── -->
      <OnHoldBanner
        v-if="localProject.siteStatus === 'on-hold'"
        :since="localProject.onHoldSince"
        :reason="localProject.onHoldReason"
        :canReactivate="authStore.isManager"
        @reactivate="changeSiteStatus('development')"
      />

      <!-- ── Body: Main + Right Panel ── -->
      <div class="pd-body">

        <!-- Main tab area -->
        <div class="pd-main">
          <div class="proj-tabs-bar">
            <div class="proj-tab" :class="{ active: projTab === 'phases' }" @click="projTab = 'phases'">
              Phases
            </div>
            <div class="proj-tab" :class="{ active: projTab === 'info' }" @click="projTab = 'info'">
              Project Details
            </div>
            <div v-if="localProject.id" class="proj-tab" :class="{ active: projTab === 'links' }"
              @click="projTab = 'links'">
              Links
            </div>
            <div v-if="localProject.id" class="proj-tab" :class="{ active: projTab === 'comments' }"
              @click="projTab = 'comments'">
              Comments
              <span v-if="projectComments.length"
                style="font-size:11px;background:var(--primary);color:#fff;border-radius:10px;padding:1px 6px;margin-left:5px">
                {{ projectComments.length }}
              </span>
            </div>
            <div v-if="localProject.id" class="proj-tab" :class="{ active: projTab === 'activity' }"
              @click="projTab = 'activity'">
              Logs
            </div>
          </div>

          <div class="proj-tab-content">

            <!-- ══ PHASES TAB ══ -->
            <div v-if="projTab === 'phases'">

              <!-- View toggle -->
              <div style="display:flex;justify-content:flex-end;margin-top:16px;margin-bottom:12px">
                <div class="ph-view-toggle">
                  <button class="ph-view-btn" :class="{ active: phaseView === 'cards' }"
                    @click="phaseView = 'cards'">Cards</button>
                  <button class="ph-view-btn" :class="{ active: phaseView === 'list' }"
                    @click="phaseView = 'list'">List</button>
                  <button class="ph-view-btn" :class="{ active: phaseView === 'kanban' }"
                    @click="phaseView = 'kanban'">Kanban</button>
                </div>
              </div>

              <!-- Live-with-pending-languages banner -->
              <div v-if="isLiveWithPendingLanguages" class="pd-live-lang-banner">
                🌐 Site is Live. Completing remaining language versions:
                <span
                  v-for="pill in pendingLanguagePills" :key="pill.lang"
                  class="pd-lang-lock-pill"
                  :class="'pill-lang-' + pill.status"
                >
                  {{ pill.lang }}{{ pill.status === 'done' ? ' ✓' : pill.status === 'active' ? ' ●' : '' }}
                </span>
                — Other phases are locked.
              </div>

              <!-- Cards View -->
              <div v-if="phaseView === 'cards'" style="margin-top:16px;display:flex;flex-direction:column;gap:16px">
                <PhaseCard
                  v-for="ph in dynamicPhaseConfig"
                  :key="ph.id"
                  :phase="getPhaseData(ph.id)"
                  :phaseId="ph.id"
                  :phaseDef="ph"
                  :projectId="localProject.id"
                  :teamMembers="teamStore.teamMembers"
                  :readonly="readonly && !(localProject.siteStatus === 'live' && ph.id === 'activation')"
                  :locked="isLiveWithPendingLanguages && ph.id !== 'languages' && ph.id !== 'activation'"
                  :expandedPhaseConfig="dynamicPhaseConfig"
                  @update-phase="onUpdatePhase"
                  @activation-complete="onActivationComplete"
                  @next-phase-started="onNextPhaseStarted"
                  @phase-toast="showToast"
                />
              </div>

              <!-- List View -->
              <div v-else-if="phaseView === 'list'" style="margin-top:16px">
                <PhaseListView
                  :phaseData="localProject.phaseData || {}"
                  :phaseConfig="dynamicPhaseConfig"
                  :teamMembers="teamStore.teamMembers"
                  :projectId="localProject.id"
                  :siteStatus="localProject.siteStatus"
                  :readonly="readonly"
                  @update-phase="onUpdatePhase"
                  @activation-complete="onActivationComplete"
                  @next-phase-started="onNextPhaseStarted"
                />
              </div>

              <!-- Kanban View -->
              <div v-else-if="phaseView === 'kanban'" style="margin-top:16px">
                <PhaseKanbanView
                  :phaseData="localProject.phaseData || {}"
                  :phaseConfig="dynamicPhaseConfig"
                  :teamMembers="teamStore.teamMembers"
                  :projectId="localProject.id"
                  :siteStatus="localProject.siteStatus"
                  :readonly="readonly"
                  @update-phase="onUpdatePhase"
                  @activation-complete="onActivationComplete"
                  @next-phase-started="onNextPhaseStarted"
                />
              </div>
            </div>

            <!-- ══ PROJECT DETAILS TAB ══ -->
            <div v-else-if="projTab === 'info'">

              <!-- Project Info Section -->
              <div class="il-section">
                <div class="il-section-hdr">
                  <span class="il-section-title">Project Info</span>
                  <button v-if="!infoEditMode && authStore.isManager" class="btn btn-secondary btn-xs" @click="enterEditMode">
                    ✏️ Edit
                  </button>
                </div>

                <!-- READ-ONLY MODE -->
                <div v-if="!infoEditMode">
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Site URL</div>
                      <a v-if="localProject.url" :href="safeUrl(localProject.url)" target="_blank" class="il-link">
                        {{ localProject.url }}
                      </a>
                      <div v-else class="il-empty">—</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Original Site URL</div>
                      <a v-if="localProject.originalSite" :href="safeUrl(localProject.originalSite)" target="_blank" class="il-link">
                        {{ localProject.originalSite }}
                      </a>
                      <div v-else class="il-empty">—</div>
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Main Language</div>
                      <div class="il-value">{{ localProject.mainLanguage || langPills(localProject)[0] || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Platform</div>
                      <div class="il-value">{{ localProject.platform || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Type</div>
                      <div class="il-value">{{ projectTypeLabel(localProject.projectType) || '—' }}</div>
                    </div>
                  </div>
                  <div v-if="(localProject.additionalLanguages || []).length" class="il-row" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Additional Languages</div>
                      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">
                        <span v-for="l in localProject.additionalLanguages" :key="l" class="pd-lang-pill">{{ l }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Kickstart Date</div>
                      <div class="il-value">{{ fmtDate(localProject.kickstartDate) || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Live Date</div>
                      <div class="il-value">{{ fmtDate(localProject.liveDate) || '—' }}</div>
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Preview Date</div>
                      <div class="il-value">{{ fmtDate(localProject.previewDate) || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Delivery Date</div>
                      <div class="il-value">{{ fmtDate(localProject.deliveryDate) || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Deadline</div>
                      <div class="il-value">{{ fmtDate(localProject.deadline) || '—' }}</div>
                    </div>
                  </div>
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Current Phase</div>
                      <div class="il-value">{{ primaryPhaseName || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Lead Developer</div>
                      <div class="il-value">{{ memberNameById(localProject.leadDeveloperId) || localProject.developer || '—' }}</div>
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Web Services</div>
                      <div class="il-value">{{ memberNameById(localProject.webServicesAssigneeId) || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Multimedia</div>
                      <div class="il-value">{{ memberNameById(localProject.multimediaAssigneeId) || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Quality Check</div>
                      <div class="il-value">{{ memberNameById(localProject.qaAssigneeId) || '—' }}</div>
                    </div>
                  </div>
                </div><!-- end read-only -->

                <!-- EDIT MODE -->
                <div v-else>
                  <div class="form-group" style="margin-bottom:12px">
                    <label class="form-label">Project Name</label>
                    <input class="form-input" v-model="localProject.name" placeholder="Project name…">
                  </div>
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Site URL</label>
                      <input class="form-input" v-model="localProject.url" placeholder="https://…">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Original Site URL</label>
                      <input class="form-input" v-model="localProject.originalSite" placeholder="Source site…">
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Main Language *</label>
                      <select class="form-select" v-model="editMainLanguage">
                        <option v-for="lang in LANGUAGE_OPTIONS" :key="lang" :value="lang">{{ lang }}</option>
                        <option value="Other">Other…</option>
                      </select>
                      <input v-if="editMainLanguage === 'Other'"
                        class="form-input" v-model="editMainLanguageOther"
                        placeholder="Language code (e.g. DE)"
                        style="margin-top:5px">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Platform</label>
                      <select class="form-select" v-model="localProject.platform">
                        <option>WordPress</option>
                        <option>Blogger</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Type</label>
                      <select class="form-select" v-model="localProject.projectType">
                        <option value="new_site">New Site</option>
                        <option value="redesign">Redesign</option>
                        <option value="smart_blog">Smart Blog</option>
                        <option value="others">Others</option>
                        <option value="website">Website</option>
                        <option value="blog">Blog</option>
                      </select>
                    </div>
                  </div>
                  <!-- Additional Languages -->
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0;flex:1">
                      <label class="form-label">Additional Languages</label>
                      <TagInput v-model="localProject.additionalLanguages" placeholder="Add languages…" />
                      <div style="font-size:11px;color:var(--muted);margin-top:4px">
                        These will generate a Languages phase after Activation
                      </div>
                    </div>
                  </div>
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Kickstart Date</label>
                      <input type="date" class="form-input" v-model="localProject.kickstartDate">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Live Date</label>
                      <input type="date" class="form-input" v-model="localProject.liveDate">
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Preview Date</label>
                      <input type="date" class="form-input" v-model="localProject.previewDate">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Delivery Date</label>
                      <input type="date" class="form-input" v-model="localProject.deliveryDate">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Deadline</label>
                      <input type="date" class="form-input" v-model="localProject.deadline">
                    </div>
                  </div>
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Current Phase</label>
                      <select class="form-select" v-model="editPhaseValue">
                        <option v-for="opt in phaseOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Lead Developer</label>
                      <select class="form-select" v-model="editLeadDeveloperId">
                        <option value="">— None —</option>
                        <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0;flex:1">
                      <label class="form-label">Developers Involved</label>
                      <TeamMemberPicker v-model="editDevelopersInvolvedIds" :members="developersInvolvedMembers" />
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Web Services</label>
                      <select class="form-select" v-model="editWebServicesAssigneeId">
                        <option value="">— None —</option>
                        <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Multimedia</label>
                      <select class="form-select" v-model="editMultimediaAssigneeId">
                        <option value="">— None —</option>
                        <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Quality Check</label>
                      <select class="form-select" v-model="editQaAssigneeId">
                        <option value="">— None —</option>
                        <option v-for="m in allActiveMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
                      </select>
                    </div>
                  </div>
                  <!-- Save / Cancel -->
                  <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid var(--border)">
                    <button class="btn btn-ghost btn-sm" @click="cancelEdit">Cancel</button>
                    <button class="btn btn-primary btn-sm" :disabled="infoSaving" @click="infoSave">
                      {{ infoSaving ? 'Saving…' : 'Save Changes' }}
                    </button>
                  </div>
                </div><!-- end edit mode -->
              </div><!-- end Project Info section -->

              <!-- Language Status Section -->
              <div v-if="(localProject.additionalLanguages || []).length > 0" class="il-section">
                <div class="il-section-hdr" style="margin-bottom:4px">
                  <span class="il-section-title">Language Status</span>
                </div>
                <div v-for="lang in (localProject.additionalLanguages || [])" :key="lang" class="il-lang-row">
                  <span class="il-lang-name">{{ lang }}</span>
                  <select v-if="authStore.isManager"
                    class="form-select" style="font-size:13px;width:auto;min-width:150px"
                    :value="(localProject.langStatus || {})[lang] || 'not-started'"
                    @change="saveLangStatus(lang, $event.target.value)">
                    <option value="live">● Live</option>
                    <option value="in-production">◉ In Production</option>
                    <option value="not-started">○ Not Started</option>
                  </select>
                  <span v-else class="il-lang-badge"
                    :class="langStatusClass((localProject.langStatus || {})[lang])">
                    {{ langStatusLabel((localProject.langStatus || {})[lang]) }}
                  </span>
                </div>
              </div>

            </div><!-- end info tab -->

            <!-- ══ LINKS TAB ══ -->
            <div v-else-if="projTab === 'links'">
              <div class="il-section" style="margin-top:16px">
                <div class="il-section-hdr">
                  <span class="il-section-title">Links</span>
                  <div style="display:flex;gap:6px">
                    <button class="btn btn-secondary btn-xs" :disabled="syncingTemplates"
                      @click="syncLinkTemplates" title="Add any missing link templates to this project">
                      {{ syncingTemplates ? 'Syncing…' : '⟳ Sync Templates' }}
                    </button>
                    <button class="btn btn-secondary btn-xs" @click="showAddLink = !showAddLink">
                      + Add Link
                    </button>
                  </div>
                </div>
                <div v-if="showAddLink"
                  style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:14px">
                  <div class="il-row" style="margin-bottom:10px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Name</label>
                      <input class="form-input" placeholder="e.g. Content Sheet" v-model="newLink.name">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">URL</label>
                      <input class="form-input" placeholder="https://…" v-model="newLink.url">
                    </div>
                  </div>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-primary btn-sm" @click="addLink">Add Link</button>
                    <button class="btn btn-ghost btn-sm" @click="showAddLink = false">Cancel</button>
                  </div>
                </div>
                <div v-if="(localProject.links || []).length">
                  <div v-for="lnk in (localProject.links || [])" :key="lnk.id" class="il-sheet-row">
                    <input class="form-input" v-model="lnk.name" placeholder="Link name"
                      @blur="saveLinkImmediate" style="font-size:13px;flex:0 0 180px;min-width:0">
                    <input class="form-input" v-model="lnk.url" placeholder="https://…"
                      @blur="saveLinkImmediate" style="font-size:13px">
                    <button class="btn-icon" @click="removeLink(lnk.id)" title="Remove">🗑️</button>
                  </div>
                </div>
                <div v-else style="font-size:13px;color:var(--muted)">No links added yet.</div>
              </div>
            </div><!-- end links tab -->

            <!-- ══ COMMENTS TAB ══ -->
            <div v-else-if="projTab === 'comments'">
              <div v-if="commentsLoading"
                style="display:flex;align-items:center;gap:10px;padding:24px;color:var(--muted)">
                <span style="animation:spin 1s linear infinite">⏳</span> Loading comments…
              </div>
              <div v-else>
                <div v-if="!projectComments.length"
                  style="color:var(--muted);font-size:14px;margin-bottom:20px">
                  No comments yet. Be the first to add one.
                </div>

                <!-- Comment list -->
                <div v-for="c in projectComments" :key="c.id"
                  style="display:flex;gap:12px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
                  <div class="avatar avatar-sm"
                    :style="'background:' + (c.authorColor || '#6366f1') + ';flex-shrink:0'">
                    {{ c.authorInitials || '?' }}
                  </div>
                  <div style="flex:1;min-width:0">
                    <!-- Header row -->
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                      <span style="font-weight:600;font-size:14px">{{ c.authorName || 'Unknown' }}</span>
                      <span style="font-size:12px;color:var(--muted)">{{ fmtDateTime(c.createdAt) }}</span>
                      <span v-if="c.tag && c.tag !== 'general'"
                        class="badge"
                        :style="tagBadgeStyle(c.tag)">
                        {{ tagLabel(c.tag) }}
                      </span>
                      <span v-if="c.editedAt" style="font-size:11px;color:var(--muted);font-style:italic">(edited)</span>
                      <span v-if="isUnread(c)"
                        style="width:7px;height:7px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-left:auto"
                        title="New comment"></span>
                    </div>

                    <!-- Edit mode -->
                    <div v-if="editingComment.id === c.id">
                      <textarea class="form-textarea" v-model="editingComment.text" rows="3"
                        style="margin-bottom:8px;resize:vertical"></textarea>
                      <div style="display:flex;gap:8px">
                        <button class="btn btn-primary btn-sm" @click="saveEditComment(c.id)"
                          :disabled="!editingComment.text.trim()">Save</button>
                        <button class="btn btn-ghost btn-sm" @click="cancelEditComment">Cancel</button>
                      </div>
                    </div>

                    <!-- Read mode -->
                    <div v-else>
                      <div style="font-size:14px;white-space:pre-wrap;word-break:break-word">
                        <template v-for="(seg, si) in parseCommentSegments(c.text)" :key="si">
                          <span v-if="seg.type === 'mention'" class="cm-mention">{{ seg.content }}</span>
                          <span v-else>{{ seg.content }}</span>
                        </template>
                      </div>
                      <div v-if="canEditComment(c)"
                        style="display:flex;gap:12px;margin-top:6px">
                        <button
                          style="font-size:12px;color:var(--muted);background:none;border:none;padding:0;cursor:pointer"
                          @click="startEditComment(c)">Edit</button>
                        <button
                          style="font-size:12px;color:var(--danger);background:none;border:none;padding:0;cursor:pointer"
                          @click="deleteComment(c.id)">Delete</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Post form -->
                <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
                  <div style="position:relative;margin-bottom:10px">
                    <textarea class="form-textarea" ref="commentTextareaRef" v-model="newCommentText"
                      placeholder="Add a comment… (@ to mention someone)" rows="3"
                      style="width:100%;resize:vertical;margin-bottom:0"
                      @input="onCommentInput" @keydown="onCommentKeydown"></textarea>
                    <div v-if="mentionDropdown.show" class="cm-mention-dd">
                      <div v-for="m in mentionDropdown.filtered" :key="m.id"
                        class="cm-mention-item"
                        @mousedown.prevent="insertMention(m)">
                        <span class="pc-av"
                          style="width:22px;height:22px;font-size:9px;flex-shrink:0"
                          :style="{ background: m.avatarColor || '#6366f1' }">{{ m.initials }}</span>
                        {{ m.name }}
                      </div>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                    <select class="filter-select" v-model="newCommentTag" style="font-size:13px">
                      <option value="general">General</option>
                      <option value="delivery">Delivery</option>
                      <option value="blocker">Blocker</option>
                      <option value="urgent">Urgent</option>
                      <option value="fyi">FYI</option>
                    </select>
                    <button class="btn btn-primary btn-sm" @click="addComment"
                      :disabled="!newCommentText.trim()">Post Comment</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- ══ ACTIVITY/LOGS TAB ══ -->
            <div v-else-if="projTab === 'activity'">
              <div v-if="commentsLoading"
                style="display:flex;align-items:center;gap:10px;padding:24px;color:var(--muted)">
                <span style="animation:spin 1s linear infinite">⏳</span> Loading logs…
              </div>
              <div v-else>
                <div v-if="!projectActivityLog.length" style="color:var(--muted);font-size:14px;padding:8px 0">
                  No activity recorded yet.
                </div>
                <!-- Compact log list -->
                <div v-else style="display:flex;flex-direction:column">
                  <div v-for="entry in projectActivityLog" :key="entry.id"
                    style="display:flex;align-items:flex-start;gap:7px;padding:5px 0;border-bottom:1px solid var(--border)">
                    <span style="font-size:12px;flex-shrink:0;line-height:1.5">{{ activityIcon(entry.action) }}</span>
                    <div style="flex:1;min-width:0;font-size:12px;line-height:1.5;color:var(--text)">
                      <span style="font-weight:500">{{ describeActivity(entry) }}</span><span style="color:var(--muted)"> · {{ entry.performedBy?.name || entry.userName || 'System' }}</span>
                      <span v-if="activityDetail(entry)" style="display:block;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ activityDetail(entry) }}</span>
                    </div>
                    <span style="font-size:11px;color:var(--muted);white-space:nowrap;flex-shrink:0;line-height:1.5">{{ formatDate(entry.timestamp) }}</span>
                  </div>
                </div>
              </div>
            </div>

          </div><!-- end proj-tab-content -->
        </div><!-- end pd-main -->

        <!-- ── Right Panel ── -->
        <div class="pd-panel">

          <!-- Team -->
          <div class="pd-panel-card">
            <div class="pd-panel-title">Team</div>
            <div v-if="localProject.assignedMembers?.length" class="pd-team-avatars">
              <div v-for="m in localProject.assignedMembers" :key="m.id"
                class="pd-team-av"
                :style="{ background: m.avatarColor || '#6366f1' }">
                {{ m.initials || '?' }}
                <div class="pd-team-av-tip">{{ m.name }}</div>
              </div>
            </div>
            <div v-else style="font-size:12px;color:var(--muted)">No team assigned</div>
          </div>

          <!-- Quick Links -->
          <div class="pd-panel-card">
            <div class="pd-panel-title">Quick Links</div>
            <template v-if="hasQuickLinks">
              <div v-for="lnk in quickLinks" :key="lnk.id" class="pd-ql-item">
                <span class="pd-ql-icon">🔗</span>
                <a :href="safeUrl(lnk.url)" target="_blank" class="pd-ql-link">{{ lnk.name }}</a>
              </div>
            </template>
            <div v-else style="font-size:12px;color:var(--muted)">No links added</div>
          </div>

          <!-- Site Status (Managers only) -->
          <div v-if="authStore.isManager" class="pd-panel-card">
            <div class="pd-panel-title">Site Status</div>
            <select class="form-select" style="font-size:13px"
              :value="localProject.siteStatus"
              @change="requestSiteStatusChange($event.target.value)">
              <option value="development">Development</option>
              <option value="live">Live</option>
              <option value="on-hold">On-Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <!-- Phase Progress -->
          <div class="pd-panel-card">
            <div class="pd-panel-title">Phase Progress</div>
            <div v-if="!dynamicPhaseConfig.length" style="font-size:12px;color:var(--muted)">No phases configured</div>
            <div v-else class="pd-pp-list">
              <div v-for="ph in dynamicPhaseConfig" :key="ph.id" class="pd-pp-group">
                <!-- Parent row -->
                <div class="pd-pp-row" @click="onSidebarPhaseClick(ph)">
                  <span class="pd-pp-icon" :data-st="getPhaseStatus(localProject.phaseData || {}, ph.id)">
                    {{ phProgressIcon(getPhaseStatus(localProject.phaseData || {}, ph.id)) }}
                  </span>
                  <span class="pd-pp-name">{{ ph.name }}</span>
                  <span v-if="isLiveWithPendingLanguages && ph.id !== 'languages'"
                    style="font-size:10px;opacity:.55;flex-shrink:0" title="Locked while Languages phase completes">🔒</span>
                  <!-- Done + has sub-phases → show count with expand toggle -->
                  <template v-if="statusesStore.isComplete(getPhaseStatus(localProject.phaseData || {}, ph.id)) && (ph.subPhases || []).length">
                    <span class="pd-pp-badge" :data-st="statusesStore.completeStatusId()" style="cursor:pointer;gap:3px">
                      {{ doneSubCount(ph) }}/{{ ph.subPhases.length }}
                      <span style="opacity:.6;font-size:9px">{{ sidebarExpanded[ph.id] ? '▾' : '▸' }}</span>
                    </span>
                  </template>
                  <template v-else>
                    <span class="pd-pp-badge" :data-st="getPhaseStatus(localProject.phaseData || {}, ph.id)">
                      {{ phProgressLabel(getPhaseStatus(localProject.phaseData || {}, ph.id)) }}
                    </span>
                  </template>
                </div>
                <!-- Sub-phases: shown when active/blocked, or manually expanded when done -->
                <template v-if="shouldShowSubPhases(ph)">
                  <div
                    v-for="sp in (ph.subPhases || [])"
                    :key="sp.id"
                    class="pd-pp-row pd-pp-sub"
                    @click="scrollToPhase(ph.id)"
                  >
                    <span class="pd-pp-icon" :data-st="getSubPhaseStatus(localProject.phaseData || {}, ph.id, sp.id)">
                      {{ phProgressIcon(getSubPhaseStatus(localProject.phaseData || {}, ph.id, sp.id)) }}
                    </span>
                    <span class="pd-pp-name">{{ sp.name }}</span>
                    <span class="pd-pp-badge" :data-st="getSubPhaseStatus(localProject.phaseData || {}, ph.id, sp.id)">
                      {{ phProgressLabel(getSubPhaseStatus(localProject.phaseData || {}, ph.id, sp.id)) }}
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </div>

        </div><!-- end pd-panel -->
      </div><!-- end pd-body -->

      <!-- Toast notification -->
      <div v-if="toastMsg" class="pd-toast">{{ toastMsg }}</div>

    </div><!-- end pd-wrap -->

    <!-- ── Modals ── -->

    <!-- Archive Confirm -->
    <ConfirmModal
      v-if="showArchiveConfirm"
      title="Archive Project"
      message="This will archive the project and remove it from active views. Continue?"
      confirmText="Archive"
      variant="danger"
      @confirm="archiveProject"
      @cancel="showArchiveConfirm = false"
    />

    <!-- Mark Live Confirm -->
    <ConfirmModal
      v-if="showLiveConfirm"
      title="🎉 Activation Complete"
      :message="liveConfirmMessage"
      confirmText="Mark Live"
      @confirm="confirmMarkLive"
      @cancel="showLiveConfirm = false"
    />

    <!-- On-Hold Dialog -->
    <div v-if="holdDlg.show" class="confirm-wrap" @mousedown.self="holdDlg.show = false">
      <div class="confirm-box" style="max-width:460px">
        <div class="confirm-title">⚠ Put Project On-Hold?</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
          All editing will be locked until the project is reactivated.
        </div>
        <div class="form-group" style="margin-bottom:18px">
          <label class="form-label">Reason <span style="color:#dc2626">*</span></label>
          <textarea class="form-textarea" rows="3" v-model="holdDlg.reason"
            placeholder="Why is this project being put on hold?…"
            style="resize:vertical"></textarea>
        </div>
        <div class="confirm-btns">
          <button class="btn btn-secondary btn-sm" @click="holdDlg.show = false">Cancel</button>
          <button class="btn btn-sm" style="background:#d97706;color:#fff;border:none;font-weight:600"
            @click="confirmHold">Confirm On-Hold</button>
        </div>
      </div>
    </div>

    <!-- Cancel Project Dialog -->
    <div v-if="cancelDlg.show" class="confirm-wrap" @mousedown.self="cancelDlg.show = false">
      <div class="confirm-box" style="max-width:460px">
        <div class="confirm-title">Cancel Project?</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:14px">
          This project will be marked as <strong>Cancelled</strong> and moved to the Archived page.
        </div>
        <div class="form-group" style="margin-bottom:18px">
          <label class="form-label">Reason <span style="font-size:11px;color:var(--muted)">(optional)</span></label>
          <textarea class="form-textarea" rows="3" v-model="cancelDlg.reason"
            placeholder="Why is this project being cancelled?…"
            style="resize:vertical"></textarea>
        </div>
        <div class="confirm-btns">
          <button class="btn btn-secondary btn-sm" @click="cancelDlg.show = false">Keep Active</button>
          <button class="btn btn-danger btn-sm" @click="confirmCancelProject">Cancel Project</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore } from '@/stores/phases'
import { useTeamStore } from '@/stores/team'
import { useAuthStore } from '@/stores/auth'
import { useStatusesStore } from '@/stores/statuses'
import { useLinkTemplatesStore } from '@/stores/linkTemplates'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { subscribeToProject, getProjectComments, addProjectComment, updateProjectComment, deleteProjectComment, subscribeToActivityLog, createNotification } from '@/firebase-service'
import { useActivityLog } from '@/composables/useActivityLog'
import OnHoldBanner from '@/components/shared/OnHoldBanner.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import PhaseCard from '@/components/phases/PhaseCard.vue'
import PhaseListView from '@/components/phases/PhaseListView.vue'
import PhaseKanbanView from '@/components/phases/PhaseKanbanView.vue'
import TeamMemberPicker from '@/components/shared/TeamMemberPicker.vue'
import SiteStatusBadge from '@/components/shared/SiteStatusBadge.vue'
import TimeCalcWidget from '@/components/shared/TimeCalcWidget.vue'
import TagInput from '@/components/shared/TagInput.vue'
import NotificationBell from '@/components/layout/NotificationBell.vue'
import { downloadCSV, copyTSV } from '@/utils/exportUtils'

const LANGUAGE_OPTIONS = ['NL', 'EN', 'FR', 'DE', 'ES', 'IT', 'PT', 'PL', 'CS', 'HU', 'RO', 'TR', 'AR', 'ZH', 'JA', 'KO', 'RU']

const route        = useRoute()
const router       = useRouter()
const projectsStore  = useProjectsStore()
const phasesStore    = usePhasesStore()
const teamStore      = useTeamStore()
const authStore      = useAuthStore()
const statusesStore      = useStatusesStore()
const linkTemplatesStore = useLinkTemplatesStore()
const { logActivity } = useActivityLog()
const {
  emptyPhaseEntry, autoCompletePreviousPhases, generateDynamicPhaseConfig,
  generateLanguagePhaseData, sanitizeId,
  getPhaseStatus, getSubPhaseStatus,
} = usePhaseLogic()

// ── Core project state ────────────────────────────────────────────────────────
const localProject   = ref(null)
const latestSnapshot = ref(null)
const pageLoading    = ref(true)
let   unsubProject   = null
let   unsubActivityLog = null
const projTab       = ref('info')
const phaseView     = ref('list')
const infoEditMode  = ref(false)
const infoSaving    = ref(false)

// ── Role-specific assignment fields ──────────────────────────────────────────
const editLeadDeveloperId       = ref('')
const editDevelopersInvolvedIds = ref([])
const editWebServicesAssigneeId = ref('')
const editMultimediaAssigneeId  = ref('')
const editQaAssigneeId          = ref('')

// ── Comments + Activity ───────────────────────────────────────────────────────
const projectComments    = ref([])
const projectActivityLog = ref([])
const commentsLoading    = ref(false)
const newCommentText     = ref('')
const newCommentTag      = ref('general')
const editingComment     = reactive({ id: null, text: '' })
const lastReadTs         = ref('')
const commentTextareaRef = ref(null)
const mentionDropdown    = reactive({ show: false, query: '', filtered: [] })

// ── Links ─────────────────────────────────────────────────────────────────────
const showAddLink      = ref(false)
const newLink          = reactive({ name: '', url: '' })
const syncingTemplates = ref(false)

// ── Toast ─────────────────────────────────────────────────────────────────────
const toastMsg = ref('')
let _toastTimer = null
function showToast(msg) {
  toastMsg.value = msg
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => { toastMsg.value = '' }, 4000)
}
function onNextPhaseStarted(name) {
  showToast(`▶ ${name} has started`)
}

// ── Share / Export / TimeCalc ────────────────────────────────────────────────
const shareCopied  = ref(false)
const tsvCopied    = ref(false)
const showTimeCalc = ref(false)
let _shareTimer = null
let _tsvTimer   = null

function shareProject() {
  const url = `https://aliza-utd.github.io/production-project-tracker/projects/${localProject.value.id}`
  const fallback = () => {
    const ta = document.createElement('textarea')
    ta.value = url; ta.style.position = 'absolute'; ta.style.left = '-9999px'
    document.body.appendChild(ta); ta.select(); document.execCommand('copy')
    document.body.removeChild(ta)
    shareCopied.value = true
    clearTimeout(_shareTimer)
    _shareTimer = setTimeout(() => { shareCopied.value = false }, 2000)
  }
  navigator.clipboard?.writeText(url).then(() => {
    shareCopied.value = true
    clearTimeout(_shareTimer)
    _shareTimer = setTimeout(() => { shareCopied.value = false }, 2000)
  }).catch(fallback) ?? fallback()
}

function exportCurrentCSV() {
  if (!localProject.value) return
  downloadCSV([localProject.value], phasesStore.phaseConfig)
}

function copyCurrentTSV() {
  if (!localProject.value) return
  copyTSV([localProject.value], phasesStore.phaseConfig).then(() => {
    tsvCopied.value = true
    clearTimeout(_tsvTimer)
    _tsvTimer = setTimeout(() => { tsvCopied.value = false }, 2000)
  }).catch(() => {})
}

// ── Dialogs ───────────────────────────────────────────────────────────────────
const showArchiveConfirm  = ref(false)
const showLiveConfirm     = ref(false)
const liveConfirmMessage  = ref('Mark this site as Live?')
const holdDlg   = reactive({ show: false, reason: '' })
const cancelDlg = reactive({ show: false, reason: '' })

// Per-project edit-mode language state (mirrors localProject fields while editing)
const editMainLanguage      = ref('NL')
const editMainLanguageOther = ref('')

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36) }

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s.length > 10 ? s : s + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isUrgent(d) {
  if (!d) return false
  const diff = new Date(d + 'T00:00:00') - new Date()
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
}

function langPills(projectOrString) {
  if (!projectOrString) return []
  // New format: project object with mainLanguage field
  if (typeof projectOrString === 'object' && !Array.isArray(projectOrString) && projectOrString.mainLanguage) {
    return [projectOrString.mainLanguage, ...(projectOrString.additionalLanguages || [])].filter(Boolean)
  }
  // Old format: string or array (legacy data)
  if (Array.isArray(projectOrString)) return projectOrString.filter(Boolean)
  return projectOrString.split(',').map(s => s.trim()).filter(Boolean)
}

function projectTypeLabel(type) {
  const map = { new_site: 'New Site', redesign: 'Redesign', smart_blog: 'Smart Blog', others: 'Others', website: 'Website', blog: 'Blog', other: 'Others' }
  return map[type] || type || ''
}

function activityIcon(action) {
  const icons = {
    project_created:         '✨',
    field_updated:           '✏️',
    phase_status_changed:    '🔄',
    phase_auto_advanced:     '⏩',
    phase_assigned:          '👤',
    checklist_updated:       '☑️',
    time_logged:             '⏱️',
    comment_added:           '💬',
    comment_edited:          '✏️',
    comment_deleted:         '🗑️',
    link_updated:            '📊',
    site_status_changed:     '🔁',
    project_on_hold:         '⏸️',
    project_reactivated:     '▶️',
    project_archived:        '🗂️',
    language_status_changed: '🌐',
    // legacy action names
    created: '✨', updated: '✏️', phase_changed: '🔄', archived: '🗂️',
    status_changed: '🔁', on_hold: '⏸️', reactivated: '▶️',
    sheet_added: '📊', sheet_removed: '📊', lang_status: '🌐',
    checklist_added: '☑️', checklist_removed: '☑️', checklist_toggled: '✅',
    timelog_added: '⏱️', timelog_deleted: '⏱️',
  }
  return icons[action] || '📌'
}

function describeActivity(entry) {
  const d = entry.details || {}
  const STATUS_LABEL = {
    'not-started': 'Not Started', 'active': 'Active', 'blocked': 'Blocked', 'done': 'Done',
    'live': 'Live', 'development': 'Development', 'on-hold': 'On Hold',
    'cancelled': 'Cancelled', 'in-production': 'In Production',
  }
  const sl = v => STATUS_LABEL[v] || v || 'unknown'
  switch (entry.action) {
    case 'project_created':
      return 'Project created'
    case 'field_updated':
      return `${d.field || 'Field'} updated${d.oldValue ? ` from "${d.oldValue}"` : ''}${d.newValue !== undefined ? ` to "${d.newValue}"` : ''}`
    case 'phase_status_changed':
      if (!d.phase && !d.to && entry.detail) return entry.detail
      return `${d.phase || 'Phase'} marked as ${sl(d.to)}`
    case 'phase_auto_advanced': {
      const fromLabel = d.from || 'previous'
      return `${d.phase || 'Phase'} marked as Active (auto-advanced from ${fromLabel})`
    }
    case 'phase_assigned':
      return `${d.phase || 'Phase'} assigned to ${d.assignedTo || 'someone'}`
    case 'checklist_updated':
      return `Checklist ${d.action || 'updated'}${d.item ? `: "${d.item}"` : ''}`
    case 'time_logged':
      return d.action === 'deleted'
        ? `${d.hours || '?'}h removed from ${d.phase || 'phase'}`
        : `${d.hours || '?'}h logged on ${d.phase || 'phase'}`
    case 'comment_added':
    case 'comment_posted':
      return 'Comment posted'
    case 'comment_edited':
      return 'Comment edited'
    case 'comment_deleted':
      return 'Comment deleted'
    case 'link_updated':
      return `Link ${d.action || 'updated'}${d.label ? `: ${d.label}` : ''}`
    case 'site_status_changed':
      return `Site status changed to ${sl(d.to || d.status)}`
    case 'project_on_hold':
      return d.reason ? `Project put on hold: ${d.reason}` : 'Project put on hold'
    case 'project_reactivated':
      return 'Project reactivated'
    case 'project_archived':
      return 'Project archived'
    case 'project_restored':
      return 'Project restored'
    case 'language_status_changed':
      return `${d.language || 'Language'} marked as ${sl(d.status)}`
    case 'project_info_saved':
      return 'Project info saved'
    // legacy action names written by old firebase-service logActivity
    case 'created':      return d.name ? `Project "${d.name}" created` : 'Project created'
    case 'updated':      return entry.detail || 'Project updated'
    case 'phase_changed':
    case 'status_changed': return entry.detail || 'Status changed'
    case 'archived':     return 'Project archived'
    case 'on_hold':      return entry.detail || 'Project put on hold'
    case 'reactivated':  return 'Project reactivated'
    case 'sheet_added':  return entry.detail || 'Link added'
    case 'sheet_removed': return entry.detail || 'Link removed'
    case 'lang_status':  return entry.detail || 'Language status updated'
    case 'checklist_added':   return entry.detail || 'Checklist item added'
    case 'checklist_removed': return entry.detail || 'Checklist item removed'
    case 'checklist_toggled': return entry.detail || 'Checklist item toggled'
    case 'timelog_added':   return entry.detail || 'Time logged'
    case 'timelog_deleted': return entry.detail || 'Time log removed'
    default:
      return entry.detail || entry.action || 'Unknown action'
  }
}

function activityDetail(entry) {
  const d = entry.details || {}
  switch (entry.action) {
    case 'time_logged':
      return d.description || null
    case 'comment_added':
    case 'comment_posted':
    case 'comment_edited':
    case 'comment_deleted':
      return d.preview ? `"${d.preview}${d.preview.length >= 50 ? '…' : ''}"` : null
    default:
      return null
  }
}

function tsMillis(v) {
  if (!v) return 0
  if (typeof v?.toDate === 'function') return v.toDate().getTime()
  if (v?.seconds) return v.seconds * 1000
  return new Date(v).getTime() || 0
}

function safeUrl(url) {
  if (!url) return ''
  const s = url.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}

function formatDate(value) {
  if (!value) return '—'
  let date
  if (value && typeof value.toDate === 'function') {
    date = value.toDate()
  } else if (value instanceof Date) {
    date = value
  } else if (value?.seconds) {
    date = new Date(value.seconds * 1000)
  } else {
    date = new Date(value)
  }
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function langStatusClass(status) {
  if (status === 'live')          return 'il-lang-live'
  if (status === 'in-production') return 'il-lang-prod'
  return 'il-lang-ns'
}

function langStatusLabel(status) {
  if (status === 'live')          return '● Live'
  if (status === 'in-production') return '◉ In Production'
  return '○ Not Started'
}

function langStatusText(status) {
  if (status === 'live')          return 'Live'
  if (status === 'in-production') return 'In Production'
  return 'Not Started'
}

function phProgressIcon(status) {
  if (statusesStore.isComplete(status)) return '✓'
  if (status === 'active')              return '◉'
  if (status === 'blocked')             return '⊘'
  return '○'
}

function phProgressLabel(status) {
  const s = statusesStore.statusById(status)
  if (s) return s.name
  if (status === 'done')    return 'Done'
  if (status === 'active')  return 'Active'
  if (status === 'blocked') return 'Blocked'
  return '—'
}

// ── Sidebar Phase Progress collapse ───────────────────────────────────────
const sidebarExpanded = reactive({})

function shouldShowSubPhases(ph) {
  const status = getPhaseStatus(localProject.value?.phaseData || {}, ph.id)
  if (status === 'active' || status === 'blocked') return true
  if (statusesStore.isComplete(status)) return !!sidebarExpanded[ph.id]
  return false
}

function onSidebarPhaseClick(ph) {
  const status = getPhaseStatus(localProject.value?.phaseData || {}, ph.id)
  if (statusesStore.isComplete(status) && (ph.subPhases || []).length > 0) {
    sidebarExpanded[ph.id] = !sidebarExpanded[ph.id]
  } else {
    scrollToPhase(ph.id)
  }
}

function doneSubCount(ph) {
  const phData = localProject.value?.phaseData || {}
  return (ph.subPhases || []).filter(sp =>
    statusesStore.isComplete(getSubPhaseStatus(phData, ph.id, sp.id))
  ).length
}

function fmtDateTime(s) { return formatDate(s) }

const TAG_STYLES = {
  general:  { color: '#6b7280', bg: '#f3f4f6', label: 'General' },
  delivery: { color: '#2563eb', bg: '#eff6ff', label: 'Delivery' },
  blocker:  { color: '#dc2626', bg: '#fef2f2', label: 'Blocker' },
  urgent:   { color: '#d97706', bg: '#fffbeb', label: 'Urgent' },
  fyi:      { color: '#16a34a', bg: '#f0fdf4', label: 'FYI' },
}

function tagBadgeStyle(tag) {
  const t = TAG_STYLES[tag] || TAG_STYLES.general
  return `background:${t.bg};color:${t.color};font-size:11px;padding:1px 7px`
}

function tagLabel(tag) {
  return (TAG_STYLES[tag] || TAG_STYLES.general).label
}

// ── @Mention ──────────────────────────────────────────────────────────────────
function onCommentInput() {
  checkMention()
}
function onCommentKeydown(e) {
  if (mentionDropdown.show && e.key === 'Escape') {
    mentionDropdown.show = false
    e.preventDefault()
  }
}
function checkMention() {
  const el = commentTextareaRef.value
  if (!el) return
  const text   = el.value
  const pos    = el.selectionStart
  const before = text.slice(0, pos)
  const atIdx  = before.lastIndexOf('@')
  if (atIdx === -1) { mentionDropdown.show = false; return }
  if (atIdx > 0 && /\w/.test(before[atIdx - 1])) { mentionDropdown.show = false; return }
  const query = before.slice(atIdx + 1)
  if (query.includes('@') || query.includes(' ')) { mentionDropdown.show = false; return }
  mentionDropdown.query    = query
  mentionDropdown.filtered = teamStore.teamMembers
    .filter(m => m.active && m.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 6)
  mentionDropdown.show = mentionDropdown.filtered.length > 0
}
function insertMention(member) {
  const el = commentTextareaRef.value
  if (!el) return
  const pos    = el.selectionStart
  const text   = el.value
  const before = text.slice(0, pos)
  const atIdx  = before.lastIndexOf('@')
  if (atIdx === -1) return
  const newText = text.slice(0, atIdx) + '@' + member.name + ' ' + text.slice(pos)
  newCommentText.value = newText
  mentionDropdown.show = false
  nextTick(() => {
    const newPos = atIdx + 1 + member.name.length + 1
    el.focus()
    el.setSelectionRange(newPos, newPos)
  })
}
function parseCommentSegments(text) {
  if (!text) return [{ type: 'text', content: '' }]
  const members = teamStore.teamMembers.filter(m => m.active)
  if (!members.length) return [{ type: 'text', content: text }]
  const escaped = [...members]
    .map(m => m.name)
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp('@(' + escaped.join('|') + ')(?=\\s|$|[^\\w ])', 'gi')
  const segments = []
  let lastIdx = 0, match
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) segments.push({ type: 'text', content: text.slice(lastIdx, match.index) })
    segments.push({ type: 'mention', content: match[0] })
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) segments.push({ type: 'text', content: text.slice(lastIdx) })
  return segments.length ? segments : [{ type: 'text', content: text }]
}

function isUnread(c) {
  if (!lastReadTs.value) return false
  if (c.authorUid === authStore.currentUser?.uid) return false
  return (c.createdAt || '') > lastReadTs.value
}

function markCommentsRead() {
  if (!localProject.value?.id) return
  const now = new Date().toISOString()
  localStorage.setItem(`pt_comments_read_${localProject.value.id}`, now)
  lastReadTs.value = now
}

function initLastReadTs(id) {
  lastReadTs.value = localStorage.getItem(`pt_comments_read_${id}`) || new Date().toISOString()
}

function canEditComment(c) {
  const uid = authStore.currentUser?.uid
  return authStore.isManager || (!!uid && c.authorUid === uid)
}

function startEditComment(c) {
  editingComment.id   = c.id
  editingComment.text = c.text
}

function cancelEditComment() {
  editingComment.id   = null
  editingComment.text = ''
}

async function saveEditComment(commentId) {
  const text = editingComment.text.trim()
  if (!text || !localProject.value?.id) return
  const idx = projectComments.value.findIndex(c => c.id === commentId)
  if (idx < 0) return
  const editedAt = new Date().toISOString()
  try {
    await updateProjectComment(localProject.value.id, commentId, { text, editedAt })
    projectComments.value[idx] = { ...projectComments.value[idx], text, editedAt }
    logActivity(localProject.value.id, 'comment_edited', { preview: text.substring(0, 50) }).catch(() => {})
    cancelEditComment()
  } catch (err) {
    console.error('Edit comment error:', err)
  }
}

async function deleteComment(commentId) {
  if (!localProject.value?.id) return
  if (!window.confirm('Delete this comment?')) return
  const comment = projectComments.value.find(c => c.id === commentId)
  try {
    await deleteProjectComment(localProject.value.id, commentId)
    projectComments.value = projectComments.value.filter(c => c.id !== commentId)
    logActivity(localProject.value.id, 'comment_deleted', { preview: (comment?.text || '').substring(0, 50) }).catch(() => {})
  } catch (err) {
    console.error('Delete comment error:', err)
  }
}

// ── Computed ──────────────────────────────────────────────────────────────────

// True when the site is live but the Languages phase still has pending sub-tasks.
// In this state the Languages PhaseCard stays fully editable; others get locked.
const isLiveWithPendingLanguages = computed(() => {
  const p = localProject.value
  if (!p) return false
  if (p.siteStatus !== 'live') return false
  if (!(p.additionalLanguages || []).length) return false
  return p.phaseData?.languages?.status !== 'done'
})

const readonly = computed(() => {
  const s = localProject.value?.siteStatus
  if (s === 'on-hold') return true
  if (s === 'live') return !isLiveWithPendingLanguages.value
  return false
})

// Per-language status pills for the banner
const pendingLanguagePills = computed(() => {
  const p = localProject.value
  if (!p) return []
  const langs       = p.additionalLanguages || []
  const langSubPhs  = p.phaseData?.languages?.subPhases || {}
  const langPhaseDef = dynamicPhaseConfig.value.find(ph => ph.id === 'languages')
  return langs.map(lang => {
    const key     = sanitizeId(lang)
    const subIds  = (langPhaseDef?.subPhases || [])
      .filter(sp => sp.id.startsWith(key + '_'))
      .map(sp => sp.id)
    const allDone = subIds.length > 0 && subIds.every(id => langSubPhs[id]?.status === 'done')
    const anyActive = subIds.some(id => langSubPhs[id]?.status === 'active')
    const status  = allDone ? 'done' : anyActive ? 'active' : 'not-started'
    return { lang, status }
  })
})

const primaryPhaseName = computed(() => {
  if (!localProject.value) return ''
  const ph = phasesStore.phaseConfig.find(p => p.id === localProject.value.currentPhase)
  if (!ph) return localProject.value.currentPhase || '—'
  if (localProject.value.currentSubPhase && ph.subPhases) {
    const sp = ph.subPhases.find(s => s.id === localProject.value.currentSubPhase)
    return sp ? `${ph.name}: ${sp.name}` : ph.name
  }
  return ph.name
})

const quickLinks = computed(() =>
  (localProject.value?.links || [])
    .filter(l => l.url && l.url.trim())
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
)

const hasQuickLinks = computed(() => quickLinks.value.length > 0)

const allActiveMembers = computed(() =>
  teamStore.teamMembers.filter(m => m.active !== false)
)

const developersInvolvedMembers = computed(() =>
  editLeadDeveloperId.value
    ? allActiveMembers.value.filter(m => m.id !== editLeadDeveloperId.value)
    : allActiveMembers.value
)

// When Lead Developer changes, also strip that person from the selected
// Developers Involved values (in case they were already added).
watch(editLeadDeveloperId, (newLeadId) => {
  if (!newLeadId) return
  const lead = allActiveMembers.value.find(m => m.id === newLeadId)
  const leadKey = lead?.uid || newLeadId
  editDevelopersInvolvedIds.value = editDevelopersInvolvedIds.value.filter(selId => {
    const selMember = teamStore.teamMembers.find(m => m.id === selId)
    return (selMember?.uid || selId) !== leadKey
  })
})

function memberNameById(id) {
  if (!id) return ''
  return teamStore.teamMembers.find(m => m.id === id)?.name || ''
}

const langStatusGroups = computed(() => {
  if (!localProject.value) return []
  const langs = localProject.value.additionalLanguages || []
  if (!langs.length) return []
  const ls = localProject.value.langStatus || {}
  const groups = {}
  for (const lang of langs) {
    const st = ls[lang] || 'not-started'
    if (!groups[st]) groups[st] = []
    groups[st].push(lang)
  }
  return ['live', 'in-production', 'not-started']
    .filter(st => groups[st])
    .map(st => ({ status: st, langs: groups[st] }))
})

const dynamicPhaseConfig = computed(() => {
  if (!localProject.value) return phasesStore.phaseConfig.filter(ph => ph.id !== 'languages')
  const addLangs = localProject.value.additionalLanguages || []
  return generateDynamicPhaseConfig(phasesStore.phaseConfig, addLangs)
})

const phaseOptions = computed(() => {
  const opts = []
  for (const ph of phasesStore.phaseConfig) {
    if (ph.subPhases?.length) {
      for (const sp of ph.subPhases) {
        opts.push({ value: `${ph.id}:${sp.id}`, label: `${ph.name} — ${sp.name}`, phase: ph.id, sub: sp.id })
      }
    } else {
      opts.push({ value: ph.id, label: ph.name, phase: ph.id, sub: null })
    }
  }
  return opts
})

const editPhaseValue = computed({
  get() {
    if (!localProject.value) return 'kickstart'
    const sp = localProject.value.currentSubPhase
    const ph = localProject.value.currentPhase || 'kickstart'
    return sp ? `${ph}:${sp}` : ph
  },
  set(val) {
    if (!localProject.value) return
    const opt = phaseOptions.value.find(o => o.value === val)
    if (!opt) return
    localProject.value.currentPhase    = opt.phase
    localProject.value.currentSubPhase = opt.sub || null
    localProject.value.activePhases    = [{ phase: opt.phase, subPhase: opt.sub || null }]
    if (!localProject.value.phaseData) localProject.value.phaseData = {}
    autoCompletePreviousPhases(opt.phase, localProject.value.phaseData, phasesStore.phaseConfig)
  },
})

// ── Project loading ───────────────────────────────────────────────────────────
function loadProjectExtras(id) {
  commentsLoading.value    = true
  projectComments.value    = []
  projectActivityLog.value = []

  // Tear down any previous activity log listener for a different project
  if (unsubActivityLog) { unsubActivityLog(); unsubActivityLog = null }

  // Comments: one-time fetch (unchanged)
  getProjectComments(id)
    .then(c  => { projectComments.value = c })
    .catch(err => console.error('Error loading comments:', err))

  // Activity log: live listener — updates whenever a new entry is written
  unsubActivityLog = subscribeToActivityLog(
    id,
    (snap) => {
      projectActivityLog.value = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => tsMillis(b.timestamp) - tsMillis(a.timestamp))
      commentsLoading.value = false
    },
    (err) => {
      console.error('Activity log listener error:', err)
      commentsLoading.value = false
    }
  )
}

function initLocalProject(p) {
  localProject.value   = JSON.parse(JSON.stringify(p))
  projTab.value        = 'info'
  phaseView.value      = 'list'
  infoEditMode.value   = false
  showAddLink.value    = false
  newCommentText.value = ''
}

function migrateLanguageFields(data) {
  if (data.mainLanguage !== undefined) return data
  // Migrate old `language` string/array → mainLanguage + additionalLanguages
  const langs = (() => {
    const l = data.language
    if (!l) return []
    if (Array.isArray(l)) return l.filter(Boolean)
    return l.split(',').map(s => s.trim()).filter(Boolean)
  })()
  return { ...data, mainLanguage: langs[0] || 'NL', additionalLanguages: langs.slice(1) }
}

// Migrates old hardcoded link fields and googleSheets to the unified links array.
// Runs exactly once: when a project document has no links field yet.
async function ensureLinksArray(data) {
  if (data.links !== undefined) return
  const TEMPLATE_DEFAULTS = [
    { id: uid(), name: 'QA Checklist', url: data.qaChecklistLink || '', order: 1 },
    { id: uid(), name: 'Briefing',     url: data.briefingUrl    || '', order: 2 },
    { id: uid(), name: 'Sitemap',      url: data.sitemapUrl     || '', order: 3 },
    { id: uid(), name: 'Builder Link', url: data.builderLink    || '', order: 4 },
    { id: uid(), name: 'Google Drive', url: data.logoSetUrl     || '', order: 5 },
    { id: uid(), name: 'Google Keep',  url: data.googleKeepUrl  || '', order: 6 },
  ]
  const customLinks = (data.googleSheets || []).map((s, i) => ({
    id: s.id || uid(),
    name: s.label || s.name || '',
    url: s.url || '',
    order: 6 + i + 1,
  }))
  const links = [...TEMPLATE_DEFAULTS, ...customLinks]
  data.links = links
  await projectsStore.updateProject(data.id, { links, updatedAt: new Date().toISOString() })
    .catch(e => console.warn('[Migration] ensureLinksArray failed:', e))
}

// Ensures phaseData.languages exists for projects that have additionalLanguages but
// were created before the Languages phase was introduced.
async function ensureLanguagesPhase(data) {
  const addLangs = data.additionalLanguages || []
  if (!addLangs.length) return
  if (data.phaseData?.languages) return
  const langDef = phasesStore.phaseConfig.find(p => p.id === 'languages')
  const template = langDef?.subPhaseTemplate || []
  const langPhaseData = generateLanguagePhaseData(addLangs, template)
  const newPhaseData  = { ...(data.phaseData || {}), languages: langPhaseData }
  await projectsStore.updateProject(data.id, {
    phaseData: newPhaseData,
    updatedAt: new Date().toISOString(),
  })
}

function startProjectListener(id) {
  if (unsubProject) unsubProject()
  if (unsubActivityLog) { unsubActivityLog(); unsubActivityLog = null }
  pageLoading.value = true
  unsubProject = subscribeToProject(id, (snap) => {
    if (!snap.exists()) {
      pageLoading.value = false
      return
    }
    let data = { id: snap.id, ...snap.data() }
    // Migrate old language format on first encounter
    if (data.mainLanguage === undefined) {
      data = migrateLanguageFields(data)
      projectsStore.updateProject(data.id, {
        mainLanguage:        data.mainLanguage,
        additionalLanguages: data.additionalLanguages,
        updatedAt:           new Date().toISOString(),
      }).catch(e => console.warn('[Migration] Language field migration failed:', e))
    }
    // Ensure phaseData.languages exists for projects with additional languages
    ensureLanguagesPhase(data).catch(e => console.warn('[Migration] ensureLanguagesPhase failed:', e))
    // Migrate old link fields to unified links array
    ensureLinksArray(data).catch(e => console.warn('[Migration] ensureLinksArray failed:', e))
    latestSnapshot.value = data
    if (!localProject.value) {
      initLocalProject(data)
      initLastReadTs(id)
      loadProjectExtras(id)
    } else if (!infoEditMode.value) {
      Object.assign(localProject.value, data)
    }
    pageLoading.value = false
  })
}

onMounted(() => {
  const id = route.params.id
  if (id) startProjectListener(id)
  // Open a specific tab when navigated with ?tab=… (e.g. from notification click)
  if (route.query.tab) projTab.value = route.query.tab
})

onUnmounted(() => {
  if (unsubProject) unsubProject()
  if (unsubActivityLog) { unsubActivityLog(); unsubActivityLog = null }
})

watch(() => route.params.id, (newId, oldId) => {
  if (!newId || newId === oldId) return
  localProject.value = null
  startProjectListener(newId)
})

watch(() => route.query.tab, (tab) => {
  if (tab) projTab.value = tab
})

watch(projTab, (tab) => {
  if (tab === 'comments') markCommentsRead()
})

// ── Phase helpers ─────────────────────────────────────────────────────────────
function getPhaseData(phaseId) {
  return localProject.value?.phaseData?.[phaseId] || emptyPhaseEntry()
}

function onUpdatePhase({ phaseId, data }) {
  if (!localProject.value) return
  if (!localProject.value.phaseData) localProject.value.phaseData = {}
  localProject.value.phaseData[phaseId] = data
}


function scrollToPhase(phaseId) {
  projTab.value   = 'phases'
  phaseView.value = 'cards'
  setTimeout(() => {
    const el = document.getElementById('ph-card-' + phaseId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

// ── Info tab ──────────────────────────────────────────────────────────────────
function enterEditMode() {
  editLeadDeveloperId.value       = localProject.value?.leadDeveloperId || ''
  editDevelopersInvolvedIds.value = [...(localProject.value?.developersInvolvedIds || [])]
  editWebServicesAssigneeId.value = localProject.value?.webServicesAssigneeId || ''
  editMultimediaAssigneeId.value  = localProject.value?.multimediaAssigneeId || ''
  editQaAssigneeId.value          = localProject.value?.qaAssigneeId || ''
  // Populate edit-mode language selectors from project
  const ml = localProject.value?.mainLanguage || langPills(localProject.value)[0] || 'NL'
  if (LANGUAGE_OPTIONS.includes(ml)) {
    editMainLanguage.value      = ml
    editMainLanguageOther.value = ''
  } else {
    editMainLanguage.value      = 'Other'
    editMainLanguageOther.value = ml
  }
  if (!localProject.value.additionalLanguages) {
    localProject.value.additionalLanguages = []
  }
  infoEditMode.value = true
}

function cancelEdit() {
  infoEditMode.value = false
  if (latestSnapshot.value) {
    Object.assign(localProject.value, JSON.parse(JSON.stringify(latestSnapshot.value)))
  }
}

async function infoSave() {
  if (!localProject.value?.name.trim() || !localProject.value?.id) return

  // Resolve effective main language (handle "Other" text input)
  const newMain = editMainLanguage.value === 'Other'
    ? (editMainLanguageOther.value.trim() || 'Other')
    : editMainLanguage.value
  localProject.value.mainLanguage = newMain

  const oldAdditional = latestSnapshot.value?.additionalLanguages || []
  const newAdditional = localProject.value.additionalLanguages || []

  // Warn on removed languages that have progress in Languages phase
  const removedLangs = oldAdditional.filter(l => !newAdditional.includes(l))
  if (removedLangs.length) {
    const LANG_SUFFIXES = ['development', 'qa_initial', 'qa_golive', 'qa_live_checking']
    const hasProgress = removedLangs.some(lang => {
      const key = sanitizeId(lang)
      return LANG_SUFFIXES.some(suf => {
        const entry = localProject.value.phaseData?.languages?.subPhases?.[`${key}_${suf}`]
        return entry && entry.status !== 'not-started'
      })
    })
    const msg = hasProgress
      ? `${removedLangs.join(', ')} has progress recorded. Remove anyway?`
      : `Remove language(s): ${removedLangs.join(', ')}?`
    if (!window.confirm(msg)) return

    // Strip sub-phase data for removed languages
    const phaseData = JSON.parse(JSON.stringify(localProject.value.phaseData || {}))
    for (const lang of removedLangs) {
      const key = sanitizeId(lang)
      for (const suf of LANG_SUFFIXES) {
        if (phaseData.languages?.subPhases) {
          delete phaseData.languages.subPhases[`${key}_${suf}`]
        }
      }
    }
    localProject.value.phaseData = phaseData
  }

  // Add sub-phases for newly added languages
  const addedLangs = newAdditional.filter(l => !oldAdditional.includes(l))
  if (addedLangs.length) {
    const phaseData = JSON.parse(JSON.stringify(localProject.value.phaseData || {}))
    if (!phaseData.languages) phaseData.languages = emptyPhaseEntry()
    if (!phaseData.languages.subPhases) phaseData.languages.subPhases = {}
    const LANG_SUFFIXES = ['development', 'qa_initial', 'qa_golive', 'qa_live_checking']
    for (const lang of addedLangs) {
      const key = sanitizeId(lang)
      for (const suf of LANG_SUFFIXES) {
        const k = `${key}_${suf}`
        if (!phaseData.languages.subPhases[k]) phaseData.languages.subPhases[k] = emptyPhaseEntry()
      }
    }
    localProject.value.phaseData = phaseData
  }

  // If all additional languages removed, drop the languages phase entry
  if (newAdditional.length === 0 && oldAdditional.length > 0) {
    const phaseData = JSON.parse(JSON.stringify(localProject.value.phaseData || {}))
    delete phaseData.languages
    localProject.value.phaseData = phaseData
  }

  infoSaving.value = true
  const now = new Date().toISOString()
  try {
    const allMemberIds = [
      editLeadDeveloperId.value,
      ...editDevelopersInvolvedIds.value,
      editWebServicesAssigneeId.value,
      editMultimediaAssigneeId.value,
      editQaAssigneeId.value,
    ].filter(Boolean)
    const uniqueIds = [...new Set(allMemberIds)]
    const assignedMembers = uniqueIds
      .map(id => teamStore.teamMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => ({ id: m.id, name: m.name, initials: m.initials || m.avatarInitials || '', avatarColor: m.avatarColor || '#6366f1' }))

    const leadMember          = teamStore.teamMembers.find(m => m.id === editLeadDeveloperId.value)
    const prevLeadDeveloperId = localProject.value.leadDeveloperId

    const fields = {
      name:                     localProject.value.name || '',
      url:                      localProject.value.url || '',
      originalSite:             localProject.value.originalSite || '',
      platform:                 localProject.value.platform || '',
      projectType:              localProject.value.projectType || '',
      mainLanguage:             newMain,
      additionalLanguages:      newAdditional,
      kickstartDate:            localProject.value.kickstartDate || '',
      liveDate:                 localProject.value.liveDate || '',
      previewDate:              localProject.value.previewDate || '',
      deliveryDate:             localProject.value.deliveryDate || '',
      deadline:                 localProject.value.deadline || '',
      currentPhase:             localProject.value.currentPhase || 'kickstart',
      currentSubPhase:          localProject.value.currentSubPhase || null,
      activePhases:             localProject.value.activePhases || [],
      phaseData:                localProject.value.phaseData || {},
      leadDeveloperId:          editLeadDeveloperId.value || null,
      developersInvolvedIds:    editDevelopersInvolvedIds.value,
      webServicesAssigneeId:    editWebServicesAssigneeId.value || null,
      multimediaAssigneeId:     editMultimediaAssigneeId.value || null,
      qaAssigneeId:             editQaAssigneeId.value || null,
      assignedMembers,
      developer:                leadMember?.name || '',
      updatedAt:                now,
    }
    await projectsStore.updateProject(localProject.value.id, fields)
    localProject.value.assignedMembers       = assignedMembers
    localProject.value.leadDeveloperId       = editLeadDeveloperId.value || null
    localProject.value.developersInvolvedIds = editDevelopersInvolvedIds.value
    localProject.value.webServicesAssigneeId = editWebServicesAssigneeId.value || null
    localProject.value.multimediaAssigneeId  = editMultimediaAssigneeId.value || null
    localProject.value.qaAssigneeId          = editQaAssigneeId.value || null
    localProject.value.developer = fields.developer

    // Notify the new lead developer if the assignment changed
    const newLeadDevId = editLeadDeveloperId.value
    if (newLeadDevId && newLeadDevId !== prevLeadDeveloperId && leadMember?.uid) {
      const currentMemberId = authStore.currentUser?.memberId
      if (newLeadDevId !== currentMemberId) {
        createNotification({
          userId:      leadMember.uid,
          type:        'assignment',
          message:     `You have been assigned to "${fields.name}"`,
          projectId:   localProject.value.id,
          projectName: fields.name,
          read:        false,
        }).catch(err => console.error('Assignment notification error:', err))
      }
    }

    const FIELD_LABELS = { name: 'Name', url: 'Site URL', originalSite: 'Original Site', platform: 'Platform', projectType: 'Type', mainLanguage: 'Main Language', kickstartDate: 'Kickstart Date', liveDate: 'Live Date', previewDate: 'Preview Date', deliveryDate: 'Delivery Date', deadline: 'Deadline' }
    const snap = latestSnapshot.value || {}
    const changedFields = Object.keys(FIELD_LABELS).filter(f => (localProject.value[f] || '') !== (snap[f] || ''))
    for (const f of changedFields) {
      logActivity(localProject.value.id, 'field_updated', {
        field:    FIELD_LABELS[f],
        oldValue: snap[f] || '',
        newValue: localProject.value[f] || '',
      }).catch(() => {})
    }
    infoEditMode.value = false
  } catch (err) {
    console.error('Info save error:', err)
  } finally {
    infoSaving.value = false
  }
}

// ── Language status ───────────────────────────────────────────────────────────
async function saveLangStatus(lang, status) {
  if (!localProject.value?.id) return
  if (!localProject.value.langStatus) localProject.value.langStatus = {}
  localProject.value.langStatus[lang] = status
  projectsStore.updateProject(localProject.value.id, {
    langStatus: { ...localProject.value.langStatus },
    updatedAt: new Date().toISOString(),
  }).catch(err => console.error('Lang status save error:', err))
  logActivity(localProject.value.id, 'language_status_changed', { language: lang, status }).catch(() => {})
  // Auto-set site to live when any language goes live
  if (status === 'live' && localProject.value.siteStatus !== 'live') {
    await changeSiteStatus('live')
  }
}

// ── Links ─────────────────────────────────────────────────────────────────────

// Merges existing project links with the current templates.
// Template matches (case-insensitive) preserve the existing entry's URL and id.
// Missing templates are added with url: ''. Custom links are appended after.
function buildSyncedLinks(existing, templates) {
  const templateNames = new Set(templates.map(t => t.name.toLowerCase()))
  const matched  = (existing || []).filter(l => templateNames.has(l.name.toLowerCase()))
  const custom   = (existing || []).filter(l => !templateNames.has(l.name.toLowerCase()))
  const merged   = templates.map(tpl => {
    const found = matched.find(l => l.name.toLowerCase() === tpl.name.toLowerCase())
    return found
      ? { ...found, order: tpl.order }
      : { id: uid(), name: tpl.name, url: '', order: tpl.order }
  })
  const maxOrder = templates.reduce((m, t) => Math.max(m, t.order || 0), 0)
  custom.forEach((l, i) => merged.push({ ...l, order: maxOrder + i + 1 }))
  return merged
}

async function addLink() {
  if (!newLink.url.trim() && !newLink.name.trim()) return
  if (!localProject.value.links) localProject.value.links = []
  const maxOrder = (localProject.value.links).reduce((m, l) => Math.max(m, l.order || 0), 0)
  const entry = { id: uid(), name: newLink.name, url: newLink.url, order: maxOrder + 1 }
  localProject.value.links.push(entry)
  const name = newLink.name || newLink.url
  newLink.name = ''; newLink.url = ''; showAddLink.value = false
  if (localProject.value.id) {
    projectsStore.updateProject(localProject.value.id, {
      links: localProject.value.links,
      updatedAt: new Date().toISOString(),
    }).catch(() => {})
    logActivity(localProject.value.id, 'link_updated', { action: 'added', label: name }).catch(() => {})
  }
}

async function removeLink(linkId) {
  if (!localProject.value) return
  const lnk = (localProject.value.links || []).find(l => l.id === linkId)
  localProject.value.links = (localProject.value.links || []).filter(l => l.id !== linkId)
  if (localProject.value.id) {
    projectsStore.updateProject(localProject.value.id, {
      links: localProject.value.links,
      updatedAt: new Date().toISOString(),
    }).catch(() => {})
    if (lnk) logActivity(localProject.value.id, 'link_updated', { action: 'deleted', label: lnk.name || lnk.url }).catch(() => {})
  }
}

function saveLinkImmediate() {
  if (!localProject.value?.id) return
  projectsStore.updateProject(localProject.value.id, {
    links: localProject.value.links || [],
    updatedAt: new Date().toISOString(),
  }).catch(() => {})
}

async function syncLinkTemplates() {
  if (!localProject.value?.id) return
  await linkTemplatesStore.fetchTemplates()
  const templates = linkTemplatesStore.templates
  if (!templates.length) return
  const existing = localProject.value.links || []
  const merged = buildSyncedLinks(existing, templates)
  localProject.value.links = merged
  syncingTemplates.value = true
  try {
    await projectsStore.updateProject(localProject.value.id, {
      links: merged,
      updatedAt: new Date().toISOString(),
    })
    showToast('Link templates synced')
  } catch (e) {
    console.error('Sync links error:', e)
  } finally {
    syncingTemplates.value = false
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────
async function addComment() {
  const text = newCommentText.value.trim()
  if (!text || !localProject.value?.id) return

  console.log('[Comment] Posting comment...')

  const now  = new Date().toISOString()
  const user = authStore.currentUser

  if (!user?.uid) {
    console.error('[Comment] Not authenticated — cannot post comment')
    return
  }

  const comment = {
    text,
    tag:            newCommentTag.value || 'general',
    authorName:     user.name    || '',
    authorUid:      user.uid,
    authorInitials: (user.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(),
    authorColor:    user.avatarColor || '#6366f1',
    createdAt:      now,
  }
  try {
    const saved = await addProjectComment(localProject.value.id, comment)
    projectComments.value.push(saved)
    newCommentText.value = ''
    newCommentTag.value  = 'general'
    mentionDropdown.show = false
    const pid            = localProject.value.id
    const name           = localProject.value.name
    const commentPreview = text.substring(0, 80)
    logActivity(pid, 'comment_added', { preview: text.substring(0, 50) })
      .catch(err => console.error('[Comment] Activity log failed:', err))

    // Track who has already been notified (never self-notify)
    const notifiedUids = new Set([user.uid])

    // ── Step 1: new_comment for every assigned team member ────────────────────
    for (const assigned of (localProject.value.assignedMembers || [])) {
      const member = teamStore.teamMembers.find(m => m.id === assigned.id)
      if (!member?.uid) {
        console.warn('[Notifications] No uid for assigned member:', assigned.name, '— skipping new_comment')
        continue
      }
      if (notifiedUids.has(member.uid)) continue
      notifiedUids.add(member.uid)
      console.log('[Notifications] Sending new_comment to:', member.name)
      createNotification({
        userId: member.uid,
        type: 'new_comment',
        message: `${user.name} commented on "${name}"`,
        projectId: pid,
        projectName: name,
        commentPreview,
        read: false,
      }).catch(err => console.error('[Notifications] new_comment write failed:', err))
    }

    // ── Step 2: mention notifications for @mentioned users ────────────────────
    console.log('[Comment] Checking for mentions in:', text)
    const allMembers = teamStore.teamMembers.filter(m => m.active)
    console.log('[Comment] Active members:', allMembers.map(m => `${m.name}(uid:${m.uid || 'NONE'})`).join(', '))

    if (allMembers.length) {
      const escaped = allMembers
        .map(m => m.name)
        .sort((a, b) => b.length - a.length)
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      const mentionPat = new RegExp('@(' + escaped.join('|') + ')(?=\\s|$|[^\\w ])', 'gi')
      let mm
      const foundMentions = []
      while ((mm = mentionPat.exec(text)) !== null) {
        const mentioned = allMembers.find(m => m.name.toLowerCase() === mm[1].toLowerCase())
        if (!mentioned) continue
        foundMentions.push(mentioned.name)
        if (!mentioned.uid) {
          console.warn('[Notifications] @' + mentioned.name + ' has no uid — cannot send mention notification')
          continue
        }
        if (notifiedUids.has(mentioned.uid)) continue
        notifiedUids.add(mentioned.uid)
        console.log('[Comment] Creating mention notification for:', mentioned.name)
        createNotification({
          userId: mentioned.uid,
          type: 'mention',
          message: `${user.name} mentioned you in "${name}"`,
          projectId: pid,
          projectName: name,
          commentPreview,
          read: false,
        }).catch(err => console.error('[Notifications] mention write failed for', mentioned.name, ':', err))
      }
      console.log('[Comment] Mentions found:', foundMentions.length ? foundMentions : 'none')
    }
  } catch (err) {
    console.error('[Comment] Add comment error:', err)
  }
}

// ── Site Status ───────────────────────────────────────────────────────────────
function requestSiteStatusChange(newStatus) {
  if (!localProject.value || newStatus === localProject.value.siteStatus) return
  if (newStatus === 'on-hold') {
    holdDlg.reason = ''; holdDlg.show = true
  } else if (newStatus === 'cancelled') {
    cancelDlg.reason = ''; cancelDlg.show = true
  } else {
    changeSiteStatus(newStatus)
  }
}

async function changeSiteStatus(newStatus, opts = {}) {
  if (!localProject.value?.id) return
  const prev = localProject.value.siteStatus
  const now  = new Date().toISOString()
  const by   = authStore.currentUser?.name || ''

  localProject.value.siteStatus = newStatus
  if (newStatus === 'on-hold') {
    localProject.value.onHoldSince  = now
    localProject.value.onHoldReason = opts.onHoldReason || ''
  } else {
    localProject.value.onHoldSince  = null
    localProject.value.onHoldReason = ''
  }
  if (newStatus === 'cancelled') {
    localProject.value.cancelledAt     = now
    localProject.value.cancelledReason = opts.cancelledReason || ''
  }

  const firestoreUpdate = {
    siteStatus:   newStatus,
    onHoldSince:  localProject.value.onHoldSince,
    onHoldReason: localProject.value.onHoldReason,
    updatedAt:    now,
  }
  if (newStatus === 'cancelled') {
    firestoreUpdate.cancelledAt     = now
    firestoreUpdate.cancelledReason = opts.cancelledReason || ''
    firestoreUpdate.archived        = true
    firestoreUpdate.archivedAt      = now
    firestoreUpdate.archivedBy      = by
  }

  try {
    await projectsStore.updateProject(localProject.value.id, firestoreUpdate)
    if (newStatus === 'on-hold') {
      logActivity(localProject.value.id, 'project_on_hold', { reason: opts.onHoldReason || '' }).catch(() => {})
    } else if (newStatus === 'development' && prev === 'on-hold') {
      logActivity(localProject.value.id, 'project_reactivated', {}).catch(() => {})
    } else {
      logActivity(localProject.value.id, 'site_status_changed', { from: prev, to: newStatus }).catch(() => {})
    }
    if (newStatus === 'cancelled') router.push('/projects')
  } catch (err) {
    localProject.value.siteStatus = prev
    console.error('Status update error:', err)
  }
}

async function confirmHold() {
  if (!holdDlg.reason.trim()) return
  holdDlg.show = false
  await changeSiteStatus('on-hold', { onHoldReason: holdDlg.reason.trim() })
}

async function confirmCancelProject() {
  const reason = cancelDlg.reason.trim()
  cancelDlg.show = false
  await changeSiteStatus('cancelled', { cancelledReason: reason })
}

// ── Archive ───────────────────────────────────────────────────────────────────
async function archiveProject() {
  showArchiveConfirm.value = false
  if (!localProject.value?.id) return
  try {
    const now = new Date().toISOString()
    const by  = authStore.currentUser?.name || ''
    await projectsStore.archiveProject(localProject.value.id, by, now)
    logActivity(localProject.value.id, 'project_archived', {}).catch(() => {})
    router.push('/projects')
  } catch (err) {
    console.error('Archive error:', err)
  }
}

// ── Last-phase complete → live prompt ────────────────────────────────────────
// Fires when PhaseCard's autosave finds no next phase in expandedPhaseConfig,
// meaning the phase just marked done was the last one in this project's order.
function onActivationComplete() {
  const langsDone = localProject.value?.phaseData?.languages?.status === 'done'
  const hasAdditional = (localProject.value?.additionalLanguages || []).length > 0
  liveConfirmMessage.value = (hasAdditional && langsDone)
    ? 'All languages complete. Mark this site as Live?'
    : 'Mark this site as Live?'
  showLiveConfirm.value = true
}

async function confirmMarkLive() {
  showLiveConfirm.value = false
  await changeSiteStatus('live')
}
</script>
