import type { LiveMessage } from '../../types/message'
import type { AppSettings } from '../../types/settings'

let audioContext: AudioContext | null = null
const audioCache = new Map<string, HTMLAudioElement>()

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }

  const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!Context) {
    return null
  }

  if (!audioContext) {
    audioContext = new Context()
  }

  return audioContext
}

function beep(frequency: number, duration: number, gainValue: number): void {
  const context = getAudioContext()

  if (!context) {
    return
  }

  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.value = gainValue
  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(now)
  oscillator.stop(now + duration)
  gain.gain.setValueAtTime(gainValue, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
}

function playCustomAudio(url: string, volume: number): boolean {
  if (!url) {
    return false
  }

  const cached = audioCache.get(url) ?? new Audio(url)
  cached.volume = volume
  cached.currentTime = 0
  audioCache.set(url, cached)
  void cached.play().catch(() => {})
  return true
}

export function playMessageSound(message: LiveMessage, settings: AppSettings): void {
  if (!settings.soundEnabled) {
    return
  }

  const volume = settings.soundVolume / 100

  switch (message.type) {
    case 'superChat':
      if (!playCustomAudio(settings.customScSound, volume)) {
        beep(880, 0.42, 0.02 + volume * 0.04)
      }
      break
    case 'gift':
      if (!playCustomAudio(settings.customGiftSound, volume)) {
        beep(660, 0.22, 0.015 + volume * 0.03)
      }
      break
    case 'system':
      if (message.rawCommand === 'INTERACT_WORD') {
        if (!playCustomAudio(settings.customEntrySound, volume)) {
          beep(520, 0.12, 0.01 + volume * 0.02)
        }
      }
      break
    default:
      break
  }
}
