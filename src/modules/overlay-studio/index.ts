import type { AppSettings } from '../../types/settings'

export interface OverlayPreset {
  name: string
  description: string
  settings: Partial<AppSettings>
}

export interface OverlayStudioSampleMessage {
  id: string
  type: 'danmu' | 'gift' | 'superChat'
  username: string
  content: string
  accent: string
  price?: number
}

const OVERLAY_PRESET_KEYS: Array<keyof AppSettings> = [
  'fontSize',
  'fontWeight',
  'strokeWidth',
  'overlayOpacity',
  'overlayOffsetX',
  'overlayOffsetY',
  'overlayShadowBlur',
  'overlayShadowOpacity',
  'giftAccentStrength',
  'superChatAccentStrength',
  'messageSpacing',
  'animationSpeed',
  'direction',
  'overlayCustomCss',
]

export const BUILTIN_OVERLAY_PRESETS: OverlayPreset[] = [
  {
    name: 'OBS Classic',
    description: '经典直播间样式，强调可读性与稳定性。',
    settings: {
      fontSize: 30,
      fontWeight: 700,
      strokeWidth: 2,
      overlayOpacity: 92,
      overlayOffsetX: 80,
      overlayOffsetY: 72,
      overlayShadowBlur: 16,
      overlayShadowOpacity: 34,
      giftAccentStrength: 58,
      superChatAccentStrength: 80,
      messageSpacing: 12,
      animationSpeed: 0.9,
      direction: 'bottom-up',
    },
  },
  {
    name: 'Neon Stage',
    description: '更强的霓虹描边和舞台感，适合赛博风直播。',
    settings: {
      fontSize: 34,
      fontWeight: 800,
      strokeWidth: 3,
      overlayOpacity: 100,
      overlayOffsetX: 110,
      overlayOffsetY: 92,
      overlayShadowBlur: 28,
      overlayShadowOpacity: 60,
      giftAccentStrength: 85,
      superChatAccentStrength: 96,
      messageSpacing: 14,
      animationSpeed: 0.7,
      direction: 'bottom-up',
    },
  },
  {
    name: 'Compact HUD',
    description: '适合多显示器和高密度弹幕的紧凑视图。',
    settings: {
      fontSize: 24,
      fontWeight: 600,
      strokeWidth: 1,
      overlayOpacity: 84,
      overlayOffsetX: 48,
      overlayOffsetY: 48,
      overlayShadowBlur: 10,
      overlayShadowOpacity: 20,
      giftAccentStrength: 42,
      superChatAccentStrength: 68,
      messageSpacing: 8,
      animationSpeed: 0.6,
      direction: 'top-down',
    },
  },
]

export const OVERLAY_STUDIO_SAMPLE_MESSAGES: OverlayStudioSampleMessage[] = [
  {
    id: 'sample-danmu',
    type: 'danmu',
    username: '晚风轻语',
    content: '主播晚上好，这套 Overlay 已经很有产品感了',
    accent: '#6dc8ff',
  },
  {
    id: 'sample-gift',
    type: 'gift',
    username: '小电视舰桥',
    content: '赠送了 小心心 x 66',
    accent: '#ffd166',
  },
  {
    id: 'sample-sc',
    type: 'superChat',
    username: '舰桥总督',
    content: 'Overlay Studio 做好了就能直接上 OBS 了',
    accent: '#ff7a45',
    price: 50,
  },
]

export function createOverlayPreset(name: string, description: string, settings: AppSettings): OverlayPreset {
  const presetSettings = OVERLAY_PRESET_KEYS.reduce<Partial<AppSettings>>((result, key) => {
    Object.assign(result, { [key]: settings[key] })
    return result
  }, {})

  return {
    name: name.trim() || '自定义模板',
    description: description.trim() || '由 Overlay Studio 导出的模板',
    settings: presetSettings,
  }
}

export function applyOverlayPreset(settings: AppSettings, preset: OverlayPreset): AppSettings {
  return {
    ...settings,
    ...preset.settings,
  }
}

export function serializeOverlayPreset(preset: OverlayPreset): string {
  return JSON.stringify(preset, null, 2)
}

export function parseOverlayPreset(input: string): OverlayPreset {
  const payload = JSON.parse(input) as OverlayPreset
  return {
    name: String(payload.name ?? '导入模板'),
    description: String(payload.description ?? '从外部导入的 Overlay 模板'),
    settings: typeof payload.settings === 'object' && payload.settings ? payload.settings : {},
  }
}
