<template>
  <div>
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

      <!-- ── Back button (above header) ── -->
      <div style="margin-bottom:10px">
        <button class="pd-back-btn" @click="router.push('/projects')">← Back to Projects</button>
      </div>

      <!-- ── Header ── -->
      <div class="pd-header">
        <div style="flex:1;min-width:0">
          <!-- Project name (plain text — edit in Project Details tab) -->
          <div style="font-size:20px;font-weight:700;color:var(--text);line-height:1.3;margin-bottom:8px">
            {{ localProject.name }}
          </div>
          <!-- Site URL first -->
          <div v-if="localProject.url" style="margin-bottom:8px">
            <a :href="localProject.url" target="_blank" class="ext"
              style="font-size:13px;color:var(--primary);text-decoration:none;display:inline-flex;align-items:center;gap:4px">
              🔗 {{ localProject.url }}
            </a>
          </div>
          <!-- Badges row -->
          <div class="pd-badge-row">
            <span class="badge" :class="localProject.platform === 'WordPress' ? 'badge-wp' : 'badge-blogger'">
              {{ localProject.platform }}
            </span>
            <span v-if="localProject.projectType" class="pd-type-badge">
              {{ projectTypeLabel(localProject.projectType) }}
            </span>
            <span v-for="lang in langPills(localProject.language)" :key="lang" class="pd-lang-pill">
              {{ lang }}
            </span>
            <SiteStatusBadge :status="localProject.siteStatus || 'development'" />
            <span v-if="isUrgent(localProject.liveDate)" class="urgent-pill">⚡ Urgent</span>
            <span v-if="localProject.liveDate" style="font-size:12px;color:var(--muted)">
              📅 {{ fmtDate(localProject.liveDate) }}
            </span>
          </div>
        </div>
        <div class="pd-header-right">
          <button v-if="localProject.id" class="btn btn-secondary btn-sm" @click="showArchiveConfirm = true">
            🗂️ Archive
          </button>
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

      <!-- ── Phase Progress Checklist (always visible) ── -->
      <PhaseChecklist
        v-if="localProject.id"
        :phaseData="localProject.phaseData || {}"
        :phaseConfig="phasesStore.phaseConfig"
        :teamMembers="teamStore.teamMembers"
        :siteStatus="localProject.siteStatus"
        :readonly="readonly"
        @scroll-to-phase="scrollToPhase"
        style="margin-top:12px"
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

              <!-- Cards View -->
              <div v-if="phaseView === 'cards'" style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
                <PhaseCard
                  v-for="ph in phasesStore.phaseConfig"
                  :key="ph.id"
                  :phase="getPhaseData(ph.id)"
                  :phaseId="ph.id"
                  :phaseDef="ph"
                  :projectId="localProject.id"
                  :teamMembers="teamStore.teamMembers"
                  :readonly="readonly"
                  @update-phase="onUpdatePhase"
                  @activation-complete="onActivationComplete"
                  @next-phase-started="onNextPhaseStarted"
                />
              </div>

              <!-- List View -->
              <div v-else-if="phaseView === 'list'" style="margin-top:16px">
                <PhaseListView
                  :phaseData="localProject.phaseData || {}"
                  :phaseConfig="phasesStore.phaseConfig"
                  :teamMembers="teamStore.teamMembers"
                  :projectId="localProject.id"
                  :siteStatus="localProject.siteStatus"
                  :readonly="readonly"
                  @update-phase="onUpdatePhase"
                  @next-phase-started="onNextPhaseStarted"
                />
              </div>

              <!-- Kanban View -->
              <div v-else-if="phaseView === 'kanban'" style="margin-top:16px">
                <PhaseKanbanView
                  :phaseData="localProject.phaseData || {}"
                  :phaseConfig="phasesStore.phaseConfig"
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
                      <a v-if="localProject.url" :href="localProject.url" target="_blank" class="il-link">
                        {{ localProject.url }}
                      </a>
                      <div v-else class="il-empty">—</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Original Site URL</div>
                      <a v-if="localProject.originalSite" :href="localProject.originalSite" target="_blank" class="il-link">
                        {{ localProject.originalSite }}
                      </a>
                      <div v-else class="il-empty">—</div>
                    </div>
                  </div>
                  <div class="il-row il-row-3" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Language</div>
                      <div v-if="langPills(localProject.language).length" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:2px">
                        <span v-for="l in langPills(localProject.language)" :key="l" class="pd-lang-pill">{{ l }}</span>
                      </div>
                      <div v-else class="il-empty">—</div>
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
                  <div class="il-row" style="margin-bottom:12px">
                    <div class="il-field">
                      <div class="il-label">Current Phase</div>
                      <div class="il-value">{{ primaryPhaseName || '—' }}</div>
                    </div>
                    <div class="il-field">
                      <div class="il-label">Team Members</div>
                      <div v-if="localProject.assignedMembers?.length" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:2px">
                        <span v-for="m in localProject.assignedMembers" :key="m.id" class="il-member-tag">
                          <span class="il-member-av" :style="{ background: m.avatarColor || '#6366f1' }">
                            {{ m.initials }}
                          </span>
                          {{ m.name }}
                        </span>
                      </div>
                      <div v-else class="il-empty">—</div>
                    </div>
                  </div>
                  <!-- Additional Details accordion -->
                  <div>
                    <div class="il-acc-hdr" @click="showProjectDetails = !showProjectDetails">
                      <span class="il-acc-arrow" :class="{ open: showProjectDetails }">▶</span>
                      Additional Details
                    </div>
                    <div v-if="showProjectDetails" class="il-acc-body">
                      <div class="il-acc-row">
                        <div class="il-field">
                          <div class="il-label">Sitemap</div>
                          <a v-if="localProject.sitemapUrl" :href="localProject.sitemapUrl" target="_blank" class="il-link">
                            {{ localProject.sitemapUrl }}
                          </a>
                          <div v-else class="il-empty">—</div>
                        </div>
                        <div class="il-field">
                          <div class="il-label">Builder Link</div>
                          <a v-if="localProject.builderLink" :href="localProject.builderLink" target="_blank" class="il-link">
                            {{ localProject.builderLink }}
                          </a>
                          <div v-else class="il-empty">—</div>
                        </div>
                        <div class="il-field">
                          <div class="il-label">Briefing</div>
                          <a v-if="localProject.briefingUrl" :href="localProject.briefingUrl" target="_blank" class="il-link">
                            {{ localProject.briefingUrl }}
                          </a>
                          <div v-else class="il-empty">—</div>
                        </div>
                        <div class="il-field">
                          <div class="il-label">Google Keep</div>
                          <a v-if="localProject.googleKeepUrl" :href="localProject.googleKeepUrl" target="_blank" class="il-link">
                            {{ localProject.googleKeepUrl }}
                          </a>
                          <div v-else class="il-empty">—</div>
                        </div>
                        <div class="il-field">
                          <div class="il-label">Google Drive</div>
                          <a v-if="localProject.logoSetUrl" :href="localProject.logoSetUrl" target="_blank" class="il-link">
                            {{ localProject.logoSetUrl }}
                          </a>
                          <div v-else class="il-empty">—</div>
                        </div>
                      </div>
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
                      <label class="form-label">Language</label>
                      <input class="form-input" v-model="localProject.language" placeholder="e.g. NL, EN">
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
                      <label class="form-label">Team Members</label>
                      <TeamMemberPicker v-model="infoMemberIds" />
                    </div>
                  </div>
                  <!-- Additional Details edit -->
                  <div class="il-acc-hdr" @click="showProjectDetails = !showProjectDetails" style="margin-bottom:8px">
                    <span class="il-acc-arrow" :class="{ open: showProjectDetails }">▶</span>
                    Additional Details
                  </div>
                  <div v-if="showProjectDetails" class="il-acc-body" style="margin-bottom:12px">
                    <div class="il-acc-row">
                      <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Sitemap</label>
                        <input class="form-input" v-model="localProject.sitemapUrl" placeholder="https://…">
                      </div>
                      <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Builder Link</label>
                        <input class="form-input" v-model="localProject.builderLink" placeholder="Builder URL…">
                      </div>
                      <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Briefing</label>
                        <input class="form-input" v-model="localProject.briefingUrl" placeholder="Briefing link…">
                      </div>
                      <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Google Keep</label>
                        <input class="form-input" v-model="localProject.googleKeepUrl" placeholder="Google Keep…">
                      </div>
                      <div class="form-group" style="margin-bottom:0">
                        <label class="form-label">Google Drive</label>
                        <input class="form-input" v-model="localProject.logoSetUrl" placeholder="Drive folder link…">
                      </div>
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
              <div v-if="langPills(localProject.language).length > 1" class="il-section">
                <div class="il-section-hdr" style="margin-bottom:4px">
                  <span class="il-section-title">Language Status</span>
                </div>
                <div v-for="lang in langPills(localProject.language)" :key="lang" class="il-lang-row">
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

              <!-- Google Sheets Section -->
              <div class="il-section">
                <div class="il-section-hdr">
                  <span class="il-section-title">Google Sheet Links</span>
                  <button class="btn btn-secondary btn-xs" @click="showAddSheet = !showAddSheet">
                    + Add Link
                  </button>
                </div>
                <div v-if="showAddSheet"
                  style="background:#f8fafc;border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:14px">
                  <div class="il-row" style="margin-bottom:10px">
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">Label</label>
                      <input class="form-input" placeholder="e.g. Content Sheet" v-model="newSheet.label">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                      <label class="form-label">URL</label>
                      <input class="form-input" placeholder="https://docs.google.com/…" v-model="newSheet.url">
                    </div>
                  </div>
                  <div style="display:flex;gap:8px">
                    <button class="btn btn-primary btn-sm" @click="addSheet">Add Link</button>
                    <button class="btn btn-ghost btn-sm" @click="showAddSheet = false">Cancel</button>
                  </div>
                </div>
                <div v-if="localProject.googleSheets?.length">
                  <div v-for="s in localProject.googleSheets" :key="s.id" class="il-sheet-row">
                    <input class="form-input" v-model="s.label" placeholder="Label"
                      @blur="saveSheetImmediate" style="font-size:13px">
                    <input class="form-input" v-model="s.url" placeholder="https://…"
                      @blur="saveSheetImmediate" style="font-size:13px">
                    <button class="btn-icon" @click="removeSheet(s.id)" title="Remove">🗑️</button>
                  </div>
                </div>
                <div v-else style="font-size:13px;color:var(--muted)">No sheet links added yet.</div>
              </div>

            </div><!-- end info tab -->

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
                      <div style="font-size:14px;white-space:pre-wrap;word-break:break-word">{{ c.text }}</div>
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
                  <textarea class="form-textarea" v-model="newCommentText"
                    placeholder="Add a comment…" rows="3"
                    style="margin-bottom:10px;resize:vertical"></textarea>
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
                <div v-if="!projectActivityLog.length" style="color:var(--muted);font-size:14px">
                  No activity recorded yet.
                </div>
                <!-- Timeline feed -->
                <div v-else style="display:flex;flex-direction:column">
                  <div v-for="entry in projectActivityLog" :key="entry.id"
                    style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
                    <div style="width:34px;height:34px;border-radius:50%;background:var(--surface2,#f1f5f9);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">
                      {{ activityIcon(entry.action) }}
                    </div>
                    <div style="flex:1;min-width:0;padding-top:5px">
                      <div style="font-size:14px;font-weight:500;color:var(--text)">{{ entry.detail }}</div>
                      <div style="font-size:12px;color:var(--muted);margin-top:3px;display:flex;gap:5px;align-items:center">
                        <span>{{ entry.userName || 'System' }}</span>
                        <span style="opacity:.4">·</span>
                        <span>{{ fmtDateTime(entry.timestamp) }}</span>
                      </div>
                    </div>
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
              <div v-if="localProject.builderLink" class="pd-ql-item">
                <span class="pd-ql-icon">🔗</span>
                <a :href="localProject.builderLink" target="_blank" class="pd-ql-link">Builder Link</a>
              </div>
              <div v-if="localProject.briefingUrl" class="pd-ql-item">
                <span class="pd-ql-icon">📋</span>
                <a :href="localProject.briefingUrl" target="_blank" class="pd-ql-link">Briefing</a>
              </div>
              <div v-if="localProject.sitemapUrl" class="pd-ql-item">
                <span class="pd-ql-icon">🗺</span>
                <a :href="localProject.sitemapUrl" target="_blank" class="pd-ql-link">Sitemap</a>
              </div>
              <div v-if="localProject.googleKeepUrl" class="pd-ql-item">
                <span class="pd-ql-icon">📍</span>
                <a :href="localProject.googleKeepUrl" target="_blank" class="pd-ql-link">Google Keep</a>
              </div>
              <div v-if="localProject.logoSetUrl" class="pd-ql-item">
                <span class="pd-ql-icon">📁</span>
                <a :href="localProject.logoSetUrl" target="_blank" class="pd-ql-link">Google Drive</a>
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

    <!-- Mark Live Confirm (single language) -->
    <ConfirmModal
      v-if="showLiveConfirm"
      title="🎉 Activation Complete"
      message="Mark this site as Live?"
      confirmText="Mark Live"
      @confirm="confirmMarkLive"
      @cancel="showLiveConfirm = false"
    />

    <!-- Multilanguage Activation Modal -->
    <MultilanguageLiveModal
      v-if="showActivationModal"
      :languages="activationLangs"
      @confirm="confirmActivation"
      @cancel="showActivationModal = false"
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
import { ref, computed, reactive, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useProjectsStore } from '@/stores/projects'
import { usePhasesStore } from '@/stores/phases'
import { useTeamStore } from '@/stores/team'
import { useAuthStore } from '@/stores/auth'
import { usePhaseLogic } from '@/composables/usePhaseLogic'
import { subscribeToProject, getProjectComments, addProjectComment, updateProjectComment, deleteProjectComment, getProjectActivityLog, addProjectActivityEntry, createNotification } from '@/firebase-service'
import OnHoldBanner from '@/components/shared/OnHoldBanner.vue'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import PhaseChecklist from '@/components/phases/PhaseChecklist.vue'
import PhaseCard from '@/components/phases/PhaseCard.vue'
import PhaseListView from '@/components/phases/PhaseListView.vue'
import PhaseKanbanView from '@/components/phases/PhaseKanbanView.vue'
import TeamMemberPicker from '@/components/shared/TeamMemberPicker.vue'
import MultilanguageLiveModal from '@/components/projects/MultilanguageLiveModal.vue'
import SiteStatusBadge from '@/components/shared/SiteStatusBadge.vue'

const route        = useRoute()
const router       = useRouter()
const projectsStore = useProjectsStore()
const phasesStore  = usePhasesStore()
const teamStore    = useTeamStore()
const authStore    = useAuthStore()
const { emptyPhaseEntry, autoCompletePreviousPhases } = usePhaseLogic()

// ── Core project state ────────────────────────────────────────────────────────
const localProject   = ref(null)
const latestSnapshot = ref(null)
const pageLoading    = ref(true)
let   unsubProject   = null
const projTab       = ref('info')
const phaseView     = ref('list')
const infoEditMode  = ref(false)
const infoSaving    = ref(false)
const infoMemberIds = ref([])
const showProjectDetails = ref(false)

// ── Comments + Activity ───────────────────────────────────────────────────────
const projectComments    = ref([])
const projectActivityLog = ref([])
const commentsLoading    = ref(false)
const newCommentText     = ref('')
const newCommentTag      = ref('general')
const editingComment     = reactive({ id: null, text: '' })
const lastReadTs         = ref('')

// ── Google Sheets ─────────────────────────────────────────────────────────────
const showAddSheet = ref(false)
const newSheet     = reactive({ label: '', url: '' })

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

// ── Dialogs ───────────────────────────────────────────────────────────────────
const showArchiveConfirm  = ref(false)
const showLiveConfirm     = ref(false)
const showActivationModal = ref(false)
const activationLangs     = ref([])
const holdDlg   = reactive({ show: false, reason: '' })
const cancelDlg = reactive({ show: false, reason: '' })

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

function langPills(lang) {
  if (!lang) return []
  if (Array.isArray(lang)) return lang.filter(Boolean)
  return lang.split(',').map(s => s.trim()).filter(Boolean)
}

function projectTypeLabel(type) {
  const map = { new_site: 'New Site', redesign: 'Redesign', smart_blog: 'Smart Blog', others: 'Others', website: 'Website', blog: 'Blog', other: 'Others' }
  return map[type] || type || ''
}

function activityIcon(action) {
  const icons = { created: '✨', updated: '✏️', phase_changed: '🔄', archived: '🗂️', comment_added: '💬', status_changed: '🔁', restored: '♻️' }
  return icons[action] || '📌'
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

function fmtDateTime(s) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

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
    cancelEditComment()
  } catch (err) {
    console.error('Edit comment error:', err)
  }
}

async function deleteComment(commentId) {
  if (!localProject.value?.id) return
  if (!window.confirm('Delete this comment?')) return
  try {
    await deleteProjectComment(localProject.value.id, commentId)
    projectComments.value = projectComments.value.filter(c => c.id !== commentId)
  } catch (err) {
    console.error('Delete comment error:', err)
  }
}

// ── Computed ──────────────────────────────────────────────────────────────────
const readonly = computed(() =>
  localProject.value?.siteStatus === 'live' ||
  localProject.value?.siteStatus === 'on-hold'
)

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

const hasQuickLinks = computed(() => !!(
  localProject.value?.builderLink ||
  localProject.value?.briefingUrl ||
  localProject.value?.sitemapUrl  ||
  localProject.value?.googleKeepUrl ||
  localProject.value?.logoSetUrl
))

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
async function loadProjectExtras(id) {
  commentsLoading.value    = true
  projectComments.value    = []
  projectActivityLog.value = []
  try {
    const [comments, log] = await Promise.all([
      getProjectComments(id),
      getProjectActivityLog(id),
    ])
    projectComments.value    = comments
    projectActivityLog.value = log
  } catch (err) {
    console.error('Error loading project extras:', err)
  } finally {
    commentsLoading.value = false
  }
}

function initLocalProject(p) {
  localProject.value   = JSON.parse(JSON.stringify(p))
  projTab.value        = 'info'
  phaseView.value      = 'list'
  infoEditMode.value   = false
  showAddSheet.value   = false
  newCommentText.value = ''
}

function startProjectListener(id) {
  if (unsubProject) unsubProject()
  pageLoading.value = true
  unsubProject = subscribeToProject(id, (snap) => {
    if (!snap.exists()) {
      pageLoading.value = false
      return
    }
    const data = { id: snap.id, ...snap.data() }
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
})

onUnmounted(() => {
  if (unsubProject) unsubProject()
})

watch(() => route.params.id, (newId, oldId) => {
  if (!newId || newId === oldId) return
  localProject.value = null
  startProjectListener(newId)
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
  infoMemberIds.value = (localProject.value?.assignedMembers || []).map(m => m.id)
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
  infoSaving.value = true
  const now = new Date().toISOString()
  try {
    const assignedMembers = infoMemberIds.value
      .map(id => teamStore.teamMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => ({ id: m.id, name: m.name, initials: m.initials || m.avatarInitials || '', avatarColor: m.avatarColor || '#6366f1' }))

    const fields = {
      name:            localProject.value.name || '',
      url:             localProject.value.url || '',
      originalSite:    localProject.value.originalSite || '',
      platform:        localProject.value.platform || '',
      projectType:     localProject.value.projectType || '',
      language:        localProject.value.language || '',
      kickstartDate:   localProject.value.kickstartDate || '',
      liveDate:        localProject.value.liveDate || '',
      currentPhase:    localProject.value.currentPhase || 'kickstart',
      currentSubPhase: localProject.value.currentSubPhase || null,
      activePhases:    localProject.value.activePhases || [],
      phaseData:       localProject.value.phaseData || {},
      assignedMembers,
      developer:       assignedMembers[0]?.name || localProject.value.developer || '',
      sitemapUrl:      localProject.value.sitemapUrl || '',
      builderLink:     localProject.value.builderLink || '',
      briefingUrl:     localProject.value.briefingUrl || '',
      googleKeepUrl:   localProject.value.googleKeepUrl || '',
      logoSetUrl:      localProject.value.logoSetUrl || '',
      updatedAt:       now,
    }
    await projectsStore.updateProject(localProject.value.id, fields)
    localProject.value.assignedMembers = assignedMembers
    localProject.value.developer = fields.developer
    addProjectActivityEntry(localProject.value.id, {
      action: 'updated', detail: `Project "${localProject.value.name}" updated`,
      userName: authStore.currentUser?.name || '',
      userUid: authStore.currentUser?.uid || '',
      timestamp: now,
    }).catch(() => {})
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
}

// ── Google Sheets ─────────────────────────────────────────────────────────────
async function addSheet() {
  if (!newSheet.url.trim()) return
  const entry = { id: uid(), label: newSheet.label, url: newSheet.url }
  if (!localProject.value.googleSheets) localProject.value.googleSheets = []
  localProject.value.googleSheets.push(entry)
  newSheet.label = ''; newSheet.url = ''; showAddSheet.value = false
  if (localProject.value.id) {
    projectsStore.updateProject(localProject.value.id, {
      googleSheets: localProject.value.googleSheets,
      updatedAt: new Date().toISOString(),
    }).catch(() => {})
  }
}

async function removeSheet(sheetId) {
  if (!localProject.value) return
  localProject.value.googleSheets = (localProject.value.googleSheets || []).filter(s => s.id !== sheetId)
  if (localProject.value.id) {
    projectsStore.updateProject(localProject.value.id, {
      googleSheets: localProject.value.googleSheets,
      updatedAt: new Date().toISOString(),
    }).catch(() => {})
  }
}

function saveSheetImmediate() {
  if (!localProject.value?.id) return
  projectsStore.updateProject(localProject.value.id, {
    googleSheets: localProject.value.googleSheets || [],
    updatedAt: new Date().toISOString(),
  }).catch(() => {})
}

// ── Comments ──────────────────────────────────────────────────────────────────
async function addComment() {
  const text = newCommentText.value.trim()
  if (!text || !localProject.value?.id) return
  const now  = new Date().toISOString()
  const user = authStore.currentUser
  const comment = {
    text,
    tag:            newCommentTag.value || 'general',
    authorName:     user?.name    || '',
    authorUid:      user?.uid     || '',
    authorInitials: (user?.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(),
    authorColor:    user?.avatarColor || '#6366f1',
    createdAt:      now,
  }
  try {
    const saved = await addProjectComment(localProject.value.id, comment)
    projectComments.value.push(saved)
    newCommentText.value = ''
    newCommentTag.value  = 'general'
    const pid  = localProject.value.id
    const name = localProject.value.name
    addProjectActivityEntry(pid, {
      action: 'comment_added', detail: `Comment added by ${comment.authorName}`,
      userName: comment.authorName, userUid: comment.authorUid, timestamp: now,
    }).catch(() => {})
    const notifBase = {
      type: 'comment',
      message: `New comment on "${name}" by ${comment.authorName}`,
      projectId: pid, projectName: name,
      read: false, createdAt: now, createdDate: now.slice(0, 10),
    }
    const assignedDev = teamStore.teamMembers.find(m =>
      m.active && m.name === localProject.value.developer &&
      m.uid && m.uid !== comment.authorUid
    )
    if (assignedDev) createNotification({ ...notifBase, userId: assignedDev.uid }).catch(() => {})
    teamStore.teamMembers
      .filter(m => m.active && m.department === 'Manager' && m.uid && m.uid !== comment.authorUid)
      .forEach(m => createNotification({ ...notifBase, userId: m.uid }).catch(() => {}))
  } catch (err) {
    console.error('Add comment error:', err)
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
    let detail = ''
    if      (newStatus === 'on-hold')                  detail = `Project put on hold by ${by}`
    else if (newStatus === 'development' && prev === 'on-hold') detail = `Project reactivated by ${by}`
    else if (newStatus === 'live')                     detail = `Site marked as live by ${by}`
    else if (newStatus === 'cancelled')                detail = `Project cancelled by ${by}`
    if (detail) {
      addProjectActivityEntry(localProject.value.id, {
        action: 'status_changed', detail,
        userName: by, userUid: authStore.currentUser?.uid || '',
        timestamp: now,
      }).catch(() => {})
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
    addProjectActivityEntry(localProject.value.id, {
      action: 'archived', detail: `Project archived by ${by}`,
      userName: by, userUid: authStore.currentUser?.uid || '',
      timestamp: now,
    }).catch(() => {})
    router.push('/projects')
  } catch (err) {
    console.error('Archive error:', err)
  }
}

// ── Activation ────────────────────────────────────────────────────────────────
function onActivationComplete() {
  const langs = langPills(localProject.value?.language)
  if (langs.length <= 1) {
    showLiveConfirm.value = true
  } else {
    activationLangs.value = langs
    showActivationModal.value = true
  }
}

async function confirmMarkLive() {
  showLiveConfirm.value = false
  await changeSiteStatus('live')
}

async function confirmActivation(checkedLangs) {
  showActivationModal.value = false
  await changeSiteStatus('live')
  if (!localProject.value) return
  if (!localProject.value.langStatus) localProject.value.langStatus = {}
  activationLangs.value.forEach(lang => {
    localProject.value.langStatus[lang] = checkedLangs[lang] ? 'live' : 'in-production'
  })
  if (localProject.value.id) {
    projectsStore.updateProject(localProject.value.id, {
      langStatus: { ...localProject.value.langStatus },
      updatedAt: new Date().toISOString(),
    }).catch(() => {})
  }
}
</script>
