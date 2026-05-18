import type { AppSettings } from '../types/settings'

export function overlayClassName(settings: AppSettings): string[] {
  return [
    settings.obsMode ? 'is-obs-mode' : '',
    settings.direction === 'top-down' ? 'is-direction-top' : 'is-direction-bottom',
    settings.animationsEnabled ? 'is-animated' : 'is-static',
  ].filter(Boolean)
}
