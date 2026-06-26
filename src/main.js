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

// Wait for Firebase auth to settle before mounting so the router guard
// always sees a definitive authState on the initial navigation.
useAuthStore()
  .initAuth()
  .then(() => {
    app.use(router)
    app.mount('#app')
  })
