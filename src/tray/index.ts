import { listen } from '@tauri-apps/api/event'

export async function initializeTrayListeners(options: {
  onToggleObs: () => void
  onOpenSettings: () => void
}): Promise<() => void> {
  const unlistenToggleObs = await listen('tray://toggle-obs', () => {
    options.onToggleObs()
  })
  const unlistenSettings = await listen('tray://open-settings', () => {
    options.onOpenSettings()
  })

  return () => {
    unlistenToggleObs()
    unlistenSettings()
  }
}
