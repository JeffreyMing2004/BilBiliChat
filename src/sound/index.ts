import type { DanmuMessageItem } from '../types/danmu'

let audioContext: AudioContext | null = null

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

export function playMessageSound(message: DanmuMessageItem): void {
  switch (message.type) {
    case 'superChat':
      beep(880, 0.42, 0.05)
      break
    case 'gift':
      beep(660, 0.22, 0.035)
      break
    case 'system':
      if (message.rawCommand === 'INTERACT_WORD') {
        beep(520, 0.12, 0.025)
      }
      break
    default:
      break
  }
}
