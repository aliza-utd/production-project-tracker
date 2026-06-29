<template>
  <div class="join-wrap">

    <!-- Loading -->
    <div v-if="state === 'loading'" class="join-card join-card--center">
      <div class="spinner"></div>
      <p class="join-muted">Loading invitation…</p>
    </div>

    <!-- Invalid / already used -->
    <div v-else-if="state === 'invalid'" class="join-card join-card--center">
      <div class="join-icon">🔗</div>
      <h1 class="join-title">Link Not Available</h1>
      <p class="join-sub">
        This invite link has already been used or is no longer valid.<br>
        If you have an account, <a href="/login" style="color:var(--primary);font-weight:500">sign in here</a>.
      </p>
      <p class="join-sub" style="margin-top:8px">
        If you haven't activated yet, contact your manager for a new invite link.
      </p>
    </div>

    <!-- Expired -->
    <div v-else-if="state === 'expired'" class="join-card join-card--center">
      <div class="join-icon">⏰</div>
      <h1 class="join-title">Invite Expired</h1>
      <p class="join-sub">This invite link expired after 7 days.<br>Ask your manager to resend the invite.</p>
    </div>

    <!-- Already used (status === 'active' and inviteCode still present) -->
    <div v-else-if="state === 'used'" class="join-card join-card--center">
      <div class="join-icon">✅</div>
      <h1 class="join-title">Already Activated</h1>
      <p class="join-sub">
        This invite link has already been used.<br>
        If you have an account, <a href="/login" style="color:var(--primary);font-weight:500">sign in here</a>.
      </p>
    </div>

    <!-- Activation form -->
    <div v-else-if="state === 'form'" class="join-card">
      <div class="join-card__header">
        <div class="join-icon">🚀</div>
        <h1 class="join-title">You've been invited</h1>
        <p class="join-sub">
          as <strong>{{ invite.role || 'Team Member' }}</strong> —
          activate your account to get started
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">Name</label>
        <input class="form-input form-input--readonly" :value="invite.name" readonly>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input form-input--readonly" :value="invite.email" readonly>
      </div>

      <!-- Method tabs -->
      <div class="method-tabs">
        <button class="method-btn" :class="{ active: method === 'password' }"
          @click="method = 'password'; error = ''">
          Set a password
        </button>
        <button class="method-btn" :class="{ active: method === 'google' }"
          @click="method = 'google'; error = ''">
          Continue with Google
        </button>
      </div>

      <!-- Password method -->
      <template v-if="method === 'password'">
        <div class="form-group">
          <label class="form-label">Password *</label>
          <input class="form-input" type="password" v-model="password"
            placeholder="Choose a password (min. 6 characters)" @keyup.enter="handlePasswordJoin">
        </div>
        <div class="form-group">
          <label class="form-label">Confirm Password *</label>
          <input class="form-input" type="password" v-model="confirmPassword"
            placeholder="Re-enter your password" @keyup.enter="handlePasswordJoin">
        </div>
        <p v-if="error" class="join-error">{{ error }}</p>
        <button class="btn btn-primary btn--full" @click="handlePasswordJoin" :disabled="joining">
          {{ joining ? 'Activating…' : 'Activate Account' }}
        </button>
      </template>

      <!-- Google method -->
      <template v-else>
        <p style="font-size:13px;color:var(--muted);margin:16px 0;line-height:1.6">
          Sign in with the Google account for <strong>{{ invite.email }}</strong>.<br>
          Make sure you select the right account when the Google popup opens.
        </p>
        <p v-if="error" class="join-error">{{ error }}</p>
        <button class="btn-google-join btn--full" @click="handleGoogleJoin" :disabled="joining">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="18" height="18">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span>{{ joining ? 'Connecting…' : 'Continue with Google' }}</span>
        </button>
      </template>
    </div>

    <!-- Success -->
    <div v-else-if="state === 'success'" class="join-card join-card--center">
      <div class="join-icon">🎉</div>
      <h1 class="join-title">Account Activated!</h1>
      <p class="join-sub">Welcome to the team. Redirecting you to the app…</p>
      <div class="spinner" style="margin-top:16px"></div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getInviteByCode, activateInvitedMember,
  createFirebaseEmailUser, signInWithGoogle, signOutUser,
} from '@/firebase-service'

const route  = useRoute()
const router = useRouter()

const state           = ref('loading')
const invite          = ref(null)
const method          = ref('password')  // 'password' | 'google'
const password        = ref('')
const confirmPassword = ref('')
const joining         = ref(false)
const error           = ref('')

onMounted(async () => {
  const code = route.params.code
  try {
    const member = await getInviteByCode(code)
    if (!member) { state.value = 'invalid'; return }
    if (member.status === 'active') { state.value = 'used'; return }
    if (new Date(member.inviteExpiry) < new Date()) { state.value = 'expired'; return }
    invite.value = member
    state.value  = 'form'
  } catch (err) {
    console.error('[JoinPage] Error loading invite:', err)
    state.value = 'invalid'
  }
})

async function handlePasswordJoin() {
  error.value = ''
  if (!password.value || password.value.length < 6) {
    error.value = 'Password must be at least 6 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match.'
    return
  }
  joining.value = true
  try {
    console.log('[Join] 1. Submit started, inviteCode:', route.params.code, '| inviteDocId:', invite.value.id)
    const cred = await createFirebaseEmailUser(invite.value.email, password.value)
    console.log('[Join] 2. Firebase Auth account created, uid:', cred.user.uid)
    await activateInvitedMember(invite.value.id, cred.user.uid, invite.value)
    console.log('[Join] 6. activateInvitedMember returned without throwing — setting success')
    state.value = 'success'
    setTimeout(() => router.push('/'), 1800)
  } catch (err) {
    console.error('[JoinPage] Password activation error:', err)
    if (err.code === 'auth/email-already-in-use') {
      error.value = 'An account with this email already exists. Please sign in instead.'
    } else {
      error.value = err.message || 'Activation failed. Please try again.'
    }
  } finally {
    joining.value = false
  }
}

async function handleGoogleJoin() {
  error.value = ''
  joining.value = true
  try {
    const result = await signInWithGoogle()
    const googleEmail = (result.user.email || '').toLowerCase()
    const inviteEmail = (invite.value.email || '').toLowerCase()

    if (googleEmail !== inviteEmail) {
      // Wrong Google account — sign them back out and show error
      await signOutUser()
      error.value =
        `The Google account you selected (${result.user.email}) doesn't match the email ` +
        `this invite was sent to. Please sign in with ${invite.value.email}, or set a ` +
        `password instead.`
      return
    }

    // Email matches — activate
    await activateInvitedMember(invite.value.id, result.user.uid, invite.value)
    state.value = 'success'
    setTimeout(() => router.push('/'), 1800)
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      // User dismissed — no error message needed
    } else {
      console.error('[JoinPage] Google activation error:', err)
      error.value = err.message || 'Google sign-in failed. Please try again.'
    }
  } finally {
    joining.value = false
  }
}
</script>

<style scoped>
.join-wrap {
  width: 100%; min-height: 100vh; display: flex; align-items: center;
  justify-content: center; background: var(--bg); padding: 24px;
}
.join-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 48px 40px; width: 100%; max-width: 440px;
}
.join-card--center {
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: 12px;
}
.join-card__header { text-align: center; margin-bottom: 20px; }

.join-icon  { font-size: 48px; margin-bottom: 8px; display: block; }
.join-title { font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
.join-sub   { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 0; }
.join-muted { font-size: 14px; color: var(--muted); }
.join-error { font-size: 13px; color: var(--danger); margin: 0 0 12px; line-height: 1.4; }

.form-group { margin-bottom: 14px; }
.form-label {
  display: block; font-size: 13px; font-weight: 500;
  color: var(--text); margin-bottom: 5px;
}
.form-input {
  width: 100%; background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 9px 12px; font-size: 14px; color: var(--text);
  outline: none; transition: border-color 0.15s; box-sizing: border-box;
}
.form-input:focus { border-color: var(--primary); }
.form-input--readonly { background: var(--bg); color: var(--muted); cursor: default; }

/* Method tabs */
.method-tabs {
  display: flex; gap: 0; border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; margin: 16px 0;
}
.method-btn {
  flex: 1; padding: 8px; border: none; background: transparent;
  font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.method-btn + .method-btn { border-left: 1px solid var(--border); }
.method-btn.active { background: var(--primary); color: #fff; }
.method-btn:not(.active):hover { background: var(--bg); color: var(--text); }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 8px; padding: 10px 16px;
  font-size: 14px; font-weight: 500; cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn--full    { width: 100%; box-sizing: border-box; }
.btn-primary  { background: var(--primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--primary-h); }

.btn-google-join {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 500;
  color: var(--text); cursor: pointer; transition: background 0.15s;
}
.btn-google-join:hover:not(:disabled) { background: var(--bg); }
.btn-google-join:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border); border-top-color: var(--primary);
  border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
