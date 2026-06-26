<template>
  <!-- ── Loading ────────────────────────────────────────────────── -->
  <div v-if="authState === 'loading'" class="auth-wrap">
    <div class="auth-card auth-card--center">
      <div class="spinner"></div>
      <p class="auth-muted">Loading…</p>
    </div>
  </div>

  <!-- ── Login ──────────────────────────────────────────────────── -->
  <div v-else-if="authState === 'login'" class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">🚀</div>
      <h1 class="auth-title">Project Tracker</h1>
      <p class="auth-sub">Web Dev Team</p>
      <p v-if="loginError" class="auth-error">{{ loginError }}</p>
      <button class="btn-google" @click="handleSignIn" :disabled="signingIn">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        <span>{{ signingIn ? 'Signing in…' : 'Sign in with Google' }}</span>
      </button>
      <p class="auth-note">
        Access is restricted to team members.<br>
        Contact your manager if you cannot log in.
      </p>
    </div>
  </div>

  <!-- ── Access Denied ──────────────────────────────────────────── -->
  <div v-else-if="authState === 'denied'" class="auth-wrap">
    <div class="auth-card">
      <div class="auth-logo">🚫</div>
      <h1 class="auth-title">Access Denied</h1>
      <p class="auth-sub">
        Your account (<strong>{{ deniedEmail }}</strong>) is not registered as a team member.<br>
        Please contact your manager.
      </p>
      <button class="btn btn-secondary btn--full" @click="handleSignOut">Sign Out</button>
    </div>
  </div>

  <!-- ── First-Run Setup ────────────────────────────────────────── -->
  <div v-else-if="authState === 'setup'" class="auth-wrap">
    <div class="auth-card auth-card--wide">
      <div class="auth-card__header">
        <div class="auth-logo">🚀</div>
        <h1 class="auth-title">First-Time Setup</h1>
        <p class="auth-sub">No team members found.<br>Set up the first Manager account.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input" v-model="setupName" placeholder="Your full name…" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input form-input--readonly" :value="setupDefaults.email" readonly />
      </div>
      <div class="form-group">
        <label class="form-label">Role</label>
        <input class="form-input form-input--readonly" value="Manager" readonly />
      </div>
      <button class="btn btn-primary btn--full" @click="handleFirstRunSetup" :disabled="setupLoading">
        {{ setupLoading ? 'Setting up…' : '✓ Confirm & Enter App' }}
      </button>
      <button class="btn btn-ghost btn-sm btn--full" style="margin-top:8px" @click="handleSignOut">
        Sign Out
      </button>
      <p v-if="setupError" class="auth-error" style="margin-top:12px">{{ setupError }}</p>
    </div>
  </div>

  <!-- ── Connection Error ───────────────────────────────────────── -->
  <div v-else-if="authState === 'error'" class="auth-wrap">
    <div class="auth-card auth-card--center">
      <div class="auth-logo" style="font-size:36px">⚠️</div>
      <h1 class="auth-title">Connection Error</h1>
      <p class="auth-sub">
        Could not connect to the database.<br>
        Please check your connection and try again.
      </p>
      <button class="btn btn-secondary btn--full" @click="reload">Refresh</button>
      <button class="btn btn-ghost btn-sm btn--full" style="margin-top:8px" @click="handleSignOut">
        Sign Out
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const authState    = computed(() => authStore.authState)
const deniedEmail  = computed(() => authStore.deniedEmail)
const setupDefaults = computed(() => authStore.setupDefaults)

const signingIn   = ref(false)
const loginError  = ref('')
const setupName   = ref('')
const setupLoading = ref(false)
const setupError  = ref('')

async function handleSignIn() {
  signingIn.value  = true
  loginError.value = ''
  try {
    await authStore.signIn()
    // onAuthChange fires → authState updates reactively
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      loginError.value = err.message || 'Sign-in failed. Please try again.'
    }
  } finally {
    signingIn.value = false
  }
}

async function handleSignOut() {
  await authStore.logout()
}

async function handleFirstRunSetup() {
  if (!setupName.value.trim()) {
    setupError.value = 'Please enter your full name.'
    return
  }
  setupLoading.value = true
  setupError.value   = ''
  try {
    await authStore.firstRunSetup(setupName.value)
    // authState → 'authenticated' — App.vue detects and navigates to /
  } catch (err) {
    console.error('First-run setup error:', err)
    setupError.value = 'Setup failed: ' + (err.message || 'Unknown error')
  } finally {
    setupLoading.value = false
  }
}

function reload() {
  location.reload()
}
</script>

<style scoped>
/* ── Wrapper ─────────────────────────────────────────────────────── */
.auth-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 24px;
}

/* ── Card ────────────────────────────────────────────────────────── */
.auth-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 48px 40px;
  text-align: center;
  width: 100%;
  max-width: 380px;
  box-shadow: var(--sh-lg);
}

.auth-card--wide  { max-width: 460px; text-align: left; }
.auth-card--center { display: flex; flex-direction: column; align-items: center; gap: 14px; }

.auth-card__header { text-align: center; margin-bottom: 28px; }

/* ── Typography ──────────────────────────────────────────────────── */
.auth-logo  { font-size: 48px; margin-bottom: 16px; display: block; }
.auth-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.auth-sub   { font-size: 14px; color: var(--muted); margin-bottom: 28px; line-height: 1.5; }
.auth-note  { font-size: 12px; color: var(--muted); margin-top: 20px; line-height: 1.5; }
.auth-error { font-size: 13px; color: var(--danger); margin-bottom: 12px; }
.auth-muted { font-size: 14px; color: var(--muted); }

/* ── Google button ───────────────────────────────────────────────── */
.btn-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 11px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.btn-google:hover:not(:disabled) { background: var(--bg); box-shadow: var(--sh); }
.btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Buttons ─────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  text-decoration: none;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn--full    { width: 100%; margin-top: 8px; }

.btn-primary   { background: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-h); }

.btn-secondary { background: var(--bg); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover:not(:disabled) { background: var(--border); }

.btn-ghost  { background: transparent; color: var(--muted); }
.btn-ghost:hover:not(:disabled) { background: var(--bg); color: var(--text); }

.btn-sm { font-size: 13px; padding: 7px 12px; }

/* ── Form elements ───────────────────────────────────────────────── */
.form-group { margin-bottom: 16px; }
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  margin-bottom: 6px;
}
.form-input {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus { border-color: var(--primary); }
.form-input--readonly {
  background: var(--bg);
  color: var(--muted);
  cursor: default;
}

/* ── Spinner ─────────────────────────────────────────────────────── */
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
