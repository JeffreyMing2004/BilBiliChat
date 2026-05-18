import { DESIGN_THEMES, type DesignThemeName } from '../../../design'
import type { AppSettings } from '../../../types/settings'

export interface OverlayStyleEngineOptions {
  target: HTMLElement
  theme: DesignThemeName
  settings: AppSettings
  customCss?: string
}

function resolveTheme(settings: AppSettings, fallback: DesignThemeName): DesignThemeName {
  if (settings.obsMode) {
    return 'obs'
  }

  if (settings.theme === 'obs') {
    return 'obs'
  }

  if (settings.theme === 'neon') {
    return 'neon'
  }

  return fallback
}

export class OverlayStyleEngine {
  private readonly target: HTMLElement
  private readonly styleElement: HTMLStyleElement
  private customCss = ''
  private theme: DesignThemeName
  private settings: AppSettings

  constructor(options: OverlayStyleEngineOptions) {
    this.target = options.target
    this.theme = options.theme
    this.settings = options.settings
    this.customCss = options.customCss ?? ''
    this.styleElement = document.createElement('style')
    this.styleElement.setAttribute('data-overlay-style-engine', 'true')
    document.head.appendChild(this.styleElement)
    this.apply()
  }

  updateSettings(settings: AppSettings): void {
    this.settings = settings
    this.theme = resolveTheme(settings, this.theme)
    this.apply()
  }

  updateTheme(theme: DesignThemeName): void {
    this.theme = theme
    this.apply()
  }

  updateCustomCss(cssText: string): void {
    this.customCss = cssText
    this.apply()
  }

  apply(): void {
    const theme = DESIGN_THEMES[this.theme]
    this.target.dataset.overlayTheme = this.theme
    this.target.style.setProperty('--overlay-font-size', `${this.settings.fontSize}px`)
    this.target.style.setProperty('--overlay-font-weight', String(this.settings.fontWeight))
    this.target.style.setProperty('--overlay-stroke-width', `${this.settings.strokeWidth}px`)
    this.target.style.setProperty('--overlay-opacity', String(this.settings.overlayOpacity / 100))
    this.target.style.setProperty('--overlay-spacing', `${this.settings.messageSpacing}px`)
    this.target.style.setProperty('--overlay-animation-speed', `${this.settings.animationSpeed}s`)
    this.target.style.setProperty('--overlay-panel-color', theme.panel)
    this.target.style.setProperty('--overlay-panel-border', theme.panelBorder)
    this.target.style.setProperty('--overlay-text-primary', theme.textPrimary)
    this.target.style.setProperty('--overlay-text-secondary', theme.textSecondary)
    this.target.style.setProperty('--overlay-accent', theme.accent)
    this.target.style.setProperty('--overlay-accent-secondary', theme.accentSecondary)
    this.target.style.setProperty('--overlay-scale', window.devicePixelRatio > 1 ? 'translateZ(0) scale(1)' : 'translateZ(0)')

    this.styleElement.textContent = `
.overlay-render-layer {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--overlay-spacing);
  overflow: hidden;
  contain: layout style paint;
  transform: var(--overlay-scale);
  transform-origin: bottom left;
}

.overlay-render-layer[data-direction='top-down'] {
  justify-content: flex-start;
}

.overlay-render-item {
  border-radius: 18px;
  padding: 14px 18px;
  background: color-mix(in srgb, var(--overlay-panel-color) 94%, transparent);
  border: 1px solid var(--overlay-panel-border);
  color: var(--overlay-text-primary);
  font-size: var(--overlay-font-size);
  font-weight: var(--overlay-font-weight);
  line-height: 1.5;
  text-shadow:
    -1px 0 0 rgba(0, 0, 0, 0.88),
    0 1px 0 rgba(0, 0, 0, 0.88),
    1px 0 0 rgba(0, 0, 0, 0.88),
    0 -1px 0 rgba(0, 0, 0, 0.88),
    0 0 calc(var(--overlay-stroke-width) * 8) rgba(0, 0, 0, 0.42);
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform: translate3d(0, 0, 0);
}

.overlay-render-item.is-animated {
  animation: overlay-item-in var(--overlay-animation-speed) cubic-bezier(0.22, 1, 0.36, 1);
}

.overlay-render-item.is-leaving {
  opacity: 0;
  transform: translate3d(0, 16px, 0) scale(0.98);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.overlay-render-item__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  color: var(--overlay-text-secondary);
  font-size: calc(var(--overlay-font-size) * 0.56);
}

.overlay-render-item__badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--overlay-accent) 22%, transparent);
  color: var(--overlay-text-primary);
}

.overlay-render-item--gift {
  border-color: color-mix(in srgb, #f59e0b 40%, transparent);
}

.overlay-render-item--superChat {
  border-color: color-mix(in srgb, #fb7185 42%, transparent);
  box-shadow: 0 10px 24px rgba(251, 113, 133, 0.16);
}

.overlay-render-item--system {
  border-color: color-mix(in srgb, #22c55e 36%, transparent);
}

@keyframes overlay-item-in {
  from {
    opacity: 0;
    transform: translate3d(0, 20px, 0) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
  }
}

${this.customCss}
`
  }

  destroy(): void {
    this.styleElement.remove()
  }
}
