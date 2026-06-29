import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { useAuthStore } from './stores/auth.js'
import router from './router/index.js'
import App from './App.vue'
import './assets/main.css'

// Apply saved theme before mount to prevent flash
if (localStorage.getItem('pt_theme') === 'dark') {
  document.body.classList.add('dark')
}

const app   = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Wait for both the router's initial navigation AND Firebase auth to settle
// before mounting. This ensures router.currentRoute.value.path reflects the
// actual URL when App.vue's auth watcher fires (immediate: true).
Promise.all([router.isReady(), useAuthStore().initAuth()])
  .then(() => {
    app.mount('#app')
  })
