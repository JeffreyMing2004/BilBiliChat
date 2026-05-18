import { defineBilBiliChatPlugin } from '../src/sdk'

function speak(text: string): void {
  if (!('speechSynthesis' in window)) {
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 0.8
  window.speechSynthesis.speak(utterance)
}

export default defineBilBiliChatPlugin({
  id: 'tts-plugin',
  name: 'TTS Plugin',
  version: '1.0.0',
  enabled: false,
  hooks: {
    onMessage({ message }) {
      if (message.type === 'superChat') {
        speak(`醒目留言，${message.username} 说，${message.content}`)
      }
    },
  },
})
