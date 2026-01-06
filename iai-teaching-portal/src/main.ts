import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import { setupAuthFetch } from './utils/http'
import { addCollection } from '@iconify/vue'
import mdiIcons from './assets/icons-bundle.json'

// Register bundled icons offline
addCollection(mdiIcons)

// 导入样式
import './assets/styles/main.css'

// Install global fetch interceptor for auth token
setupAuthFetch()

// 创建应用实例
const app = createApp(App)

// 使用 Pinia
const pinia = createPinia()
app.use(pinia)

// 使用路由
app.use(router)

// 挂载应用
app.mount('#app')
