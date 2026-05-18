import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

import App from './App.vue'
import { crashReporter } from './core/crash/CrashReporter'
import './design/index.css'
import './styles/index.css'
import { performanceMonitor } from './core/performance/PerformanceMonitor'
import { loadBuiltinPlugins } from './sdk/loader'
import { getCurrentWindowLabel } from './windows/shared/manager'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function bootstrap() {
  crashReporter.installGlobalHandlers(getCurrentWindowLabel())
  const app = createApp(App)
  app.config.errorHandler = (error, instance, info) => {
    const componentType = instance?.$?.type as { name?: string; __name?: string } | undefined

    crashReporter.captureError('runtime', 'vue.errorHandler', error, {
      fatal: false,
      metadata: {
        component: componentType?.name ?? componentType?.__name ?? 'AnonymousComponent',
        info,
      },
    })
  }

  app.use(createPinia())
  app.use(ElementPlus)
  performanceMonitor.start()
  await loadBuiltinPlugins()

  app.mount('#app')
}

void bootstrap().catch((error) => {
  crashReporter.captureError('runtime', 'bootstrap', error, {
    fatal: true,
    windowLabel: 'main',
  })

  const message = error instanceof Error ? error.message : String(error)
  const safeMessage = escapeHtml(message)
  document.body.innerHTML = `
    <div style="display:grid;place-items:center;min-height:100vh;background:#0b1220;color:#eef4ff;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
      <div style="max-width:720px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;background:rgba(14,23,38,0.92);padding:24px;box-shadow:0 24px 60px rgba(0,0,0,0.35);">
        <p style="margin:0 0 8px;color:#8fa7c6;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;">Bootstrap Failed</p>
        <h1 style="margin:0 0 12px;font-size:28px;">BilBiliChat 启动失败</h1>
        <p style="margin:0;color:#d8e4f5;line-height:1.7;">${safeMessage}</p>
      </div>
    </div>
  `
})
