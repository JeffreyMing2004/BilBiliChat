export type DesignThemeName = 'dark' | 'obs' | 'neon'

export interface DesignThemeTokens {
  background: string
  backgroundOverlay: string
  panel: string
  panelBorder: string
  textPrimary: string
  textSecondary: string
  accent: string
  accentSecondary: string
  success: string
  warning: string
  danger: string
}

export const SPACING_TOKENS = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  section: '32px',
} as const

export const TYPOGRAPHY_TOKENS = {
  familyBase: '\'Inter\', \'SF Pro Display\', \'PingFang SC\', sans-serif',
  sizeXs: '12px',
  sizeSm: '13px',
  sizeMd: '14px',
  sizeLg: '18px',
  sizeXl: '24px',
  weightRegular: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700,
} as const

export const RADIUS_TOKENS = {
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '22px',
  pill: '999px',
} as const

export const SHADOW_TOKENS = {
  sm: '0 8px 20px rgba(0, 0, 0, 0.16)',
  md: '0 12px 28px rgba(0, 0, 0, 0.22)',
  lg: '0 18px 48px rgba(0, 0, 0, 0.28)',
} as const

export const MOTION_TOKENS = {
  fast: '140ms',
  normal: '220ms',
  slow: '320ms',
  easingStandard: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easingExit: 'cubic-bezier(0.4, 0, 1, 1)',
} as const

export const Z_INDEX_TOKENS = {
  base: 1,
  floating: 20,
  overlay: 40,
  debug: 60,
  toast: 80,
} as const

export const DESIGN_THEMES: Record<DesignThemeName, DesignThemeTokens> = {
  dark: {
    background: '#0b0f17',
    backgroundOverlay:
      'radial-gradient(circle at top left, rgba(88, 101, 242, 0.18), transparent 28%), radial-gradient(circle at right top, rgba(0, 174, 236, 0.16), transparent 22%), linear-gradient(180deg, #0a0d14 0%, #101522 45%, #0c111a 100%)',
    panel: 'rgba(18, 24, 38, 0.74)',
    panelBorder: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#edf2ff',
    textSecondary: '#8fa0c6',
    accent: '#4f8cff',
    accentSecondary: '#7d6bff',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  obs: {
    background: 'transparent',
    backgroundOverlay: 'transparent',
    panel: 'rgba(10, 12, 16, 0.58)',
    panelBorder: 'rgba(255, 255, 255, 0.06)',
    textPrimary: '#ffffff',
    textSecondary: '#d2d8e6',
    accent: '#00aeea',
    accentSecondary: '#7d6bff',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  neon: {
    background: '#050816',
    backgroundOverlay:
      'radial-gradient(circle at top left, rgba(0, 255, 214, 0.18), transparent 24%), radial-gradient(circle at top right, rgba(139, 92, 246, 0.22), transparent 28%), linear-gradient(180deg, #04070f 0%, #0a1022 100%)',
    panel: 'rgba(8, 16, 28, 0.8)',
    panelBorder: 'rgba(0, 255, 214, 0.18)',
    textPrimary: '#ebfffb',
    textSecondary: '#99d8d0',
    accent: '#00ffd6',
    accentSecondary: '#8b5cf6',
    success: '#22c55e',
    warning: '#fbbf24',
    danger: '#fb7185',
  },
}
