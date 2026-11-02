import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { addCollection } from '@iconify/vue'
import phIcons from '@iconify-json/ph/icons.json'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// 使用本地图标数据，避免 @iconify/vue 在运行时访问网络。
addCollection(phIcons)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
