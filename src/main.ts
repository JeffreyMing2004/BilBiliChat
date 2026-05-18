import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import './styles/index.css'
import { initializeConfigStore } from './utils/persist'

async function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())
  app.use(ElementPlus)

  await initializeConfigStore()

  app.mount('#app')
}

void bootstrap()
