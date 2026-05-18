import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import './design/index.css'
import './styles/index.css'
import { performanceMonitor } from './core/performance/PerformanceMonitor'

async function bootstrap() {
  const app = createApp(App)

  app.use(createPinia())
  app.use(ElementPlus)
  performanceMonitor.start()

  app.mount('#app')
}

void bootstrap()
